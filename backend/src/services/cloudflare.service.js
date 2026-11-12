import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

function requireCloudflareConfig() {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    throw new HttpError(503, "Cloudflare Stream is not configured. Add the account ID and API token to backend/.env.");
  }
}

function b64(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

export async function createTusUploadUrl({ fileSize, fileName, creatorId }) {
  requireCloudflareConfig();

  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const allowedOrigin = (env.CF_ALLOWED_ORIGIN || env.FRONTEND_ORIGIN).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const metadata = [
    `name ${b64(fileName)}`,
    "requiresignedurls",
    `allowedorigins ${b64(JSON.stringify([allowedOrigin]))}`,
    `maxDurationSeconds ${b64("21600")}`,
    `expiry ${b64(expiry)}`
  ].join(",");

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream?direct_user=true`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(fileSize),
      "Upload-Metadata": metadata,
      "Upload-Creator": String(creatorId).slice(0, 64)
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Cloudflare TUS URL creation failed:", detail);
    throw new HttpError(502, "Cloudflare could not create an upload URL.");
  }

  const uploadUrl = response.headers.get("Location");
  const videoUid = response.headers.get("stream-media-id");

  if (!uploadUrl || !videoUid) {
    throw new HttpError(502, "Cloudflare did not return the expected upload details.");
  }

  return { uploadUrl, videoUid, expiresAt: expiry };
}

export async function getCloudflareVideo(videoUid) {
  requireCloudflareConfig();

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/${encodeURIComponent(videoUid)}`,
    { headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` } }
  );
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.success || !result.result) {
    throw new HttpError(502, "Could not retrieve video processing status from Cloudflare.");
  }
  return result.result;
}

export async function createSignedPlaybackToken(videoUid) {
  requireCloudflareConfig();
  if (!env.CF_CUSTOMER_CODE) {
    throw new HttpError(503, "Set CF_CUSTOMER_CODE to enable the video player.");
  }
  const expiresAt = Math.floor(Date.now() / 1000) + 4 * 60 * 60;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/${encodeURIComponent(videoUid)}/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ exp: expiresAt, downloadable: false })
    }
  );
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.success || !result.result?.token) {
    console.error("Cloudflare token generation failed:", result);
    throw new HttpError(502, "Could not authorize secure movie playback.");
  }

  return {
    token: result.result.token,
    manifestUrl: `https://customer-${env.CF_CUSTOMER_CODE}.cloudflarestream.com/${result.result.token}/manifest/video.m3u8`,
    expiresAt
  };
}
