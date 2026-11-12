import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth } from "../middleware/auth.js";
import { movieInclude, publicMovieWhere, serializeMovie } from "../services/catalog.service.js";

const router = Router();
router.use(requireAuth);

// Movies the member has started, newest first (only titles still available to them).
router.get("/continue-watching", asyncHandler(async (req, res) => {
  const rows = await prisma.watchProgress.findMany({
    where: { userId: req.user.id, positionSeconds: { gt: 10 }, movie: publicMovieWhere(req) },
    include: { movie: { include: movieInclude } },
    orderBy: { lastWatchedAt: "desc" },
    take: 12
  });
  res.json({
    items: rows.map((row) => ({
      positionSeconds: row.positionSeconds,
      lastWatchedAt: row.lastWatchedAt,
      movie: serializeMovie(row.movie)
    }))
  });
}));

router.get("/progress/:movieId", asyncHandler(async (req, res) => {
  const movieId = z.string().uuid().parse(req.params.movieId);
  const row = await prisma.watchProgress.findUnique({
    where: { userId_movieId: { userId: req.user.id, movieId } }
  });
  res.json({ positionSeconds: row?.positionSeconds ?? 0 });
}));

router.get("/favorites", asyncHandler(async (req, res) => {
  const rows = await prisma.favorite.findMany({
    where: { userId: req.user.id, movie: publicMovieWhere(req) },
    include: { movie: { include: movieInclude } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ movies: rows.map((row) => serializeMovie(row.movie)) });
}));

router.get("/favorites/:movieId", asyncHandler(async (req, res) => {
  const movieId = z.string().uuid().parse(req.params.movieId);
  const row = await prisma.favorite.findUnique({
    where: { userId_movieId: { userId: req.user.id, movieId } }
  });
  res.json({ favorite: Boolean(row) });
}));

router.put("/favorites/:movieId", asyncHandler(async (req, res) => {
  const movieId = z.string().uuid().parse(req.params.movieId);
  const movie = await prisma.movie.findFirst({ where: publicMovieWhere(req, { id: movieId }), select: { id: true } });
  if (!movie) throw new HttpError(404, "Movie not found.");

  await prisma.favorite.upsert({
    where: { userId_movieId: { userId: req.user.id, movieId } },
    create: { userId: req.user.id, movieId },
    update: {}
  });
  res.json({ favorite: true });
}));

router.delete("/favorites/:movieId", asyncHandler(async (req, res) => {
  const movieId = z.string().uuid().parse(req.params.movieId);
  await prisma.favorite.deleteMany({ where: { userId: req.user.id, movieId } });
  res.json({ favorite: false });
}));

export default router;
