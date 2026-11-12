# ZIP review and corrections

## What was in the supplied archive

The uploaded `Files.zip` contained ten PDF documents, an empty `andys project/` folder and one small PNG. It did not contain JavaScript source files, a `package.json`, Prisma schema, frontend source folder or backend source folder. There was therefore no existing application code to repair.

The PNG was not needed for the software workflow and was excluded from the corrected package.

## Conflicts and decisions

| Original issue | Correction in this package |
|---|---|
| Several documents called FILMORA a free streaming website. | The system is now defined as paid monthly subscription video-on-demand (SVOD). |
| The business plan was missing from the technical database design. | Added `Plan`, `PlanPrice`, `Subscription`, `Payment` and `PaymentEvent` models. |
| A successful browser redirect could be mistaken for payment proof. | The backend verifies the provider transaction and checks reference, status, amount and currency. |
| There was no idempotent payment event workflow. | Added a unique payment event key and transactional settlement. |
| Movie playback was described without an explicit subscription entitlement. | Playback now requires a current active subscription. |
| Licensing information existed but was not enforced in a clear publication/playback workflow. | Publishing requires a verified current licence and ready video; playback checks the viewer territory. |
| The database documents contained an older and a newer proposed schema. | The newer `andys database 2.pdf` was treated as the later design reference and extended for billing. |
| The project folder was empty. | Added a new starter application that follows the chosen HTML/CSS/JS + Node/Express + PostgreSQL/Prisma + Cloudflare Stream stack. |
| The documents did not define an actual payment provider flow. | Added Flutterwave hosted checkout as an integration candidate, with manual monthly renewal in this first version. |

## Architecture retained

- Frontend: HTML5, CSS3 and vanilla JavaScript.
- Backend: Node.js and Express.
- API: REST.
- Database: PostgreSQL.
- ORM: Prisma.
- Video: Cloudflare Stream.
- Password hashing: Argon2id.
- Validation: Zod.
- Sessions: HTTP-only cookies backed by PostgreSQL.

MongoDB and React were not substituted into this package because the uploaded architecture documents consistently selected PostgreSQL/Prisma and a plain JavaScript frontend.

## What is implemented

- Registration/login/logout and secure password hashing.
- Database schema and seed data.
- Monthly plans and localized plan-price structure.
- Flutterwave Standard hosted checkout.
- Webhook signature validation, server-side transaction verification and idempotent settlement.
- Subscription access checks.
- Content licence and territory checks.
- Cloudflare TUS upload URL generation.
- Cloudflare video status refresh.
- Signed playback token generation.
- Basic admin dashboard and movie publishing workflow.
- Automated tests for key billing and licence rules.

## What still needs credentials or real-world setup

No API keys, payment account, Cloudflare account, production database, domain, movie rights or email service were supplied. Those cannot be fabricated. The integrations remain inactive until you configure your own credentials and test them.

This package is a development foundation. It is not a claim that a production global streaming service is ready to accept real customers.
