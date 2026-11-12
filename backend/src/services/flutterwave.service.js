import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { isFlutterwaveTransactionValid } from "./billing-rules.js";

const FLW_API = "https://api.flutterwave.com/v3";

function requireFlutterwaveConfig() {
  if (!env.FLW_SECRET_KEY) {
    throw new HttpError(503, "Payments are not configured yet. Add the Flutterwave secret key on the server.");
  }
}

export async function createHostedCheckout({ payment, user, plan }) {
  requireFlutterwaveConfig();

  const response = await fetch(`${FLW_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      tx_ref: payment.reference,
      amount: payment.amount.toString(),
      currency: payment.currency,
      redirect_url: env.FLW_REDIRECT_URL,
      payment_options: payment.currency === "RWF"
        ? "card, mobilemoneyrwanda"
        : env.FLW_PAYMENT_OPTIONS,
      customer: {
        email: user.email,
        name: user.fullName || user.email
      },
      customizations: {
        title: "FILMORA subscription",
        description: `${plan.name} monthly subscription`
      },
      meta: {
        filmoraPaymentId: payment.id,
        filmoraPlanCode: plan.code
      }
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.status !== "success" || !result.data?.link) {
    console.error("Flutterwave checkout creation failed:", result);
    throw new HttpError(502, "The payment provider could not create a checkout link. Please try again.");
  }

  return result.data.link;
}

export async function verifyFlutterwaveTransaction(transactionId, expectedPayment) {
  requireFlutterwaveConfig();

  const response = await fetch(`${FLW_API}/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
      Accept: "application/json"
    }
  });

  const result = await response.json().catch(() => ({}));
  const transaction = result.data;

  if (!response.ok || result.status !== "success" || !transaction) {
    throw new HttpError(502, "The payment provider could not verify this transaction.");
  }

  if (!isFlutterwaveTransactionValid(transaction, expectedPayment)) {
    throw new HttpError(400, "The transaction did not match the expected payment details.");
  }

  return transaction;
}

export function isValidFlutterwaveWebhook(rawBody, headers) {
  if (!env.FLW_WEBHOOK_SECRET || !Buffer.isBuffer(rawBody)) return false;

  const signature = headers["flutterwave-signature"];
  const legacyHash = headers["verif-hash"];

  if (typeof signature === "string") {
    const expected = createHmac("sha256", env.FLW_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // Compatibility with the legacy Flutterwave webhook secret-hash header.
  if (typeof legacyHash === "string") {
    const a = Buffer.from(env.FLW_WEBHOOK_SECRET);
    const b = Buffer.from(legacyHash);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  return false;
}
