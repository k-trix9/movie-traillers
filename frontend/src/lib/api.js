// Shared API client: handles the CSRF token and consistent error objects.
let csrfToken = null;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function resetCsrf() {
  csrfToken = null;
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function api(url, options = {}, retried = false) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const needsCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (needsCsrf) headers.set("x-csrf-token", await getCsrfToken());

  const response = await fetch(url, { ...options, method, headers, credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));

  // The session (and its CSRF token) changes on sign-in/out; refresh once and retry.
  if (response.status === 403 && needsCsrf && !retried && /CSRF/i.test(data.error?.message || "")) {
    resetCsrf();
    return api(url, options, true);
  }
  if (!response.ok) throw new ApiError(data.error?.message || "Something went wrong.", response.status);
  return data;
}

// Fire-and-forget request that survives page close (used for "stop watching" signals).
export function apiBackground(url, body) {
  if (!csrfToken) return;
  try {
    fetch(url, {
      method: "POST",
      keepalive: true,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(body)
    }).catch(() => {});
  } catch {
    // Best effort only.
  }
}
