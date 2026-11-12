import { Router } from "express";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth } from "../middleware/auth.js";
import { sessionFingerprint } from "../lib/session-key.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Too many sign-in attempts. Try again later." } }
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(255),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  password: z.string().min(10).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128)
});

function regenerateSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.userId = userId;
      req.session.csrfToken = randomBytes(32).toString("hex");
      req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

router.post("/register", authLimiter, asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const email = input.email.toLowerCase();
  const username = input.username?.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, ...(username ? [{ username }] : [])] },
    select: { id: true }
  });
  if (existing) throw new HttpError(409, "An account with that email or username already exists.");

  const userRole = await prisma.role.findUnique({ where: { name: "user" } });
  if (!userRole) throw new HttpError(500, "Default roles are missing. Run the database seed command.");

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: {
      email,
      username,
      fullName: input.fullName,
      passwordHash,
      preferences: { create: {} },
      roles: { create: { roleId: userRole.id } }
    },
    select: { id: true, email: true, username: true, fullName: true }
  });

  await regenerateSession(req, user.id);
  res.status(201).json({ user });
}));

router.post("/login", authLimiter, asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() }
  });

  const passwordIsValid = user
    ? await argon2.verify(user.passwordHash, input.password)
    : false;

  if (!user || !passwordIsValid || user.accountStatus !== "ACTIVE") {
    throw new HttpError(401, "Email or password is incorrect.");
  }

  await regenerateSession(req, user.id);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName
    }
  });
}));

router.post("/logout", asyncHandler(async (req, res) => {
  if (req.session?.userId && req.sessionID) {
    await prisma.deviceSession.updateMany({
      where: { userId: req.session.userId, sessionId: sessionFingerprint(req.sessionID), revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
  await new Promise((resolve, reject) => {
    req.session.destroy((error) => error ? reject(error) : resolve());
  });
  res.clearCookie(process.env.SESSION_COOKIE_NAME || "filmora.sid", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  res.json({ message: "Signed out." });
}));

router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      fullName: req.user.fullName,
      roles: req.user.roles.map(({ role }) => role.name)
    }
  });
});

export default router;
