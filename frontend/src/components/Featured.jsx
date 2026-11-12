import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { yearOf } from "../lib/format.js";

export default function Featured({ user }) {
  const [movie, setMovie] = useState(null);

  useEffect(() => {
    let alive = true;
    api("/api/movies/featured")
      .then((data) => alive && setMovie(data.movie || null))
      .catch(() => alive && setMovie(null));
    return () => { alive = false; };
  }, [user?.id]);

  if (!movie) return null;

  const image = movie.backdropUrl || movie.posterUrl;
  const style = image
    ? { backgroundImage: `linear-gradient(90deg,rgba(9,9,15,.95) 25%,rgba(9,9,15,.35)),url("${encodeURI(image)}")` }
    : undefined;
  const meta = [yearOf(movie.releaseDate), movie.ageRating, (movie.genres || []).join(", ")]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="section" id="featured-section">
      <p className="eyebrow">FEATURED</p>
      <div className="featured-card" style={style}>
        <div className="featured-text">
          <h2>{movie.title}</h2>
          <p className="muted">{meta}</p>
          <p>{movie.description || ""}</p>
          <Link className="button button-primary button-large" to={`/movie/${encodeURIComponent(movie.slug)}`}>
            Watch now
          </Link>
        </div>
      </div>
    </section>
  );
}
