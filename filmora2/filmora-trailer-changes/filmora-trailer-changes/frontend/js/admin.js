import { api } from "./api.js";
import { el, formatDate, formatMoney } from "./ui.js";

const message = document.querySelector("#admin-message");
const movieTable = document.querySelector("#movie-table");
const uploadMovie = document.querySelector("#upload-movie");
const uploadProgress = document.querySelector("#upload-progress");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
let editingMovie = null;
let me = null;

function row(...values) {
  const tr = el("tr");
  values.forEach((value) => tr.append(el("td", "", value ?? "—")));
  return tr;
}

function emptyRow(columns, text) {
  const tr = el("tr");
  const td = el("td", "", text);
  td.colSpan = columns;
  tr.append(td);
  return tr;
}

function actionButton(label, className, handler) {
  const button = el("button", `button ${className}`, label);
  button.type = "button";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try { await handler(); } catch (error) { message.textContent = error.message; } finally { button.disabled = false; }
  });
  return button;
}

/* ---------- dashboard ---------- */
async function loadDashboard() {
  try {
    me = (await api("/api/auth/me")).user;
    const data = await api("/api/admin/dashboard");
    document.querySelector("#stat-users").textContent = data.stats.users;
    document.querySelector("#stat-subs").textContent = data.stats.activeSubscriptions;
    document.querySelector("#stat-movies").textContent = data.stats.movies;
    document.querySelector("#stat-revenue").textContent = formatMoney(Number(data.stats.monthRevenue), "USD");
    message.textContent = "Administrator access confirmed.";
    await loadMovies();
  } catch (error) {
    message.textContent = error.status === 401 || error.status === 403
      ? "Sign in with an administrator account on the public site first, then reload this page."
      : error.message;
    movieTable.replaceChildren(emptyRow(4, "Administrator access is required to manage FILMORA."));
  }
}

/* ---------- movies ---------- */
async function loadMovies() {
  const data = await api("/api/admin/movies");
  movieTable.replaceChildren();
  uploadMovie.replaceChildren();

  const placeholder = el("option", "", "Choose a movie");
  placeholder.value = "";
  uploadMovie.append(placeholder);

  data.movies.forEach((movie) => {
    const option = el("option", "", movie.title);
    option.value = movie.id;
    uploadMovie.append(option);

    const tr = el("tr");
    const titleCell = el("td", "", movie.title);
    titleCell.append(el("br"), el("span", "status", movie.publicationStatus));
    tr.append(titleCell);
    tr.append(el("td", "", movie.licenses.map((l) => `${l.territory}: ${l.status}`).join(", ") || "No licence"));
    tr.append(el("td", "", movie.videoAssets.map((a) => a.processingStatus).join(", ") || "Not uploaded"));

    const actions = el("td");
    movie.licenses.filter((l) => l.status === "PENDING").forEach((license) => {
      actions.append(actionButton("Verify licence", "button-outline", async () => {
        await api(`/api/admin/licenses/${license.id}/verify`, {
          method: "PATCH",
          body: JSON.stringify({ verificationNotes: "Reviewed by authorised FILMORA administrator." })
        });
        await loadMovies();
        message.textContent = "Licence marked verified. Confirm the contract really grants this territory and subscription streaming rights.";
      }));
    });

    movie.videoAssets.forEach((asset) => {
      actions.append(actionButton("Refresh video", "button-outline", async () => {
        await api(`/api/admin/videos/${asset.providerVideoUid}/refresh`, { method: "POST", body: "{}" });
        await loadMovies();
        message.textContent = "Cloudflare video status refreshed.";
      }));
    });

    actions.append(actionButton("Edit details", "button-outline", async () => openEdit(movie)));

    actions.append(actionButton("Fetch trailer", "button-outline", async () => {
      await api(`/api/admin/movies/${movie.id}/tmdb-trailer`, { method: "POST", body: "{}" });
      await loadMovies();
      message.textContent = "Official trailer imported from TMDB.";
    }));

    if (movie.publicationStatus === "PUBLISHED") {
      actions.append(actionButton("Unpublish", "button-outline", async () => {
        await api(`/api/admin/movies/${movie.id}/unpublish`, { method: "PATCH", body: "{}" });
        await loadMovies();
        message.textContent = "Movie unpublished.";
      }));
    } else {
      actions.append(actionButton("Publish", "button-primary", async () => {
        await api(`/api/admin/movies/${movie.id}/publish`, { method: "PATCH", body: "{}" });
        await loadMovies();
        message.textContent = "Movie published.";
      }));
    }
    tr.append(actions);
    movieTable.append(tr);
  });

  if (!data.movies.length) movieTable.replaceChildren(emptyRow(4, "No movies have been added yet."));
}

function openEdit(movie) {
  editingMovie = movie;
  document.querySelector("#edit-title").textContent = `Edit: ${movie.title}`;
  editForm.elements.description.value = movie.description || "";
  editForm.elements.posterUrl.value = movie.media.find((m) => m.mediaType === "poster")?.fileUrl || "";
  editForm.elements.backdropUrl.value = movie.media.find((m) => m.mediaType === "backdrop")?.fileUrl || "";
  editForm.elements.genres.value = movie.genres.map((g) => g.genre.name).join(", ");
  const minutes = movie.durationSeconds ?? movie.videoAssets.find((a) => a.durationSeconds)?.durationSeconds;
  editForm.elements.minutes.value = minutes ? Math.round(minutes / 60) : "";
  editForm.elements.featured.checked = movie.featured;
  editDialog.showModal();
}

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const f = editForm.elements;
  const minutes = f.minutes.value.trim();
  try {
    await api(`/api/admin/movies/${editingMovie.id}/details`, {
      method: "PATCH",
      body: JSON.stringify({
        description: f.description.value.trim(),
        posterUrl: f.posterUrl.value.trim(),
        backdropUrl: f.backdropUrl.value.trim(),
        genres: f.genres.value.split(",").map((g) => g.trim()).filter(Boolean),
        durationSeconds: minutes ? Number(minutes) * 60 : null,
        featured: f.featured.checked
      })
    });
    editDialog.close();
    await loadMovies();
    message.textContent = "Movie details saved.";
  } catch (error) {
    message.textContent = error.message;
    editDialog.close();
  }
});
document.querySelector("#edit-cancel").addEventListener("click", () => editDialog.close());

document.querySelector("#movie-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  for (const key of ["releaseDate", "validFrom", "validUntil", "ageRating", "originalLanguage", "description"]) {
    if (!payload[key]) delete payload[key];
  }
  try {
    await api("/api/admin/movies", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    await loadMovies();
    message.textContent = "Draft movie created. Verify the distribution licence before uploading.";
  } catch (error) {
    message.textContent = error.message;
  }
});

/* ---------- upload ---------- */
document.querySelector("#upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const movieId = uploadMovie.value;
  const file = document.querySelector("#video-file").files[0];
  if (!movieId || !file) return;
  if (!window.tus) { uploadProgress.textContent = "The upload library failed to load. Check your connection and reload."; return; }

  try {
    uploadProgress.textContent = "Requesting a secure, one-time upload URL…";
    const data = await api(`/api/admin/movies/${movieId}/upload-url`, {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, fileSize: file.size })
    });

    const upload = new window.tus.Upload(file, {
      uploadUrl: data.uploadUrl,
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      metadata: { filename: file.name, filetype: file.type || "application/octet-stream" },
      onError(error) { uploadProgress.textContent = `Upload failed: ${error.message}`; },
      onProgress(sent, total) { uploadProgress.textContent = `Uploading to Cloudflare: ${Math.floor((sent / total) * 100)}%`; },
      async onSuccess() {
        uploadProgress.textContent = "Upload completed. Cloudflare is processing the video — use “Refresh video” until it is ready.";
        try {
          await api(`/api/admin/videos/${data.videoUid}/refresh`, { method: "POST", body: "{}" });
          await loadMovies();
        } catch (error) {
          uploadProgress.textContent = `Uploaded, but status refresh failed: ${error.message}`;
        }
      }
    });
    upload.start();
  } catch (error) {
    uploadProgress.textContent = error.message;
  }
});

/* ---------- tabs ---------- */
const loaders = {
  async payments() {
    const body = document.querySelector("#payments-table");
    const { payments } = await api("/api/admin/payments");
    body.replaceChildren(...(payments.length
      ? payments.map((p) => row(formatDate(p.paidAt || p.createdAt), p.customer, p.plan, formatMoney(p.amount, p.currency), p.status, p.reference))
      : [emptyRow(6, "No payments yet.")]));
  },
  async subscribers() {
    const body = document.querySelector("#subs-table");
    const { subscriptions } = await api("/api/admin/subscriptions");
    body.replaceChildren(...(subscriptions.length
      ? subscriptions.map((s) => row(s.customer, s.plan, s.status, formatDate(s.currentPeriodEnd), s.cancelAtPeriodEnd ? "Yes" : "No"))
      : [emptyRow(5, "No subscriptions yet.")]));
  },
  async users() {
    const body = document.querySelector("#users-table");
    const { users } = await api("/api/admin/users");
    body.replaceChildren(...users.map((u) => {
      const tr = row(u.fullName, u.email, u.roles.map((r) => r.role.name).join(", "), formatDate(u.createdAt), u.accountStatus);
      const cell = el("td");
      if (me && u.id !== me.id) {
        const suspended = u.accountStatus === "SUSPENDED";
        cell.append(actionButton(suspended ? "Reactivate" : "Suspend", "button-outline", async () => {
          await api(`/api/admin/users/${u.id}/status`, { method: "PATCH", body: JSON.stringify({ accountStatus: suspended ? "ACTIVE" : "SUSPENDED" }) });
          await loaders.users();
        }));
      }
      tr.append(cell);
      return tr;
    }));
  }
};

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", async () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".tab-body").forEach((body) => body.classList.toggle("hidden", body.id !== `tab-${tab.dataset.tab}`));
    try { await loaders[tab.dataset.tab]?.(); } catch (error) { message.textContent = error.message; }
  });
});

await loadDashboard();
