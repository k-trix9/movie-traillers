import test from "node:test";
import assert from "node:assert/strict";

// env.js validates these when it is imported, so set them first.
process.env.DATABASE_URL ||= "postgresql://x:x@localhost:5432/x";
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-123";
process.env.TMDB_API_KEY = "test-key";

const { getMovieTrailer, clearTrailerCache, TmdbError } = await import("../src/services/tmdb.service.js");
const { importTrailerForMovie, backfillMissingTrailers } = await import("../src/services/trailer.service.js");
const { serializeMovie } = await import("../src/services/catalog.service.js");

const realFetch = globalThis.fetch;
let calls = [];

// Fake TMDB. "routes" maps a URL path to a response body or a status number.
function fakeTmdb(routes) {
  calls = [];
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    calls.push(u.pathname + u.search);
    const handler = routes[u.pathname];
    const body = typeof handler === "function" ? handler(u) : handler;
    if (typeof body === "number") {
      return new Response("{}", { status: body, headers: { "retry-after": "7" } });
    }
    return new Response(JSON.stringify(body ?? {}), { status: 200 });
  };
}

test.beforeEach(() => clearTrailerCache());
test.after(() => { globalThis.fetch = realFetch; });

const video = (o) => ({ site: "YouTube", official: true, type: "Trailer", key: "abcdefghijk", name: "T", size: 1080, published_at: "2024-01-01", ...o });

test("finds the movie and returns a YouTube embed URL", async () => {
  fakeTmdb({
    "/3/search/movie": { results: [{ id: 1, title: "Dune", release_date: "2021-10-22" }] },
    "/3/movie/1/videos": { results: [video({ key: "n9xhJrPXop4" })] }
  });
  const t = await getMovieTrailer("Dune", 2021);
  assert.equal(t.url, "https://www.youtube.com/embed/n9xhJrPXop4");
  assert.ok(!JSON.stringify(calls).includes("undefined"));
});

test("does not accept a wrong movie with a different title or year", async () => {
  fakeTmdb({
    "/3/search/movie": { results: [
      { id: 2, title: "Dune", release_date: "1984-12-14" },
      { id: 3, title: "Dune: Part Two", release_date: "2024-02-27" }
    ] },
    "/3/movie/2/videos": { results: [video({})] },
    "/3/movie/3/videos": { results: [video({})] }
  });
  assert.equal(await getMovieTrailer("Dune", 2021), null);
  assert.ok(!calls.some((c) => c.includes("/videos")), "must not fetch videos for a wrong match");
});

test("prefers official Trailer over Teaser, ignores unofficial and non-YouTube", async () => {
  fakeTmdb({
    "/3/search/movie": { results: [{ id: 1, title: "Film", release_date: "2020-05-01" }] },
    "/3/movie/1/videos": { results: [
      video({ type: "Teaser", key: "teaser00001" }),
      video({ official: false, key: "unoffic0001" }),
      video({ site: "Vimeo", key: "vimeo000001" }),
      video({ key: "good0000001" })
    ] }
  });
  assert.equal((await getMovieTrailer("Film", 2020)).key, "good0000001");
});

test("falls back to an official Teaser when there is no official Trailer", async () => {
  fakeTmdb({
    "/3/search/movie": { results: [{ id: 1, title: "Film", release_date: "2020-05-01" }] },
    "/3/movie/1/videos": { results: [video({ type: "Teaser", key: "teaser00001" }), video({ type: "Clip" })] }
  });
  assert.equal((await getMovieTrailer("Film", 2020)).type, "Teaser");
});

test("rejects video keys that are not valid YouTube ids", async () => {
  fakeTmdb({
    "/3/search/movie": { results: [{ id: 1, title: "Film", release_date: "2020-05-01" }] },
    "/3/movie/1/videos": { results: [video({ key: "x\"><script>" })] }
  });
  assert.equal(await getMovieTrailer("Film", 2020), null);
});

test("returns null when there are no videos", async () => {
  fakeTmdb({
    "/3/search/movie": { results: [{ id: 1, title: "Film", release_date: "2020-05-01" }] },
    "/3/movie/1/videos": { results: [] }
  });
  assert.equal(await getMovieTrailer("Film", 2020), null);
});

test("caches results so TMDB is not asked twice", async () => {
  fakeTmdb({
    "/3/search/movie": { results: [{ id: 1, title: "Film", release_date: "2020-05-01" }] },
    "/3/movie/1/videos": { results: [video({})] }
  });
  await getMovieTrailer("Film", 2020);
  const first = calls.length;
  await getMovieTrailer("Film", 2020);
  assert.equal(calls.length, first);
});

test("rate limit becomes a TmdbError and is not cached", async () => {
  fakeTmdb({ "/3/search/movie": 429 });
  await assert.rejects(() => getMovieTrailer("Film", 2020),
    (e) => e instanceof TmdbError && e.code === "RATE_LIMITED" && e.retryAfterSeconds === 7);
  fakeTmdb({
    "/3/search/movie": { results: [{ id: 1, title: "Film", release_date: "2020-05-01" }] },
    "/3/movie/1/videos": { results: [video({})] }
  });
  assert.ok(await getMovieTrailer("Film", 2020));
});

test("network failure becomes a TmdbError without leaking the API key", async () => {
  globalThis.fetch = async () => { throw new Error("connect ECONNREFUSED ?api_key=test-key"); };
  await assert.rejects(() => getMovieTrailer("Film", 2020),
    (e) => e.code === "NETWORK" && !e.message.includes("test-key"));
});

// ---------- saving into MovieMedia (fake database) ----------
function fakeDb(initialMedia = []) {
  const media = [...initialMedia];
  return {
    media,
    movieMedia: {
      findFirst: async ({ where }) => media.find((m) => m.movieId === where.movieId && m.mediaType === where.mediaType) || null,
      create: async ({ data }) => { media.push({ id: `m${media.length + 1}`, ...data }); },
      update: async ({ where, data }) => Object.assign(media.find((m) => m.id === where.id), data)
    }
  };
}
const goodTmdb = () => fakeTmdb({
  "/3/search/movie": { results: [{ id: 1, title: "Film", release_date: "2020-05-01" }] },
  "/3/movie/1/videos": { results: [video({ key: "good0000001" })] }
});
const movie = { id: "mov-1", title: "Film", releaseDate: new Date("2020-05-01") };

test("creates a trailer row when missing", async () => {
  goodTmdb();
  const db = fakeDb();
  assert.equal((await importTrailerForMovie(db, movie)).status, "created");
  assert.equal(db.media.length, 1);
  assert.equal(db.media[0].movieId, "mov-1");
  assert.equal(db.media[0].fileUrl, "https://www.youtube.com/embed/good0000001");
});

test("updates (never duplicates) an existing trailer when overwrite is requested", async () => {
  goodTmdb();
  const db = fakeDb([{ id: "m1", movieId: "mov-1", mediaType: "trailer", fileUrl: "https://www.youtube.com/embed/old00000000" }]);
  assert.equal((await importTrailerForMovie(db, movie, { overwrite: true })).status, "updated");
  assert.equal(db.media.length, 1);
  assert.equal(db.media[0].fileUrl, "https://www.youtube.com/embed/good0000001");
});

test("keeps an existing trailer and makes no TMDB request by default", async () => {
  goodTmdb();
  const db = fakeDb([{ id: "m1", movieId: "mov-1", mediaType: "trailer", fileUrl: "https://www.youtube.com/embed/old00000000" }]);
  assert.equal((await importTrailerForMovie(db, movie)).status, "skipped_existing");
  assert.equal(calls.length, 0);
});

test("backfill stops early when TMDB rejects the key and never throws", async () => {
  fakeTmdb({ "/3/search/movie": 401 });
  const db = { ...fakeDb(), movie: { findMany: async () => [movie, { ...movie, id: "mov-2" }] } };
  const summary = await backfillMissingTrailers(db, { delayMs: 0 });
  assert.equal(summary.stoppedEarly, "AUTH_FAILED");
  assert.equal(summary.failed, 1);
});

test("a missing TMDB key gives a clear NO_API_KEY error and makes no request", async () => {
  const { env } = await import("../src/config/env.js");
  const saved = env.TMDB_API_KEY;
  env.TMDB_API_KEY = "";
  fakeTmdb({});
  try {
    await assert.rejects(() => getMovieTrailer("Film", 2020), (e) => e.code === "NO_API_KEY");
    assert.equal(calls.length, 0);
  } finally {
    env.TMDB_API_KEY = saved;
  }
});

// ---------- public API safety ----------
test("public movie output returns trailerUrl and never private storage details", () => {
  const out = serializeMovie({
    id: "1", title: "Film", slug: "film",
    media: [{ mediaType: "trailer", fileUrl: "https://www.youtube.com/embed/good0000001", storageKey: "secret" }],
    videoAssets: [{ providerVideoUid: "CLOUDFLARE-SECRET" }]
  });
  assert.equal(out.trailerUrl, "https://www.youtube.com/embed/good0000001");
  assert.ok(!JSON.stringify(out).includes("CLOUDFLARE-SECRET"));
  assert.ok(!JSON.stringify(out).includes("secret"));
});

test("movie without a trailer gives trailerUrl: null", () => {
  assert.equal(serializeMovie({ id: "1", title: "F", slug: "f", media: [] }).trailerUrl, null);
});
