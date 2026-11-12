import { env } from "../config/env.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const REQUEST_TIMEOUT_MS = 8000;

// Simple in-memory cache so the same title is not asked from TMDB again and again.
// Successful lookups are kept for a day; "no trailer found" for an hour.
// Errors (rate limit, network) are never cached.
const FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const cache = new Map();

/**
 * Error type for problems talking to TMDB.
 * code is one of: NO_API_KEY, AUTH_FAILED, RATE_LIMITED, TIMEOUT, NETWORK, HTTP_ERROR
 */
export class TmdbError extends Error {
  constructor(code, message, retryAfterSeconds = null) {
    super(message);
    this.name = "TmdbError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function clearTrailerCache() {
  cache.clear();
}

async function tmdbGet(path, params = {}) {
  if (!env.TMDB_API_KEY) {
    throw new TmdbError("NO_API_KEY", "TMDB API key is not configured.");
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set("api_key", env.TMDB_API_KEY);

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    // The message is written by us so the API key can never leak into logs.
    throw new TmdbError(
      error?.name === "TimeoutError" ? "TIMEOUT" : "NETWORK",
      "Could not reach TMDB."
    );
  }

  if (response.status === 429) {
    const retryAfter = Number.parseInt(response.headers.get("retry-after") || "", 10);
    throw new TmdbError(
      "RATE_LIMITED",
      "TMDB rate limit reached. Try again later.",
      Number.isFinite(retryAfter) ? retryAfter : null
    );
  }

  if (response.status === 401) {
    throw new TmdbError("AUTH_FAILED", "TMDB rejected the API key.");
  }

  if (!response.ok) {
    throw new TmdbError("HTTP_ERROR", `TMDB request failed: ${response.status}`);
  }

  return response.json();
}

// "Spider-Man: No Way Home" and "spider man no way home" become the same text.
function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function yearOf(dateText) {
  const year = Number.parseInt(String(dateText || "").slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * Choose the correct TMDB movie from search results.
 * - The title must match exactly (ignoring capitals and punctuation).
 * - If we know the release year, the movie must be within 1 year of it.
 * Anything else is treated as "no match" instead of guessing a wrong movie.
 */
function pickBestMatch(results, title, year) {
  const wanted = normalizeTitle(title);
  if (!wanted || !Array.isArray(results)) return null;

  const exact = results.filter((item) =>
    normalizeTitle(item.title) === wanted ||
    normalizeTitle(item.original_title) === wanted
  );

  if (!year) return exact[0] || null;

  return exact.find((item) => {
    const itemYear = yearOf(item.release_date);
    return itemYear !== null && Math.abs(itemYear - year) <= 1;
  }) || null;
}

async function findTmdbMovie(title, year) {
  if (year) {
    const withYear = await tmdbGet("/search/movie", { query: title, year });
    const match = pickBestMatch(withYear.results, title, year);
    if (match) return match;
  }

  const anyYear = await tmdbGet("/search/movie", { query: title });
  return pickBestMatch(anyYear.results, title, year);
}

// Official YouTube trailers first, then official YouTube teasers. Nothing else.
function chooseVideo(videos) {
  const usable = (Array.isArray(videos) ? videos : []).filter((video) =>
    video.site === "YouTube" &&
    video.official === true &&
    (video.type === "Trailer" || video.type === "Teaser") &&
    /^[A-Za-z0-9_-]{11}$/.test(String(video.key || ""))
  );

  const typeRank = (video) => (video.type === "Trailer" ? 0 : 1);

  usable.sort((a, b) =>
    typeRank(a) - typeRank(b) ||
    (Number(b.size) || 0) - (Number(a.size) || 0) ||
    String(b.published_at || "").localeCompare(String(a.published_at || ""))
  );

  return usable[0] || null;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, {
    value,
    expiresAt: Date.now() + (value ? FOUND_TTL_MS : NOT_FOUND_TTL_MS)
  });
}

/**
 * Find the official YouTube trailer (or teaser) for a movie.
 * releaseYear is optional but strongly recommended: it prevents wrong matches.
 * Returns null when no suitable trailer exists. Throws TmdbError on API problems.
 */
export async function getMovieTrailer(movieTitle, releaseYear = null) {
  const title = String(movieTitle || "").trim();
  if (!title) return null;

  const year = Number.isInteger(releaseYear) ? releaseYear : null;
  const cacheKey = `${normalizeTitle(title)}|${year || ""}`;

  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const movie = await findTmdbMovie(title, year);
  if (!movie) {
    cacheSet(cacheKey, null);
    return null;
  }

  const videosData = await tmdbGet(`/movie/${movie.id}/videos`);
  const video = chooseVideo(videosData.results);

  if (!video) {
    cacheSet(cacheKey, null);
    return null;
  }

  const result = {
    name: video.name,
    key: video.key,
    type: video.type,
    tmdbId: movie.id,
    url: `https://www.youtube.com/embed/${video.key}`,
    thumbnail: `https://img.youtube.com/vi/${video.key}/hqdefault.jpg`
  };

  cacheSet(cacheKey, result);
  return result;
}
