# Production readiness checklist

The following items are not all implemented in this starter. Do not treat the project as ready for public paid launch until the required items are completed and tested.

## Business and rights
- [ ] Confirm the FILMORA name, domain and trademarks can be used in target markets.
- [ ] Sign distribution agreements for every movie.
- [ ] Confirm subscription streaming rights, territories, languages, term dates and any exclusivity.
- [ ] Publish terms of service, privacy policy, refund/cancellation policy and support contact.
- [ ] Review taxes, payment rules and consumer protection requirements in target markets.

## Payments and memberships
- [ ] Confirm the merchant account is approved for the countries and currencies you will serve.
- [ ] Configure live API credentials only in production secrets.
- [ ] Configure and test webhooks over HTTPS.
- [ ] Test duplicate, delayed, failed and reversed payments.
- [ ] Implement refund and chargeback workflows.
- [ ] Confirm monthly renewal disclosures and cancellation behavior.
- [ ] If adding automatic card renewal, implement explicit consent, token lifecycle, retry rules and cancellation.
- [ ] Add localized price records for each supported currency/payment method.

## Security and accounts
- [ ] Add email verification and password recovery.
- [ ] Add administrator MFA.
- [ ] Review role/permission boundaries.
- [ ] Load test and harden the starter device/session limit against concurrent login races and session abuse.
- [ ] Configure HTTPS, secure cookies, CSRF, CORS and reverse-proxy trust.
- [ ] Rotate and protect all secrets.
- [ ] Run dependency and security scans.

## Video and performance
- [ ] All uploaded titles have verified rights.
- [ ] All private Stream videos require signed URLs.
- [ ] Playback token expiry is appropriate.
- [ ] Test territory enforcement and the trusted country header.
- [ ] Test TUS uploads on large files and unreliable connections.
- [ ] Test adaptive playback on mobile and desktop.
- [ ] Add captions/subtitles and accessibility support.
- [ ] Set budget alerts and monitor storage/delivery usage.

## Operations
- [ ] Configure production database migrations.
- [ ] Configure encrypted backups and restoration tests.
- [ ] Add application logs, error reporting and uptime monitoring.
- [ ] Add customer support and account deletion processes.
- [ ] Load test APIs and concurrent video sessions.
- [ ] Test payment reconciliation and monthly revenue reports.
