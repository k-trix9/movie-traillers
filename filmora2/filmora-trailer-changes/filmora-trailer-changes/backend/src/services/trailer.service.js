import { getMovieTrailer, TmdbError } from "./tmdb.service.js";

/**
 * Saves TMDB trailers into the existing MovieMedia table (mediaType = "trailer").
 * The Prisma client is passed in as "db" so these functions are easy to test
 * and never create a second database connection.
 */

export function releaseYearOf(movie) {
  if (!movie?.releaseDate) return null;
  const year = new Date(movie.releaseDate).getUTCFullYear();
  return Number.isFinite(year) ? year : null;
}

/**
 * Find and save the trailer for one movie.
 * Returns { status, trailer? } where status is:
 *   "created"          - a new MovieMedia row was added
 *   "updated"          - the existing trailer row was updated (no duplicate)
 *   "skipped_existing" - a trailer already exists and overwrite was not requested
 *   "not_found"        - TMDB has no suitable official trailer/teaser
 * Throws TmdbError if TMDB itself fails (missing key, rate limit, network...).
 */
export async function importTrailerForMovie(db, movie, { overwrite = false } = {}) {
  const existing = await db.movieMedia.findFirst({
    where: { movieId: movie.id, mediaType: "trailer" },
    orderBy: { createdAt: "asc" }
  });

  if (existing?.fileUrl && !overwrite) {
    return { status: "skipped_existing" };
  }

  const trailer = await getMovieTrailer(movie.title, releaseYearOf(movie));
  if (!trailer) return { status: "not_found" };

  const data = {
    mediaType: "trailer",
    storageProvider: "tmdb",
    storageKey: trailer.key,
    fileUrl: trailer.url
  };

  if (existing) {
    await db.movieMedia.update({ where: { id: existing.id }, data });
    return { status: "updated", trailer };
  }

  await db.movieMedia.create({ data: { movieId: movie.id, ...data } });
  return { status: "created", trailer };
}

/**
 * Add trailers to movies that do not have one yet.
 * Goes one movie at a time with a short pause (gentle on TMDB's rate limit)
 * and stops early on errors that would fail for every movie.
 */
export async function backfillMissingTrailers(db, {
  limit = 200,
  delayMs = 300,
  dryRun = false,
  log = () => {}
} = {}) {
  const movies = await db.movie.findMany({
    where: {
      media: { none: { mediaType: "trailer", fileUrl: { not: null } } }
    },
    select: { id: true, title: true, releaseDate: true },
    orderBy: { createdAt: "asc" },
    take: limit
  });

  const summary = {
    checked: movies.length,
    created: 0,
    updated: 0,
    notFound: 0,
    failed: 0,
    stoppedEarly: null
  };

  for (const movie of movies) {
    if (dryRun) {
      log(`[dry run] would look up: ${movie.title} (${releaseYearOf(movie) ?? "year unknown"})`);
      continue;
    }

    try {
      const result = await importTrailerForMovie(db, movie);
      if (result.status === "created") summary.created += 1;
      else if (result.status === "updated") summary.updated += 1;
      else if (result.status === "not_found") summary.notFound += 1;
      log(`${movie.title}: ${result.status}`);
    } catch (error) {
      if (error instanceof TmdbError) {
        summary.failed += 1;
        log(`${movie.title}: TMDB problem (${error.code})`);
        if (["NO_API_KEY", "AUTH_FAILED", "RATE_LIMITED"].includes(error.code)) {
          summary.stoppedEarly = error.code;
          break;
        }
      } else {
        throw error;
      }
    }

    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return summary;
}
