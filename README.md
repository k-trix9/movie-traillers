# FILMORA — paid movie-streaming website

**Project type:** Subscription video-on-demand (SVOD)  
**Business model:** Paid monthly membership  
**Frontend:** React 18 + Vite + React Router  
**Backend:** Node.js + Express REST API  
**Database:** PostgreSQL + Prisma ORM  
**Video delivery:** Cloudflare Stream  
**Payment integration:** Flutterwave Standard hosted checkout

> This is your uploaded project, rebuilt into its proper folder structure (`backend/`, `frontend/`, `docs/`) and completed with the missing pieces: account page, My list, continue-watching, genres, featured title, admin tools for artwork/genres/payments/users, and a local test mode. Your original PDFs are kept in `reference-pdfs/`.

## Pages

| Page | Address | Who |
|---|---|---|
| Home — featured title, continue watching, catalogue, genres, search, plans | `/` | everyone |
| Movie page + secure player, resume, My list | `/movie/<slug>` | members play, anyone views |
| My account — membership, cancel/renew, payment history, My list | `/account` | signed-in members |
| Payment result | `/payment-result` | after checkout |
| Admin dashboard — movies, licences, uploads, trailers, payments, subscribers, users | `/admin` | administrators |
| Terms / Privacy (draft templates — need a lawyer) | `/terms`, `/privacy` | everyone |

## Try it locally without Flutterwave or Cloudflare

You can test sign-up, the account area, plans and admin screens straight away. To skip payment while testing, set in `backend/.env`:

```text
DEV_PAYMENT_BYPASS=true
```

Each plan card then shows a **Test activate (dev only)** button that grants one month of access. This switch is forced off when `NODE_ENV=production`.
Playing real video still needs a Cloudflare Stream account (see below), because video is never stored on your own server.

## What is included

- Responsive dark-cinematic FILMORA website.
- Registration, login, logout and server-side sessions.
- PostgreSQL schema managed by Prisma.
- Monthly plan and plan-price tables.
- Flutterwave hosted checkout creation.
- Server-side transaction verification and webhook signature checks.
- Idempotent payment settlement and monthly subscription periods.
- Subscription entitlement and basic server-side active-device/session limit checks before playback.
- Movie territory/licence check before playback.
- Cloudflare Stream private-video upload URL creation using TUS.
- Short-lived signed Cloudflare playback tokens.
- Administrator dashboard for basic metrics, movie drafts, licence verification, video status and publication.
- Automated tests for important billing and territory rules.
- Account page, My list, continue-watching with resume, genre filter, featured title.
- Admin: poster/backdrop/genre/featured editing, unpublish, payments, subscribers and user suspension.
- Setup, workflow, security and launch documentation.

## Important limitations

This is a **working development foundation**, not a finished production streaming business. You must add your own provider credentials, create and secure your database, obtain distribution rights, configure your domain and test in provider sandbox environments.

The starter uses **manual monthly renewal**: a member pays for a monthly period and must return to checkout to renew. It does not silently charge cards every month. Flutterwave payment methods vary by country; Rwanda mobile money requires an RWF-priced plan. Automatic recurring card charges need a separately designed and approved tokenization/card-on-file flow.

The seeded USD prices ($3.99, $6.99 and $9.99) are examples only. Change them to your approved prices before launch. The database and pricing selector support USD and RWF; optional RWF prices are created only if you set `RWF_BASIC_AMOUNT`, `RWF_STANDARD_AMOUNT` and `RWF_FAMILY_AMOUNT` in `.env` before running the seed.

## Requirements

- Node.js 20.11 or newer.
- Docker Desktop with Docker Compose, or a PostgreSQL 16 database.
- A code editor such as Visual Studio Code.
- Optional for live integrations: Flutterwave merchant account and Cloudflare Stream account.

## Run on Windows

Open PowerShell in the extracted `filmora` folder.

### 1. Start PostgreSQL

```powershell
docker compose up -d database
```

If you already have PostgreSQL installed, you can use that instead. Create a database named `filmora` and update `DATABASE_URL` in the environment file.

If PowerShell blocks `npm.ps1` with an execution-policy error, use `npm.cmd install`, `npm.cmd run prisma:generate`, `npm.cmd run db:push`, `npm.cmd run db:seed` and `npm.cmd run dev` instead.

### 2. Configure the backend

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```

At minimum, set a strong `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Use a unique admin password of at least 12 characters. Do not share or commit your `.env` file.

Example local database URL:

```text
postgresql://postgres:postgres@localhost:5432/filmora?schema=public
```

### 3. Install and prepare the database

```powershell
npm install
npm run prisma:generate
npm run db:push
npm run db:seed
```

The seed command creates roles and example monthly plans. It creates the administrator account only if you set a real `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` first.

### 4. Start FILMORA

The frontend is a React app (in `frontend/`). You can run it two ways.

**A. Development (hot reload) — two PowerShell windows**

```powershell
# window 1 — API
cd backend
npm run dev

# window 2 — React app
cd frontend
npm install
npm run dev
```

Open:

- Website: http://localhost:5173 (Vite forwards `/api` calls to the backend on port 4000)
- Admin dashboard: http://localhost:5173/admin
- API health check: http://localhost:4000/api/health

**B. Production-style (one server)**

```powershell
cd frontend
npm install
npm run build        # creates frontend/dist
cd ..\backend
npm run dev
```

Open http://localhost:4000 — Express serves the built React app and the API together.

Sign in to the website with the administrator email and password you configured.

### 5. Run tests

Open another PowerShell window:

```powershell
cd path\to\filmora\backend
npm test
```

## Configure live payments

1. Create and verify a Flutterwave merchant account.
2. Copy the secret key and webhook secret into `backend/.env`.
3. Set `FLW_REDIRECT_URL` to your public HTTPS API callback URL.
4. Configure the webhook URL as `https://YOUR-DOMAIN/api/webhooks/flutterwave`.
5. Set the same webhook secret in your Flutterwave dashboard and `FLW_WEBHOOK_SECRET`.
6. Test successful, failed, cancelled and delayed payments in sandbox mode.
7. Confirm that transaction verification checks reference, status, currency and amount before a subscription is activated.

The browser redirect is not proof of payment. The server verifies the transaction and the webhook is processed idempotently.

## Configure Cloudflare Stream

1. Create a Cloudflare account and enable Stream.
2. Create an API token with the minimum required Stream permissions.
3. Add `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_CUSTOMER_CODE` and `CF_ALLOWED_ORIGIN` to `backend/.env`.
4. Keep the API token on the server. Never put it in frontend JavaScript.
5. Add only movies you have permission to distribute.
6. In the admin dashboard, create a draft movie and enter its licence details.
7. Review the actual contract, then mark the licence verified.
8. Upload the video. The admin workflow provisions a direct resumable TUS upload URL; the video file is sent from the browser directly to Cloudflare.
9. Refresh the video status until Cloudflare reports it ready.
10. Publish only after the licence and video checks pass.

Cloudflare videos are created with signed-URL protection. Playback tokens are generated by the backend only after account, subscription and territory checks.

## Project documentation

- `docs/REVIEW_AND_CHANGES.md` — what was found in the uploaded ZIP and what was corrected.
- `docs/WORKFLOWS.md` — customer, payment, playback and admin workflows.
- `docs/MONETIZATION.md` — revenue model, metrics and admin operating model.
- `docs/DATABASE_OVERVIEW.md` — database entities and relationships.
- `docs/PROVIDER_SETUP.md` — Flutterwave and Cloudflare setup.
- `docs/SECURITY.md` — implemented protections and required hardening.
- `docs/TESTING.md` — automated and manual test steps.
- `docs/PRODUCTION_CHECKLIST.md` — items to finish before accepting real customers.

## Project structure

```text
filmora/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   ├── config/
│   │   ├── lib/
│   │   ├── middleware/
│   │   ├── routes/        auth, billing, movies, stream, account, admin, webhook
│   │   └── services/      billing, catalogue, cloudflare, flutterwave, licences
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── frontend/              React + Vite app
│   ├── index.html         Vite entry (mounts React)
│   ├── vite.config.js     dev proxy: /api -> localhost:4000
│   └── src/
│       ├── main.jsx  App.jsx  styles.css
│       ├── components/    Layout, AuthDialog, MovieCard, Plans, Collection ...
│       ├── context/       AuthContext (signed-in user + sign-in dialog)
│       ├── lib/           api client (CSRF), formatters
│       └── pages/         Home, Movie, Account, Admin, PaymentResult, Legal
├── docs/
├── reference-pdfs/        your original specification PDFs
├── docker-compose.yml
└── README.md
```

## Before public launch

Read `docs/PRODUCTION_CHECKLIST.md`. In particular, add email verification and password recovery, production database migrations/backups, support and refund procedures, legal terms/privacy notices, tax review, monitoring, hardened concurrent-device enforcement and a documented automatic-renewal flow if you need one.

Also check that the FILMORA brand name, domain and trademarks are available for your intended markets before investing in public branding.
