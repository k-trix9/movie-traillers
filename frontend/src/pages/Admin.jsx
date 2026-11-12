import { useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { api } from "../lib/api.js";
import { formatDate, formatMoney } from "../lib/format.js";
import { useAuth } from "../context/AuthContext.jsx";

/* ---------- small shared pieces ---------- */

function ActionButton({ label, className, onAction, onError }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await onAction();
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={`button ${className}`} disabled={busy} onClick={handleClick}>
      {label}
    </button>
  );
}

function EmptyRow({ columns, text }) {
  return <tr><td colSpan={columns}>{text}</td></tr>;
}

/* ---------- add a movie ---------- */

function AddMovieForm({ onCreated, setMessage }) {
  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    for (const key of ["releaseDate", "validFrom", "validUntil", "ageRating", "originalLanguage", "description"]) {
      if (!payload[key]) delete payload[key];
    }
    try {
      await api("/api/admin/movies", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      await onCreated();
      setMessage("Draft movie created. Verify the distribution licence before uploading.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <h2>Add a movie</h2>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>Movie title<input name="title" required maxLength={255} /></label>
        <label>Description<textarea name="description" maxLength={5000} /></label>
        <label>Release date<input name="releaseDate" type="date" /></label>
        <label>Age rating<input name="ageRating" placeholder="e.g. PG-13" /></label>
        <label>Original language<input name="originalLanguage" placeholder="e.g. en" /></label>
        <label>License reference<input name="licenseReference" required placeholder="Contract or licence ID" /></label>
        <label>Rights holder<input name="rightsHolder" required /></label>
        <label>
          Territory
          <select name="territory" required defaultValue="">
            <option value="" disabled>Select the territory granted by the licence</option>
            <option value="WORLDWIDE">Worldwide</option>
            <option value="RW">Rwanda (RW)</option>
            <option value="US">United States (US)</option>
            <option value="GB">United Kingdom (GB)</option>
            <option value="KE">Kenya (KE)</option>
            <option value="UG">Uganda (UG)</option>
          </select>
        </label>
        <label>Licence starts<input name="validFrom" type="date" /></label>
        <label>Licence expires (optional)<input name="validUntil" type="date" /></label>
        <button className="button button-primary button-full" type="submit">Create draft movie</button>
      </form>
    </>
  );
}

/* ---------- upload (resumable TUS direct to Cloudflare) ---------- */

function UploadForm({ movies, onUploaded }) {
  const [movieId, setMovieId] = useState("");
  const [progress, setProgress] = useState("");
  const fileRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const file = fileRef.current?.files[0];
    if (!movieId || !file) return;

    try {
      setProgress("Requesting a secure, one-time upload URL…");
      const data = await api(`/api/admin/movies/${movieId}/upload-url`, {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileSize: file.size })
      });

      const upload = new tus.Upload(file, {
        uploadUrl: data.uploadUrl,
        chunkSize: 50 * 1024 * 1024,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        metadata: { filename: file.name, filetype: file.type || "application/octet-stream" },
        onError(error) {
          setProgress(`Upload failed: ${error.message}`);
        },
        onProgress(sent, total) {
          setProgress(`Uploading to Cloudflare: ${Math.floor((sent / total) * 100)}%`);
        },
        async onSuccess() {
          setProgress("Upload completed. Cloudflare is processing the video — use “Refresh video” until it is ready.");
          try {
            await api(`/api/admin/videos/${data.videoUid}/refresh`, { method: "POST", body: "{}" });
            await onUploaded();
          } catch (error) {
            setProgress(`Uploaded, but status refresh failed: ${error.message}`);
          }
        }
      });
      upload.start();
    } catch (error) {
      setProgress(error.message);
    }
  }

  return (
    <div className="upload-row">
      <h2>Upload movie file</h2>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Select draft movie
          <select required value={movieId} onChange={(e) => setMovieId(e.target.value)}>
            <option value="">Choose a movie</option>
            {movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}
          </select>
        </label>
        <label>Video file<input ref={fileRef} type="file" accept="video/*" required /></label>
        <button className="button button-outline button-full" type="submit">Upload using resumable TUS</button>
      </form>
      <p className="muted">
        Large video files use resumable direct upload. The server creates a one-time Cloudflare upload URL; the video
        itself goes directly to Cloudflare.
      </p>
      <p className="admin-message" aria-live="polite">{progress}</p>
    </div>
  );
}

/* ---------- edit details dialog ---------- */

function EditDialog({ movie, onClose, onSaved, setMessage }) {
  const ref = useRef(null);
  const minutes = movie.durationSeconds ?? movie.videoAssets.find((a) => a.durationSeconds)?.durationSeconds;
  const [form, setForm] = useState({
    description: movie.description || "",
    posterUrl: movie.media.find((m) => m.mediaType === "poster")?.fileUrl || "",
    backdropUrl: movie.media.find((m) => m.mediaType === "backdrop")?.fileUrl || "",
    genres: movie.genres.map((g) => g.genre.name).join(", "),
    minutes: minutes ? String(Math.round(minutes / 60)) : "",
    featured: Boolean(movie.featured)
  });

  useEffect(() => {
    const node = ref.current;
    if (node && !node.open) node.showModal();
  }, []);

  const update = (field) => (event) =>
    setForm((f) => ({ ...f, [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    const mins = form.minutes.trim();
    try {
      await api(`/api/admin/movies/${movie.id}/details`, {
        method: "PATCH",
        body: JSON.stringify({
          description: form.description.trim(),
          posterUrl: form.posterUrl.trim(),
          backdropUrl: form.backdropUrl.trim(),
          genres: form.genres.split(",").map((g) => g.trim()).filter(Boolean),
          durationSeconds: mins ? Number(mins) * 60 : null,
          featured: form.featured
        })
      });
      onClose();
      await onSaved();
      setMessage("Movie details saved.");
    } catch (error) {
      setMessage(error.message);
      onClose();
    }
  }

  return (
    <dialog ref={ref} className="edit-dialog" onClose={onClose}>
      <h2>Edit: {movie.title}</h2>
      <p className="muted">Artwork must be images you own or are licensed to use (https links only).</p>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>Description<textarea maxLength={5000} value={form.description} onChange={update("description")} /></label>
        <label>Poster image URL<input type="url" placeholder="https://…" value={form.posterUrl} onChange={update("posterUrl")} /></label>
        <label>Backdrop image URL (wide)<input type="url" placeholder="https://…" value={form.backdropUrl} onChange={update("backdropUrl")} /></label>
        <label>Genres (comma separated)<input placeholder="Drama, Thriller" value={form.genres} onChange={update("genres")} /></label>
        <label>Running time in minutes<input type="number" min="0" max="720" value={form.minutes} onChange={update("minutes")} /></label>
        <label className="check">
          <input type="checkbox" checked={form.featured} onChange={update("featured")} /> Feature on the home page
        </label>
        <div className="row-actions">
          <button className="button button-primary" type="submit">Save</button>
          <button className="button button-outline" type="button" onClick={() => ref.current?.close()}>Cancel</button>
        </div>
      </form>
    </dialog>
  );
}

/* ---------- tabs ---------- */

function MoviesTab({ movies, reload, setMessage, onEdit }) {
  const fail = setMessage;

  return (
    <>
      <h2>Movie publishing workflow</h2>
      <p className="muted">
        A movie stays private until its licence is verified and its Cloudflare video has finished processing. Add a
        poster and genres with <strong>Edit details</strong>.
      </p>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr><th>Movie</th><th>Licence</th><th>Video</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {movies.length === 0 && <EmptyRow columns={4} text="No movies have been added yet." />}
            {movies.map((movie) => (
              <tr key={movie.id}>
                <td>
                  {movie.title}
                  <br />
                  <span className="status">{movie.publicationStatus}</span>
                </td>
                <td>{movie.licenses.map((l) => `${l.territory}: ${l.status}`).join(", ") || "No licence"}</td>
                <td>{movie.videoAssets.map((a) => a.processingStatus).join(", ") || "Not uploaded"}</td>
                <td>
                  {movie.licenses.filter((l) => l.status === "PENDING").map((license) => (
                    <ActionButton
                      key={license.id}
                      label="Verify licence"
                      className="button-outline"
                      onError={fail}
                      onAction={async () => {
                        await api(`/api/admin/licenses/${license.id}/verify`, {
                          method: "PATCH",
                          body: JSON.stringify({ verificationNotes: "Reviewed by authorised FILMORA administrator." })
                        });
                        await reload();
                        setMessage("Licence marked verified. Confirm the contract really grants this territory and subscription streaming rights.");
                      }}
                    />
                  ))}

                  {movie.videoAssets.map((asset) => (
                    <ActionButton
                      key={asset.providerVideoUid}
                      label="Refresh video"
                      className="button-outline"
                      onError={fail}
                      onAction={async () => {
                        await api(`/api/admin/videos/${asset.providerVideoUid}/refresh`, { method: "POST", body: "{}" });
                        await reload();
                        setMessage("Cloudflare video status refreshed.");
                      }}
                    />
                  ))}

                  <ActionButton
                    label="Fetch trailer"
                    className="button-outline"
                    onError={fail}
                    onAction={async () => {
                      await api(`/api/admin/movies/${movie.id}/tmdb-trailer`, { method: "POST", body: "{}" });
                      await reload();
                      setMessage("Official trailer imported from TMDB.");
                    }}
                  />

                  <ActionButton label="Edit details" className="button-outline" onError={fail} onAction={async () => onEdit(movie)} />

                  {movie.publicationStatus === "PUBLISHED" ? (
                    <ActionButton
                      label="Unpublish"
                      className="button-outline"
                      onError={fail}
                      onAction={async () => {
                        await api(`/api/admin/movies/${movie.id}/unpublish`, { method: "PATCH", body: "{}" });
                        await reload();
                        setMessage("Movie unpublished.");
                      }}
                    />
                  ) : (
                    <ActionButton
                      label="Publish"
                      className="button-primary"
                      onError={fail}
                      onAction={async () => {
                        await api(`/api/admin/movies/${movie.id}/publish`, { method: "PATCH", body: "{}" });
                        await reload();
                        setMessage("Movie published.");
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function useTabData(path, key, setMessage) {
  const [rows, setRows] = useState(null);
  const load = useCallback(async () => {
    try {
      const data = await api(path);
      setRows(data[key]);
    } catch (error) {
      setMessage(error.message);
      setRows([]);
    }
  }, [path, key, setMessage]);
  useEffect(() => { load(); }, [load]);
  return [rows, load];
}

function PaymentsTab({ setMessage }) {
  const [rows] = useTabData("/api/admin/payments", "payments", setMessage);
  return (
    <>
      <h2>Recent payments</h2>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Customer</th><th>Plan</th><th>Amount</th><th>Status</th><th>Reference</th></tr>
          </thead>
          <tbody>
            {rows && rows.length === 0 && <EmptyRow columns={6} text="No payments yet." />}
            {(rows || []).map((p) => (
              <tr key={p.reference}>
                <td>{formatDate(p.paidAt || p.createdAt)}</td>
                <td>{p.customer ?? "—"}</td>
                <td>{p.plan ?? "—"}</td>
                <td>{formatMoney(p.amount, p.currency)}</td>
                <td>{p.status ?? "—"}</td>
                <td>{p.reference ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SubscribersTab({ setMessage }) {
  const [rows] = useTabData("/api/admin/subscriptions", "subscriptions", setMessage);
  return (
    <>
      <h2>Subscriptions</h2>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr><th>Customer</th><th>Plan</th><th>Status</th><th>Access until</th><th>Cancelling</th></tr>
          </thead>
          <tbody>
            {rows && rows.length === 0 && <EmptyRow columns={5} text="No subscriptions yet." />}
            {(rows || []).map((s, index) => (
              <tr key={s.id ?? index}>
                <td>{s.customer ?? "—"}</td>
                <td>{s.plan ?? "—"}</td>
                <td>{s.status ?? "—"}</td>
                <td>{formatDate(s.currentPeriodEnd)}</td>
                <td>{s.cancelAtPeriodEnd ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UsersTab({ me, setMessage }) {
  const [rows, reload] = useTabData("/api/admin/users", "users", setMessage);
  return (
    <>
      <h2>Users</h2>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Roles</th><th>Joined</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {(rows || []).map((u) => {
              const suspended = u.accountStatus === "SUSPENDED";
              return (
                <tr key={u.id}>
                  <td>{u.fullName ?? "—"}</td>
                  <td>{u.email}</td>
                  <td>{u.roles.map((r) => r.role.name).join(", ") || "—"}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>{u.accountStatus}</td>
                  <td>
                    {me && u.id !== me.id && (
                      <ActionButton
                        label={suspended ? "Reactivate" : "Suspend"}
                        className="button-outline"
                        onError={setMessage}
                        onAction={async () => {
                          await api(`/api/admin/users/${u.id}/status`, {
                            method: "PATCH",
                            body: JSON.stringify({ accountStatus: suspended ? "ACTIVE" : "SUSPENDED" })
                          });
                          await reload();
                        }}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- page ---------- */

const TABS = [
  ["movies", "Movies"],
  ["payments", "Payments"],
  ["subscribers", "Subscribers"],
  ["users", "Users"]
];

export default function Admin() {
  const { user, loading } = useAuth();
  const [message, setMessage] = useState("Checking administrator access…");
  const [stats, setStats] = useState(null);
  const [movies, setMovies] = useState([]);
  const [tab, setTab] = useState("movies");
  const [editing, setEditing] = useState(null);
  const [authorised, setAuthorised] = useState(false);

  useEffect(() => { document.title = "Admin dashboard — FILMORA"; }, []);

  const loadMovies = useCallback(async () => {
    const data = await api("/api/admin/movies");
    setMovies(data.movies);
  }, []);

  useEffect(() => {
    if (loading) return;
    let alive = true;

    (async () => {
      try {
        const data = await api("/api/admin/dashboard");
        if (!alive) return;
        setStats(data.stats);
        setAuthorised(true);
        setMessage("Administrator access confirmed.");
        await loadMovies();
      } catch (error) {
        if (!alive) return;
        setAuthorised(false);
        setStats(null);
        setMessage(
          error.status === 401 || error.status === 403
            ? "Sign in with an administrator account to manage FILMORA."
            : error.message
        );
      }
    })();

    return () => { alive = false; };
  }, [loading, user?.id, loadMovies]);

  return (
    <main className="admin-wrap">
      <p className="eyebrow">CONTROL CENTRE</p>
      <h1 className="admin-title">Admin dashboard</h1>
      <p className="admin-message" aria-live="polite">{message}</p>

      <section className="admin-stats">
        <article className="stat-card"><span>Registered users</span><strong>{stats?.users ?? "—"}</strong></article>
        <article className="stat-card"><span>Active subscribers</span><strong>{stats?.activeSubscriptions ?? "—"}</strong></article>
        <article className="stat-card"><span>Movies</span><strong>{stats?.movies ?? "—"}</strong></article>
        <article className="stat-card">
          <span>Revenue this month (USD)</span>
          <strong>{stats ? formatMoney(Number(stats.monthRevenue), "USD") : "—"}</strong>
        </article>
      </section>

      {authorised ? (
        <div className="admin-columns">
          <section className="admin-panel">
            <AddMovieForm onCreated={loadMovies} setMessage={setMessage} />
            <UploadForm movies={movies} onUploaded={loadMovies} />
          </section>

          <section className="admin-panel">
            <div className="tabs" role="tablist">
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  className={`tab${tab === id ? " active" : ""}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "movies" && (
              <MoviesTab movies={movies} reload={loadMovies} setMessage={setMessage} onEdit={setEditing} />
            )}
            {tab === "payments" && <PaymentsTab setMessage={setMessage} />}
            {tab === "subscribers" && <SubscribersTab setMessage={setMessage} />}
            {tab === "users" && <UsersTab me={user} setMessage={setMessage} />}
          </section>
        </div>
      ) : (
        <section className="admin-panel">
          <p className="muted">Administrator access is required to manage FILMORA.</p>
        </section>
      )}

      {editing && (
        <EditDialog
          key={editing.id}
          movie={editing}
          onClose={() => setEditing(null)}
          onSaved={loadMovies}
          setMessage={setMessage}
        />
      )}
    </main>
  );
}
