
import { env } from "../config/env.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function getMovieTrailer(movieTitle) {
  if (!env.TMDB_API_KEY) {
    throw new Error("TMDB API key is not configured.");
  }

  const searchUrl = new URL(`${TMDB_BASE_URL}/search/movie`);

  searchUrl.searchParams.set("query", movieTitle);
  searchUrl.searchParams.set("api_key", env.TMDB_API_KEY);

  const searchResponse = await fetch(searchUrl);

  if (!searchResponse.ok) {
    throw new Error(`TMDB movie search failed: ${searchResponse.status}`);
  }

  const searchData = await searchResponse.json();
  const movie = searchData.results?.[0];

  if (!movie) return null;

  const videosUrl = new URL(
    `${TMDB_BASE_URL}/movie/${movie.id}/videos`
  );

  videosUrl.searchParams.set("api_key", env.TMDB_API_KEY);

  const videosResponse = await fetch(videosUrl);

  if (!videosResponse.ok) {
    throw new Error(`TMDB trailer request failed: ${videosResponse.status}`);
  }

  const videosData = await videosResponse.json();

  const trailer = videosData.results?.find(video =>
    video.site === "YouTube" &&
    video.type === "Trailer" &&
    video.official === true
  );

  if (!trailer) return null;

  return {
    name: trailer.name,
    key: trailer.key,
    url: `https://www.youtube.com/embed/${trailer.key}`,
    thumbnail: `https://img.youtube.com/vi/${trailer.key}/hqdefault.jpg`
  };
}
