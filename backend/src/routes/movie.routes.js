
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/async-handler.js";
import {
  movieInclude,
  publicCatalogueWhere,
  serializeMovie
} from "../services/catalog.service.js";

const router = Router();

// GET /movies
// Public catalogue: show published movies with valid licences.
router.get("/", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page ?? "1", 10) || 1);
  const limit = Math.min(30, Math.max(1, Number.parseInt(req.query.limit ?? "12", 10) || 12));
  const search = typeof req.query.q === "string"
    ? req.query.q.trim().slice(0, 100)
    : "";
  const genre = typeof req.query.genre === "string"
    ? req.query.genre.trim().slice(0, 100)
    : "";

  const where = publicCatalogueWhere(req, {
    ...(search
      ? { title: { contains: search, mode: "insensitive" } }
      : {}),
    ...(genre
      ? { genres: { some: { genre: { slug: genre } } } }
      : {})
  });

  const [items, total] = await Promise.all([
    prisma.movie.findMany({
      where,
      include: movieInclude,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.movie.count({ where })
  ]);

  res.json({
    movies: items.map(serializeMovie),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

// GET /movies/featured
router.get("/featured", asyncHandler(async (req, res) => {
  const movie = await prisma.movie.findFirst({
    where: publicCatalogueWhere(req, { featured: true }),
    include: movieInclude,
    orderBy: { updatedAt: "desc" }
  });

  res.json({
    movie: movie ? serializeMovie(movie) : null
  });
}));

// GET /movies/genres
router.get("/genres", asyncHandler(async (req, res) => {
  const genres = await prisma.genre.findMany({
    where: {
      movies: {
        some: {
          movie: publicCatalogueWhere(req)
        }
      }
    },
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true
    }
  });

  res.json({ genres });
}));

// GET /movies/:slug
router.get("/:slug", asyncHandler(async (req, res) => {
  const movie = await prisma.movie.findFirst({
    where: publicCatalogueWhere(req, {
      slug: req.params.slug
    }),
    include: movieInclude
  });

  if (!movie) {
    return res.status(404).json({
      error: { message: "Movie not found." }
    });
  }

  res.json({
    movie: serializeMovie(movie)
  });
}));

export default router;
