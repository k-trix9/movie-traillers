# Security design and required hardening

## Included in this starter

- Argon2id password hashing.
- Server-side sessions stored in PostgreSQL.
- HTTP-only, SameSite=Lax session cookies.
- Secure cookies in production.
- CSRF token checks for state-changing API requests.
- Helmet security headers and a restrictive content security policy.
- Exact-origin CORS configuration.
- Login rate limiting.
- Zod request validation.
- Role assignment and administrator-only dashboard routes.
- Secrets stored in backend environment variables.
- Server-side payment verification and webhook signature checking.
- Idempotent payment settlement.
- Subscription, licence and basic active-screen checks before generating playback tokens.
- Cloudflare signed playback tokens.

## Required before launch

1. Enforce HTTPS everywhere and configure trusted reverse-proxy settings correctly.
2. Set a unique, long `SESSION_SECRET` and rotate credentials if exposed.
3. Use production PostgreSQL credentials with least privilege and TLS.
4. Restrict database network access to the backend.
5. Block direct public access to the backend origin if relying on Cloudflare country headers.
6. Add email verification and secure password reset with hashed, expiring one-time tokens.
7. Add multi-factor authentication for administrators.
8. Add stronger role/permission middleware for content managers and moderators.
9. The starter includes basic session-based screen limits; load test and harden them against concurrent-login races and session abuse.
10. Add upload quotas, malware/content checks where relevant, file review and storage-cost alerts.
11. Add audit log review, monitoring, alerting and incident response.
12. Encrypt and regularly restore-test database backups.
13. Add privacy policy, terms, cookie disclosures, data retention and account deletion workflows.
14. Review payment rules, taxes, refunds, chargebacks, consumer law and privacy requirements in every market served.

## Important limitations

A signed video URL reduces casual unauthorized sharing but cannot prevent screen recording or every form of copying. Content protection is layered; obtain appropriate distribution rights and consider forensic watermarking/DRM requirements for premium licences.

The starter's admin licence-verification button is a software state change, not legal advice or proof of ownership. A person must inspect the underlying licence contract before marking it verified.
