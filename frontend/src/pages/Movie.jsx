import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Hls from "hls.js";
import { api, apiBackground, ApiError } from "../lib/api.js";
import { formatClock, formatDuration, yearOf } from "../lib/format.js";
import { useAuth } from "../context/AuthContext.jsx";

// One id per browser tab, so two tabs count as two screens for the plan limit.
function getPlayerSessionId() {
  try {
    let id = sessionStorage.getItem("filmora-player-session-id");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("filmora-player-session-id", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
const playerSessionId = getPlayerSessionId();

// Only allow YouTube embed links for the trailer.
function safeTrailerUrl(trailerUrl) {
  if (!trailerUrl) return null;
  try {
    const url = new URL(trailerUrl);
    if (url.protocol !== "https:" || url.hostname !== "www.youtube.com" || !url.pathname.startsWith("/embed/")) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export default function Movie() {
  const { slug } = useParams();
  const { user, loading: authLoading, openAuth } = useAuth();

  const [movie, setMovie] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState({ text: "Loading movie details…", link: null });
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [resumeLabel, setResumeLabel] = useState("");
  const [playDisabled, setPlayDisabled] = useState(true);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const sessionActiveRef = useRef(false);
  const lastSaveRef = useRef(0);
  const resumeRef = useRef(0);
  const movieRef = useRef(null);
  const signedInRef = useRef(false);

  movieRef.current = movie;
  signedInRef.current = Boolean(user);

  const trailerUrl = useMemo(() => safeTrailerUrl(movie?.trailerUrl), [movie]);

  /* ---------- load the movie ---------- */
  useEffect(() => {
    let alive = true;
    setMovie(null);
    setNotFound(false);
    setPlayDisabled(true);
    setResumeLabel("");
    resumeRef.current = 0;
    setMessage({ text: "Loading movie details…", link: null });

    api(`/api/movies/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (!alive) return;
        setMovie(data.movie);
        setPlayDisabled(false);
        document.title = `${data.movie.title} — FILMORA`;
      })
      .catch((error) => {
        if (!alive) return;
        setNotFound(true);
        setMessage({ text: error.message, link: "browse" });
      });

    return () => { alive = false; };
  }, [slug]);

  /* ---------- member extras: My list + resume position ---------- */
  useEffect(() => {
    if (!movie || authLoading) return undefined;
    let alive = true;

    if (!user) {
      setIsFavorite(false);
      setMessage({ text: "Sign in and keep an active monthly membership to start streaming.", link: "signin" });
      return undefined;
    }

    (async () => {
      try {
        const fav = await api(`/api/account/favorites/${movie.id}`);
        const progress = await api(`/api/account/progress/${movie.id}`);
        if (!alive) return;
        setIsFavorite(fav.favorite);
        resumeRef.current = progress.positionSeconds;
        if (progress.positionSeconds > 10) setResumeLabel(`Resume from ${formatClock(progress.positionSeconds)}`);
      } catch {
        /* optional extras */
      }
      if (alive) setMessage({ text: "Press play to start. Your place is saved automatically.", link: null });
    })();

    return () => { alive = false; };
  }, [movie, user, authLoading]);

  /* ---------- player events: progress, heartbeat, screen limit ---------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const stopHeartbeat = () => clearInterval(heartbeatRef.current);

    async function saveProgress(force = false) {
      const current = movieRef.current;
      if (!current || !signedInRef.current || !video.currentTime || video.ended) return;

      const now = Date.now();
      if (!force && now - lastSaveRef.current < 30000) return;

      lastSaveRef.current = now;
      resumeRef.current = Math.floor(video.currentTime);

      try {
        await api("/api/stream/progress", {
          method: "POST",
          body: JSON.stringify({ movieId: current.id, positionSeconds: resumeRef.current })
        });
      } catch {
        /* best effort */
      }
    }

    async function sendHeartbeat() {
      try {
        await api("/api/stream/heartbeat", { method: "POST", body: JSON.stringify({ playerSessionId }) });
      } catch (error) {
        setMessage({ text: error.message, link: null });
        video.pause();
        hlsRef.current?.stopLoad();
        stopHeartbeat();
        sessionActiveRef.current = false;
      }
    }

    function startHeartbeat() {
      stopHeartbeat();
      if (!sessionActiveRef.current) return;
      sendHeartbeat();
      heartbeatRef.current = setInterval(sendHeartbeat, 45 * 1000);
    }

    const onTimeUpdate = () => saveProgress(false);
    const onPause = () => {
      stopHeartbeat();
      saveProgress(true);
    };
    const onEnded = () => {
      stopHeartbeat();
      sessionActiveRef.current = false;
      const current = movieRef.current;
      if (current && signedInRef.current) {
        apiBackground("/api/stream/progress", { movieId: current.id, positionSeconds: 0 });
      }
      apiBackground("/api/stream/session/end", { playerSessionId });
    };

    // Free the screen slot when the viewer leaves the page or the component.
    function leave() {
      if (!sessionActiveRef.current) return;
      const current = movieRef.current;
      if (current && video.currentTime) {
        apiBackground("/api/stream/progress", { movieId: current.id, positionSeconds: Math.floor(video.currentTime) });
      }
      apiBackground("/api/stream/session/end", { playerSessionId });
      sessionActiveRef.current = false;
    }

    video.addEventListener("play", startHeartbeat);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    window.addEventListener("pagehide", leave);

    return () => {
      video.removeEventListener("play", startHeartbeat);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      window.removeEventListener("pagehide", leave);
      leave();
      stopHeartbeat();
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, []);

  /* ---------- actions ---------- */
  async function toggleFavorite() {
    if (!movie) return;
    setFavoriteBusy(true);
    try {
      const data = await api(`/api/account/favorites/${movie.id}`, { method: isFavorite ? "DELETE" : "PUT" });
      setIsFavorite(data.favorite);
    } catch (error) {
      setMessage({ text: error.message, link: null });
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function handlePlay() {
    if (!movie) return;
    const video = videoRef.current;

    setPlayDisabled(true);
    setMessage({ text: "Checking your membership and streaming rights…", link: null });

    try {
      const data = await api(`/api/stream/${movie.id}/token`, {
        method: "POST",
        body: JSON.stringify({ playerSessionId })
      });

      sessionActiveRef.current = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;

      const resumeAt = resumeRef.current;
      const startAt =
        resumeAt > 10 && (!movie.durationSeconds || resumeAt < movie.durationSeconds - 60) ? resumeAt : 0;

      video.addEventListener("loadedmetadata", () => {
        if (startAt) video.currentTime = startAt;
      }, { once: true });

      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(data.manifestUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = data.manifestUrl;
      } else {
        throw new Error("This browser does not support HLS playback.");
      }

      setMessage({ text: "Enjoy the movie. Your secure playback link is active for a limited time.", link: null });
      await video.play();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setMessage({ text: "Please sign in to watch.", link: "signin" });
      } else if (error instanceof ApiError && error.status === 402) {
        setMessage({ text: error.message, link: "plans" });
      } else {
        setMessage({ text: error.message, link: null });
      }
    } finally {
      setPlayDisabled(false);
    }
  }

  /* ---------- render ---------- */
  const meta = movie
    ? [yearOf(movie.releaseDate), movie.ageRating, formatDuration(movie.durationSeconds), movie.originalLanguage]
        .filter(Boolean)
        .join(" · ")
    : "";

  let messageLink = null;
  if (message.link === "signin") {
    messageLink = <button type="button" className="inline-link" onClick={() => openAuth("login")}>Sign in</button>;
  } else if (message.link === "plans") {
    messageLink = <Link className="inline-link" to="/#plans">Choose a plan</Link>;
  } else if (message.link === "browse") {
    messageLink = <Link className="inline-link" to="/">Browse the collection</Link>;
  }

  return (
    <main className="watch-page">
      <div className="watch-top">
        <Link to="/">← Back to collection</Link>
      </div>

      <p className="eyebrow">NOW SHOWING</p>
      <h1 className="page-title">{notFound ? "Movie not found" : movie?.title || "Loading movie…"}</h1>
      <p className="muted">{meta}</p>
      <p className="muted">{(movie?.genres || []).join(" · ")}</p>
      <p className="movie-description">{movie ? movie.description || "Enjoy this title on FILMORA." : ""}</p>

      <div className="watch-controls">
        <button className="button button-primary button-large" disabled={playDisabled} onClick={handlePlay}>
          {resumeLabel || "Play movie"}
        </button>
        {user && (
          <button
            className="button button-outline button-large"
            type="button"
            disabled={favoriteBusy}
            onClick={toggleFavorite}
          >
            {isFavorite ? "✓ In my list" : "+ My list"}
          </button>
        )}
        <Link className="button button-quiet" to="/#plans">View membership plans</Link>
      </div>

      <p className="watch-message" aria-live="polite">
        {message.text} {messageLink}
      </p>

      {trailerUrl && (
        <section className="trailer-section">
          <h2>Official Movie Trailer</h2>
          <div className="player-shell">
            <iframe
              title="Official movie trailer"
              width="100%"
              height="450"
              src={trailerUrl}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </section>
      )}

      <div className="player-shell">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          disablePictureInPicture
          poster={movie?.backdropUrl || movie?.posterUrl || undefined}
        />
      </div>
    </main>
  );
}
