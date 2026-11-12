import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth } from "../middleware/auth.js";
import { sessionFingerprint } from "../lib/session-key.js";
import { env } from "../config/env.js";
import { userHasActiveSubscription, movieHasValidLicense } from "../services/entitlement.service.js";
import { createSignedPlaybackToken } from "../services/cloudflare.service.js";

const router = Router();

router.post("/:movieId/token", requireAuth, asyncHandler(async (req, res) => {
  const { playerSessionId } = z.object({ playerSessionId: z.string().uuid() }).parse(req.body);
  const movie = await prisma.movie.findUnique({
    where: { id: req.params.movieId },
    include: {
      videoAssets: {
        where: { processingStatus: "READY", playbackStatus: "AVAILABLE" },
        take: 1
      }
    }
  });

  if (!movie || movie.publicationStatus !== "PUBLISHED" || movie.videoAssets.length === 0) {
    throw new HttpError(404, "This movie is not available for streaming.");
  }

  const subscription = await userHasActiveSubscription(req.user.id);
  if (!subscription) throw new HttpError(402, "An active monthly subscription is required to watch movies.");

  // Only trust CF-IPCountry when the API is behind Cloudflare and direct origin access is blocked.
  const countryCode = env.TRUST_CF_IP_COUNTRY
    ? String(req.get("cf-ipcountry") || "").toUpperCase()
    : null;

  const licensed = await movieHasValidLicense(movie.id, countryCode);
  if (!licensed) throw new HttpError(403, "This movie is not licensed for streaming in your territory.");

  // The Express session ID represents this signed-in browser/device session.
  const now = new Date();
  const sessionId = sessionFingerprint(req.sessionID);
  await prisma.deviceSession.upsert({
    where: {
      userId_sessionId_playerSessionId: {
        userId: req.user.id,
        sessionId,
        playerSessionId
      }
    },
    create: { userId: req.user.id, sessionId, playerSessionId, lastSeenAt: now },
    update: { lastSeenAt: now, revokedAt: null }
  });

  const activeSince = new Date(now.getTime() - 2 * 60 * 1000);
  const activeDeviceCount = await prisma.deviceSession.count({
    where: { userId: req.user.id, revokedAt: null, lastSeenAt: { gte: activeSince } }
  });
  if (activeDeviceCount > subscription.plan.maxScreens) {
    await prisma.deviceSession.update({
      where: {
        userId_sessionId_playerSessionId: {
          userId: req.user.id,
          sessionId,
          playerSessionId
        }
      },
      data: { revokedAt: now }
    });
    throw new HttpError(409, `Your plan allows up to ${subscription.plan.maxScreens} active screen(s). Sign out on another device and try again.`);
  }

  const playback = await createSignedPlaybackToken(movie.videoAssets[0].providerVideoUid);
  res.json({
    manifestUrl: playback.manifestUrl,
    expiresAt: playback.expiresAt,
    expiresInSeconds: 4 * 60 * 60
  });
}));

router.post("/heartbeat", requireAuth, asyncHandler(async (req, res) => {
  const { playerSessionId } = z.object({ playerSessionId: z.string().uuid() }).parse(req.body);
  const subscription = await userHasActiveSubscription(req.user.id);
  if (!subscription) throw new HttpError(402, "An active subscription is required.");

  const sessionId = sessionFingerprint(req.sessionID);
  const existing = await prisma.deviceSession.findUnique({
    where: {
      userId_sessionId_playerSessionId: {
        userId: req.user.id,
        sessionId,
        playerSessionId
      }
    }
  });
  if (!existing || existing.revokedAt) throw new HttpError(409, "This playback session is no longer active.");

  const now = new Date();
  await prisma.deviceSession.update({
    where: { id: existing.id },
    data: { lastSeenAt: now }
  });

  const activeSince = new Date(now.getTime() - 2 * 60 * 1000);
  const activeDeviceCount = await prisma.deviceSession.count({
    where: { userId: req.user.id, revokedAt: null, lastSeenAt: { gte: activeSince } }
  });
  if (activeDeviceCount > subscription.plan.maxScreens) {
    await prisma.deviceSession.update({
      where: { id: existing.id },
      data: { revokedAt: now }
    });
    throw new HttpError(409, `Your plan allows up to ${subscription.plan.maxScreens} active screen(s).`);
  }

  res.json({ active: true });
}));

router.post("/session/end", requireAuth, asyncHandler(async (req, res) => {
  const { playerSessionId } = z.object({ playerSessionId: z.string().uuid() }).parse(req.body);
  await prisma.deviceSession.updateMany({
    where: {
      userId: req.user.id,
      sessionId: sessionFingerprint(req.sessionID),
      playerSessionId,
      revokedAt: null
    },
    data: { revokedAt: new Date() }
  });
  res.json({ ended: true });
}));

router.post("/progress", requireAuth, asyncHandler(async (req, res) => {
  const input = z.object({
    movieId: z.string().uuid(),
    positionSeconds: z.number().int().min(0).max(60 * 60 * 12)
  }).parse(req.body);

  const subscription = await userHasActiveSubscription(req.user.id);
  if (!subscription) throw new HttpError(402, "An active subscription is required.");

  const movie = await prisma.movie.findUnique({
    where: { id: input.movieId },
    select: { id: true, publicationStatus: true }
  });
  if (!movie || movie.publicationStatus !== "PUBLISHED") throw new HttpError(404, "Movie not found.");

  await prisma.watchProgress.upsert({
    where: { userId_movieId: { userId: req.user.id, movieId: input.movieId } },
    create: {
      userId: req.user.id,
      movieId: input.movieId,
      positionSeconds: input.positionSeconds
    },
    update: {
      positionSeconds: input.positionSeconds,
      lastWatchedAt: new Date()
    }
  });

  res.json({ saved: true });
}));

export default router;
