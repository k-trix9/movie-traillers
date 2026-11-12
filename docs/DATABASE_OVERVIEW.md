# FILMORA database overview

PostgreSQL stores structured application data. Cloudflare Stream stores the actual movie video files. The application database stores Cloudflare video IDs and processing state, not the full video files.

## Core commercial tables

| Model | Purpose |
|---|---|
| `User` | Customer and administrator accounts; password hashes only |
| `Role`, `Permission`, `UserRole`, `RolePermission` | Role-based access assignments |
| `Plan` | Basic, Standard, Family or future membership tiers |
| `PlanPrice` | Currency-specific price and billing interval for each plan |
| `Subscription` | Paid access period and current membership state |
| `Payment` | Checkout reference, expected amount, currency and verified payment status |
| `PaymentEvent` | Idempotency record for provider webhook/callback events |
| `DeviceSession` | Active playback session heartbeat used for screen limits |

## Movie and rights tables

| Model | Purpose |
|---|---|
| `Movie` | Title, slug, synopsis, release date, age rating and publication state |
| `Genre`, `MovieGenre` | Many-to-many movie genres |
| `Category`, `MovieCategory` | Curated movie collections |
| `Person`, `MovieCredit` | Actors, directors and other credits |
| `MovieMedia` | Poster, backdrop and image references |
| `MovieTrack` | Subtitle and audio track references |
| `VideoAsset` | Cloudflare Stream UID, processing and playback status |
| `ContentLicense` | Rights holder, contract reference, territory and licence dates |

## Customer activity and operations

- `WatchProgress` stores playback position.
- `Watchlist` and `WatchlistItem` store personal movie lists.
- `Favorite` stores liked titles.
- `Review` stores customer ratings and comments.
- `Notification` stores in-app messages.
- `EmailVerificationToken` and `PasswordResetToken` are token-hash structures for future email workflows.
- `Report` and `ModerationAction` support moderation operations.
- `AdminActivityLog` records important administrator actions.

The `user_sessions` table is created and managed by `connect-pg-simple` for Express sessions; it is intentionally not duplicated as a Prisma model.

## Important relationships

- A user can have many subscriptions and payments.
- A plan can have multiple currency prices.
- A subscription references one plan and one plan price.
- A payment references the plan price purchased and is linked to a subscription after verification.
- A movie can have many genres, categories, credits, media records, video assets, tracks and licence records.
- A video asset references a Cloudflare Stream UID.
- A movie can be published only after a verified current licence and a ready video asset exist.
- A playback request must pass subscription and territory checks before the backend issues a signed Cloudflare token.

## Currency and accounting rule

Store each payment in the currency actually charged. Never aggregate amounts from different currencies as if they were the same. Convert to a reporting currency only with a recorded exchange rate, conversion timestamp and documented accounting rule.
