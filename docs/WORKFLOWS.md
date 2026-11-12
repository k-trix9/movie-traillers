# FILMORA business and system workflows

## 1. Customer membership and payment

1. Visitor opens FILMORA and browses public movie information.
2. Visitor registers or signs in.
3. Customer chooses an active monthly plan and a currency-specific price.
4. Backend creates a `PENDING` payment with a unique reference.
5. Backend creates a Flutterwave hosted checkout link using server-side credentials.
6. Customer completes checkout with a payment method available in their country.
7. Flutterwave redirects the browser and/or sends a webhook.
8. Backend verifies the transaction directly with Flutterwave.
9. Backend confirms:
   - provider transaction status is `successful`;
   - transaction reference equals the reference created by FILMORA;
   - currency matches the stored plan price;
   - paid amount is at least the expected amount.
10. Backend records the provider event once, marks the payment successful and creates or extends the subscription period.
11. Customer can now request movie playback until `currentPeriodEnd`.

A redirect URL by itself never activates a subscription. Duplicate webhooks and callback/webhook races must not extend the subscription twice.

## 2. Monthly renewal

This starter uses manual monthly renewal:

1. Customer's current paid period approaches its end.
2. Customer signs in and chooses the same plan.
3. Customer completes a new hosted checkout.
4. The backend verifies the new transaction.
5. The backend extends the existing subscription by the plan's billing interval.

Automatic card renewal is a separate feature. Add it only after the payment provider has approved the appropriate tokenization/card-on-file flow, the customer has explicitly consented, and retries/cancellation/expired-token handling have been tested. Do not assume Rwanda mobile money supports automatic recurring debits.

## 3. Customer playback

1. Customer signs in.
2. Customer opens a published movie.
3. Browser asks the backend for a playback token.
4. Backend checks that the user account is active.
5. Backend checks that the subscription is active and has not expired.
6. Backend checks the plan's active-screen limit using a server-side session heartbeat.
7. Backend checks that the movie is published and its Cloudflare asset is ready.
8. Backend checks that a verified licence covers the viewer's territory and is still within its validity dates.
9. Backend asks Cloudflare Stream for a short-lived signed token.
10. Backend returns a signed HLS manifest URL.
11. Browser plays the manifest using HLS.js or native HLS support.

The Cloudflare API token and payment secret remain on the backend. Only the short-lived playback URL is returned to the browser.

## 4. Admin movie upload and publication

1. Administrator signs in.
2. Administrator creates a movie draft and enters the rights-holder, licence reference, territory and validity dates.
3. A human administrator checks the actual contract and verifies that it grants subscription streaming rights for the stated territory.
4. Administrator marks the licence verified.
5. Administrator requests a one-time Cloudflare TUS upload URL.
6. Browser uploads the file directly to Cloudflare using resumable upload. The application server does not proxy the movie file.
7. Cloudflare processes the video.
8. Administrator refreshes the video status until it is ready.
9. Administrator publishes the movie.
10. Backend refuses publication if the licence is not verified/current or the video is not ready.

A `WORLDWIDE` licence must genuinely grant worldwide rights. Never use that value merely to make a movie appear in every country.

## 5. Admin dashboard

The current dashboard provides a starter view of:
- registered users;
- active subscriptions;
- movie count;
- current-month verified payment revenue;
- movie drafts and licence/video status.

The database also stores payment and administrator activity records. Add richer analytics, refunds, customer support, pricing controls and audit exports before public launch.

## 6. Subscription states and access rules

- `ACTIVE`: customer has a paid period that has not ended.
- `PAST_DUE`: reserved for a future failed-renewal/retry workflow.
- `CANCELED`: cancellation has taken effect.
- `EXPIRED`: paid period has ended.

In this starter, a cancellation request does not remove access before the paid period ends. A customer can keep watching until the stored end date.
