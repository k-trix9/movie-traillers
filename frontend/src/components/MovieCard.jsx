import { Link } from "react-router-dom";
import { formatDuration, yearOf } from "../lib/format.js";

export default function MovieCard({ movie, positionSeconds = 0 }) {
  const href = `/movie/${encodeURIComponent(movie.slug)}`;
  const details = [yearOf(movie.releaseDate), movie.ageRating, formatDuration(movie.durationSeconds)]
    .filter(Boolean)
    .join(" · ");
  const progress =
    positionSeconds > 0 && movie.durationSeconds
      ? Math.min(100, Math.round((positionSeconds / movie.durationSeconds) * 100))
      : null;

  return (
    <article className="movie-card">
      <Link className="movie-poster-link" to={href} aria-label={`Open ${movie.title}`}>
        <div className={`movie-poster${movie.posterUrl ? " has-image" : ""}`}>
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <span>{movie.title}</span>
          )}
        </div>
        {progress !== null && (
          <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
        )}
      </Link>
      <div className="movie-info">
        <h3>{movie.title}</h3>
        <p>{details || (movie.genres || []).join(", ") || "Movie"}</p>
        <Link className="button button-outline" to={href}>
          {positionSeconds > 0 ? "Resume" : "View movie"}
        </Link>
      </div>
    </article>
  );
}
