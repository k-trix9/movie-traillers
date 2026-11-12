# Payment and video provider setup

## Flutterwave

The starter uses Flutterwave Standard hosted checkout. The backend creates a checkout link and the customer is redirected to Flutterwave.

Configure these server environment variables:

```text
FLW_SECRET_KEY=
FLW_WEBHOOK_SECRET=
FLW_REDIRECT_URL=https://YOUR-DOMAIN/api/billing/flutterwave/callback
FLW_PAYMENT_OPTIONS=card
```

In the Flutterwave dashboard, configure the webhook URL. Enable webhook retries. If you use `payment_options` in the checkout request, disable the dashboard-wide payment-options override as described in Flutterwave's docs; otherwise account settings may control the available methods.

```text
https://YOUR-DOMAIN/api/webhooks/flutterwave
```

Use the same random webhook secret in the dashboard and `FLW_WEBHOOK_SECRET`. Flutterwave sends this value in the `verif-hash` header; the backend checks it with a constant-time comparison.

The backend accepts the current `flutterwave-signature` HMAC-SHA256 header and the legacy `verif-hash` secret-hash header. It then verifies successful transactions with Flutterwave before activating a membership.

### Global payment considerations

"Worldwide" does not mean every payment method or currency is available in every country. Flutterwave documents card payments across supported regions and region-specific methods. Its payment-method matrix lists Rwanda mobile money for RWF payments. The seeded plans are USD only unless you set `RWF_BASIC_AMOUNT`, `RWF_STANDARD_AMOUNT` and `RWF_FAMILY_AMOUNT` in `.env` before running the seed. Those optional values create separate RWF plan prices for Rwanda mobile-money checkout.

This starter intentionally uses manual monthly renewal. Flutterwave's card tokenization/card-on-file flows can support recurring charges, but they require a separate implementation and account/provider configuration. Do not promise automatic monthly mobile-money debits unless Flutterwave confirms that your merchant account and the specific method support them.

### Production payment checks

- Test in sandbox before using live credentials.
- Use HTTPS.
- Keep secret keys out of the frontend.
- Verify transaction reference, final status, amount and currency server-side.
- Store each provider event with a unique idempotency key.
- Handle pending, failed, cancelled, delayed and duplicate events.
- Add refund and chargeback workflows.
- Publish clear renewal and cancellation terms.

## Cloudflare Stream

Configure:

```text
CF_ACCOUNT_ID=
CF_API_TOKEN=
CF_CUSTOMER_CODE=
CF_ALLOWED_ORIGIN=YOUR-DOMAIN (domain only, no scheme)
TRUST_CF_IP_COUNTRY=false
```

Create an API token with the minimum Stream permissions needed for upload, video lookup and signed-token creation.

The upload endpoint uses direct creator upload with TUS. Cloudflare documents TUS as required for videos over 200 MB and recommends it for unreliable connections. The API token is used only by the backend to provision a one-time upload URL; the browser sends the video bytes directly to Cloudflare.

The upload metadata requests signed-URL protection. Playback calls Cloudflare's token endpoint and uses a four-hour expiry so a feature-length movie can finish without a mid-film token timeout. Cloudflare recommends the `/token` API for testing or fewer than 1,000 tokens per day; for higher-volume playback, move to server-side signing keys to avoid an API request for every viewing session.

For country-specific rights, set `TRUST_CF_IP_COUNTRY=true` only after:
- the application is behind Cloudflare;
- the backend origin cannot be reached directly by users;
- you have tested that the `CF-IPCountry` header is injected by Cloudflare and cannot be spoofed through your origin.

If those conditions are not met, keep it `false`. In that mode only a verified `WORLDWIDE` licence can pass playback checks. This is deliberately fail-closed.

## Official documentation

- Flutterwave Standard checkout: https://developer.flutterwave.com/docs/flutterwave-standard-1
- Flutterwave transaction verification: https://developer.flutterwave.com/docs/transaction-verification
- Flutterwave webhooks: https://developer.flutterwave.com/docs/webhooks
- Flutterwave card tokenization: https://developer.flutterwave.com/docs/tokenization
- Flutterwave Rwanda mobile money: https://developer.flutterwave.com/docs/rwanda
- Flutterwave payment methods by region: https://developer.flutterwave.com/docs/payment-methods
- Cloudflare Stream direct creator uploads: https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
- Cloudflare Stream signed URLs: https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
