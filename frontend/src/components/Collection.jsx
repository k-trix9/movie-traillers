import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import MovieCard from "./MovieCard.jsx";

export default function Collection({ user }) {
  const [genres, setGenres] = useState([]);
  const [activeGenre, setActiveGenre] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [movies, setMovies] = useState([]);
  const [message, setMessage] = useState("Loading…");

  useEffect(() => {
    let alive = true;
    api("/api/movies/genres")
      .then((data) => alive && setGenres(data.genres))
      .catch(() => alive && setGenres([]));
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    let alive = true;
    setMessage("Loading…");

    const query = new URLSearchParams({ limit: "24" });
    if (activeSearch) query.set("q", activeSearch);
    if (activeGenre) query.set("genre", activeGenre);

    api(`/api/movies?${query}`)
      .then((data) => {
        if (!alive) return;
        setMovies(data.movies);
        if (data.movies.length) {
          setMessage("");
        } else {
          setMessage(
            activeSearch || activeGenre
              ? "No movies match your search."
              : "No movies are available yet. Check back soon — new titles are added as streaming rights are confirmed."
          );
        }
      })
      .catch((error) => {
        if (!alive) return;
        setMovies([]);
        setMessage(error.message);
      });

    return () => { alive = false; };
  }, [activeGenre, activeSearch, user?.id]);

  function handleSearch(event) {
    event.preventDefault();
    setActiveSearch(searchInput.trim());
  }

  return (
    <section className="section" id="movies">
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE COLLECTION</p>
          <h2>Find your next favourite</h2>
        </div>
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Search movies..."
            aria-label="Search movies"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button className="button button-outline" type="submit">Search</button>
        </form>
      </div>

      {genres.length > 0 && (
        <div className="chips" aria-label="Filter by genre">
          <button type="button" className={`chip${activeGenre === "" ? " active" : ""}`} onClick={() => setActiveGenre("")}>
            All
          </button>
          {genres.map((genre) => (
            <button
              key={genre.slug}
              type="button"
              className={`chip${activeGenre === genre.slug ? " active" : ""}`}
              onClick={() => setActiveGenre(genre.slug)}
            >
              {genre.name}
            </button>
          ))}
        </div>
      )}

      <div className="movie-grid">
        {movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
      </div>
      <p className="muted">{message}</p>
    </section>
  );
}
