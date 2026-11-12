
import { Router } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireAdministrator } from "../middleware/auth.js";
import { createTusUploadUrl, getCloudflareVideo } from "../services/cloudflare.service.js";
import { TmdbError } from "../services/tmdb.service.js";
import { importTrailerForMovie } from "../services/trailer.service.js";

const router = Router();
router.use(requireAuth, requireAdministrator);

const movieSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional(),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ageRating: z.string().trim().max(20).optional(),
  originalLanguage: z.string().trim().max(20).optional(),
  licenseReference: z.string().trim().min(2).max(180),
  rightsHolder: z.string().trim().min(2).max(180),
  territory: z.string().trim().min(2).max(20),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}).refine(
  (value) => !value.validFrom || !value.validUntil || value.validUntil >= value.validFrom,
  {
    message: "Licence expiry must be on or after the start date.",
    path: ["validUntil"]
  }
);

async function audit(adminUserId, action, entityType, entityId, metadata = undefined) {
  await prisma.adminActivityLog.create({
    data: { adminUserId, action, entityType, entityId, metadata }
  });
}

// Dashboard statistics
router.get("/dashboard", asyncHandler(async (req, res) => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [users, activeSubscriptions, movies, pendingPayments, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({
      where: { status: "ACTIVE", currentPeriodEnd: { gt: new Date() } }
    }),
    prisma.movie.count(),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.payment.aggregate({
      where: {
        status: "SUCCESSFUL",
        currency: "USD",
        paidAt: { gte: monthStart }
      },
      _sum: { amount: true }
    })
  ]);

  res.json({
    stats: {
      users,
      activeSubscriptions,
      movies,
      pendingPayments,
      monthRevenue: Number(revenue._sum.amount || 0)
    }
  });
}));

// Get users
router.get("/users", asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      accountStatus: true,
      createdAt: true,
      roles: { include: { role: { select: { name: true } } } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  res.json({ users });
}));

// Get payments
router.get("/payments", asyncHandler(async (req, res) => {
  const payments = await prisma.payment.findMany({
    include: {
      user: { select: { email: true, fullName: true } },
      planPrice: { include: { plan: { select: { name: true } } } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  res.json({
    payments: payments.map((payment) => ({
      id: payment.id,
      reference: payment.reference,
      customer: payment.user.email,
      plan: payment.planPrice.plan.name,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt
    }))
  });
}));

// Get subscriptions
router.get("/subscriptions", asyncHandler(async (req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    include: {
      user: { select: { email: true, fullName: true } },
      plan: { select: { name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  res.json({
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      customer: subscription.user.email,
      plan: subscription.plan.name,
      status: subscription.currentPeriodEnd > new Date()
        ? subscription.status
        : "EXPIRED",
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
    }))
  });
}));

// Get movies
router.get("/movies", asyncHandler(async (req, res) => {
  const movies = await prisma.movie.findMany({
    include: {
      licenses: true,
      videoAssets: true,
      media: true,
      genres: { include: { genre: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  res.json({
    movies: movies.map((movie) => ({
      ...movie,
      videoAssets: movie.videoAssets.map((asset) => ({
        ...asset,
        sizeBytes: asset.sizeBytes === null ? null : asset.sizeBytes.toString()
      }))
    }))
  });
}));

// Import an official YouTube trailer from TMDB.
// IMPORTANT: This route must stay outside the movie creation route.
router.post("/movies/:movieId/tmdb-trailer", asyncHandler(async (req, res) => {
  const movie = await prisma.movie.findUnique({
    where: { id: req.params.movieId }
  });

  if (!movie) {
    throw new HttpError(404, "Movie not found.");
  }

  let result;

  try {
    // overwrite: true because an administrator pressed the button on purpose.
    result = await importTrailerForMovie(prisma, movie, { overwrite: true });
  } catch (error) {
    if (error instanceof TmdbError) {
      if (error.code === "NO_API_KEY") {
        throw new HttpError(503, "TMDB is not configured. Add TMDB_API_KEY to backend/.env.");
      }
      if (error.code === "RATE_LIMITED") {
        throw new HttpError(429, "TMDB rate limit reached. Please try again in a few minutes.");
      }
      throw new HttpError(502, "Could not get the trailer from TMDB right now. Please try again later.");
    }
    throw error;
  }

  if (result.status === "not_found") {
    throw new HttpError(404, "No official YouTube trailer found for this movie.");
  }

  const trailer = result.trailer;

  await audit(req.user.id, "movie.trailer_imported", "movie", movie.id);

  res.json({
    message: "Trailer imported successfully.",
    trailer
  });
}));

// Create a new movie
router.post("/movies", asyncHandler(async (req, res) => {
  const input = movieSchema.parse(req.body);

  const slugBase = input.title.toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 240);

  const slug = `${slugBase || "movie"}-${randomUUID().slice(0, 8)}`;

  const movie = await prisma.movie.create({
    data: {
      title: input.title,
      slug,
      description: input.description,
      releaseDate: input.releaseDate ? new Date(input.releaseDate) : null,
      ageRating: input.ageRating,
      originalLanguage: input.originalLanguage,
      publicationStatus: "DRAFT",
      licenses: {
        create: {
          licenseReference: input.licenseReference,
          rightsHolder: input.rightsHolder,
          territory: input.territory.toUpperCase(),
          validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          permittedDistribution: false,
          status: "PENDING"
        }
      }
    },
    include: { licenses: true }
  });

  await audit(req.user.id, "movie.created", "movie", movie.id);

  // Fetch the TMDB trailer in the background. If TMDB is down or has no
  // trailer, movie creation is not affected.
  importTrailerForMovie(prisma, movie).catch((error) => {
    console.warn(`Trailer import skipped for "${movie.title}": ${error.code || error.message}`);
  });

  res.status(201).json({ movie });
}));

// Verify a movie license
router.patch("/licenses/:licenseId/verify", asyncHandler(async (req, res) => {
  const input = z.object({
    verificationNotes: z.string().trim().max(2000).optional()
  }).parse(req.body);

  const license = await prisma.contentLicense.findUnique({
    where: { id: req.params.licenseId }
  });

  if (!license) {
    throw new HttpError(404, "License record not found.");
  }

  const updated = await prisma.contentLicense.update({
    where: { id: license.id },
    data: {
      status: "VERIFIED",
      permittedDistribution: true,
      verificationNotes: input.verificationNotes || "Verified by administrator."
    }
  });

  await audit(req.user.id, "license.verified", "content_license", updated.id);
  res.json({ license: updated });
}));

// Create Cloudflare upload URL
router.post("/movies/:movieId/upload-url", asyncHandler(async (req, res) => {
  const input = z.object({
    fileName: z.string().trim().min(1).max(255),
    fileSize: z.number().int().positive().max(30 * 1024 * 1024 * 1024)
  }).parse(req.body);

  const movie = await prisma.movie.findUnique({
    where: { id: req.params.movieId },
    include: { licenses: true }
  });

  if (!movie) {
    throw new HttpError(404, "Movie not found.");
  }

  const now = new Date();

  const hasVerifiedLicense = movie.licenses.some((license) =>
    license.status === "VERIFIED" &&
    license.permittedDistribution &&
    license.validFrom <= now &&
    (!license.validUntil || license.validUntil >= now)
  );

  if (!hasVerifiedLicense) {
    throw new HttpError(403, "Verify a valid distribution license before uploading the movie.");
  }

  const safeName = path.basename(input.fileName).replace(/[^\w.\- ]/g, "_");

  const upload = await createTusUploadUrl({
    fileSize: input.fileSize,
    fileName: safeName,
    creatorId: req.user.id
  });

  await prisma.videoAsset.create({
    data: {
      movieId: movie.id,
      provider: "cloudflare_stream",
      providerVideoUid: upload.videoUid,
      processingStatus: "UPLOAD_PENDING",
      playbackStatus: "RESTRICTED",
      sizeBytes: BigInt(input.fileSize)
    }
  });

  await prisma.movie.update({
    where: { id: movie.id },
    data: { publicationStatus: "PROCESSING" }
  });

  await audit(req.user.id, "video.upload_url_created", "movie", movie.id, {
    videoUid: upload.videoUid
  });

  res.status(201).json({
    uploadUrl: upload.uploadUrl,
    videoUid: upload.videoUid,
    expiresAt: upload.expiresAt,
    uploadProtocol: "tus"
  });
}));

// Refresh Cloudflare video status
router.post("/videos/:videoUid/refresh", asyncHandler(async (req, res) => {
  const asset = await prisma.videoAsset.findUnique({
    where: { providerVideoUid: req.params.videoUid }
  });

  if (!asset) {
    throw new HttpError(404, "Video asset not found.");
  }

  const remote = await getCloudflareVideo(asset.providerVideoUid);
  const ready = Boolean(remote.readyToStream);
  const privateVideo = Boolean(remote.requireSignedURLs);
  const state = remote.status?.state;

  const processingStatus = ready
    ? "READY"
    : state === "error"
      ? "ERROR"
      : "PROCESSING";

  const updated = await prisma.videoAsset.update({
    where: { id: asset.id },
    data: {
      processingStatus,
      playbackStatus: ready && privateVideo ? "AVAILABLE" : "RESTRICTED",
      durationSeconds: Number.isFinite(Number(remote.duration))
        ? Math.round(Number(remote.duration))
        : null,
      readyAt: remote.readyToStreamAt ? new Date(remote.readyToStreamAt) : null
    }
  });

  await audit(req.user.id, "video.status_refreshed", "video_asset", asset.id, {
    processingStatus
  });

  res.json({
    videoAsset: {
      ...updated,
      sizeBytes: updated.sizeBytes === null ? null : updated.sizeBytes.toString()
    }
  });
}));

// Movie details schema
const detailsSchema = z.object({
  description: z.string().trim().max(5000).optional(),
  featured: z.boolean().optional(),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 12).nullable().optional(),
  posterUrl: z.string().trim().url().max(1000).or(z.literal("")).optional(),
  backdropUrl: z.string().trim().url().max(1000).or(z.literal("")).optional(),
  genres: z.array(z.string().trim().min(2).max(60)).max(8).optional()
});

function slugify(value) {
  return value.toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

// Update poster, backdrop, genres, description and featured flag
router.patch("/movies/:movieId/details", asyncHandler(async (req, res) => {
  const input = detailsSchema.parse(req.body);

  const movie = await prisma.movie.findUnique({
    where: { id: req.params.movieId }
  });

  if (!movie) {
    throw new HttpError(404, "Movie not found.");
  }

  for (const key of ["posterUrl", "backdropUrl"]) {
    if (input[key] && !input[key].startsWith("https://")) {
      throw new HttpError(422, "Artwork URLs must start with https://");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.movie.update({
      where: { id: movie.id },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.featured !== undefined ? { featured: input.featured } : {}),
        ...(input.durationSeconds !== undefined
          ? { durationSeconds: input.durationSeconds }
          : {})
      }
    });

    for (const [field, mediaType] of [
      ["posterUrl", "poster"],
      ["backdropUrl", "backdrop"]
    ]) {
      if (input[field] === undefined) continue;

      await tx.movieMedia.deleteMany({
        where: { movieId: movie.id, mediaType }
      });

      if (input[field]) {
        await tx.movieMedia.create({
          data: {
            movieId: movie.id,
            mediaType,
            fileUrl: input[field]
          }
        });
      }
    }

    if (input.genres) {
      await tx.movieGenre.deleteMany({
        where: { movieId: movie.id }
      });

      for (const name of [...new Set(input.genres)]) {
        const slug = slugify(name);
        if (!slug) continue;

        const genre = await tx.genre.upsert({
          where: { slug },
          update: {},
          create: { name, slug }
        });

        await tx.movieGenre.create({
          data: {
            movieId: movie.id,
            genreId: genre.id
          }
        });
      }
    }
  });

  await audit(req.user.id, "movie.details_updated", "movie", movie.id);
  res.json({ updated: true });
}));

// Unpublish a movie
router.patch("/movies/:movieId/unpublish", asyncHandler(async (req, res) => {
  const movie = await prisma.movie.findUnique({
    where: { id: req.params.movieId }
  });

  if (!movie) {
    throw new HttpError(404, "Movie not found.");
  }

  const updated = await prisma.movie.update({
    where: { id: movie.id },
    data: { publicationStatus: "UNPUBLISHED" }
  });

  await audit(req.user.id, "movie.unpublished", "movie", movie.id);
  res.json({ movie: updated });
}));

// Change user account status
router.patch("/users/:userId/status", asyncHandler(async (req, res) => {
  const { accountStatus } = z.object({
    accountStatus: z.enum(["ACTIVE", "SUSPENDED"])
  }).parse(req.body);

  if (req.params.userId === req.user.id) {
    throw new HttpError(409, "You cannot change your own account status.");
  }

  const user = await prisma.user.update({
    where: { id: req.params.userId },
    data: { accountStatus },
    select: { id: true, accountStatus: true }
  });

  await audit(req.user.id, `user.${accountStatus.toLowerCase()}`, "user", user.id);
  res.json({ user });
}));

// Publish a movie
router.patch("/movies/:movieId/publish", asyncHandler(async (req, res) => {
  const movie = await prisma.movie.findUnique({
    where: { id: req.params.movieId },
    include: { licenses: true, videoAssets: true }
  });

  if (!movie) {
    throw new HttpError(404, "Movie not found.");
  }

  const now = new Date();

  const validLicense = movie.licenses.some((license) =>
    license.status === "VERIFIED" &&
    license.permittedDistribution &&
    license.validFrom <= now &&
    (!license.validUntil || license.validUntil >= now)
  );

  const readyVideo = movie.videoAssets.some((asset) =>
    asset.processingStatus === "READY" &&
    asset.playbackStatus === "AVAILABLE"
  );

  if (!validLicense) {
    throw new HttpError(409, "A verified, currently valid distribution license is required.");
  }

  if (!readyVideo) {
    throw new HttpError(409, "The video must be ready and protected by signed playback URLs before publication.");
  }

  const updated = await prisma.movie.update({
    where: { id: movie.id },
    data: { publicationStatus: "PUBLISHED" }
  });

  await audit(req.user.id, "movie.published", "movie", movie.id);
  res.json({ movie: updated });
}));

export default router;
