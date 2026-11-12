# Implementation roadmap

## Phase 1 — Local development
- Install Node.js and Docker Desktop.
- Start PostgreSQL with Docker Compose.
- Configure `.env`.
- Install dependencies, generate Prisma Client and seed the database.
- Run the backend and confirm `/api/health`.

## Phase 2 — Account and plans
- Test registration, login, logout and CSRF handling.
- Review the example plans and set actual prices/currencies.
- Add email verification and password recovery.

## Phase 3 — Payments
- Create a Flutterwave sandbox account.
- Configure the webhook and redirect URL.
- Test successful, failed, cancelled and delayed payments.
- Confirm a payment only activates a subscription after server verification.
- Add refund and chargeback handling.
- Decide whether manual renewal is sufficient or a card recurring flow is required.

## Phase 4 — Movie catalogue and licences
- Add only titles for which FILMORA has documented streaming rights.
- Record rights holder, contract reference, territory and licence dates.
- Verify the contract manually.
- Add genres, categories, cast, posters, captions and subtitles.

## Phase 5 — Video upload and playback
- Configure Cloudflare Stream.
- Upload a test video you own or are authorised to use.
- Refresh processing status until ready.
- Publish the title only after licence and video checks pass.
- Test active, expired and unpaid accounts.
- Test territory restrictions from permitted and non-permitted locations.

## Phase 6 — Administration and analytics
- Add customer support tools.
- Add plan and price management.
- Add refunds and payment reconciliation.
- Add watch-time analytics, churn, failed renewals and provider cost reports.
- Enforce concurrent device limits.

## Phase 7 — Production launch
- Choose a domain and production hosting.
- Configure HTTPS, backups, monitoring and alerts.
- Review legal documents and local compliance.
- Load test the player and backend.
- Test on mobile, desktop and low-bandwidth connections.
- Launch gradually and monitor costs.
