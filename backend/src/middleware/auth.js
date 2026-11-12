import { prisma } from "../lib/prisma.js";

export async function requireAuth(req, res, next) {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: { message: "Please sign in first." } });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } }
    });

    if (!user || user.accountStatus !== "ACTIVE") {
      req.session.destroy(() => {});
      return res.status(401).json({ error: { message: "Your account is not active." } });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdministrator(req, res, next) {
  const isAdmin = req.user?.roles?.some(({ role }) => role.name === "administrator");
  if (!isAdmin) {
    return res.status(403).json({ error: { message: "Administrator access is required." } });
  }
  next();
}
