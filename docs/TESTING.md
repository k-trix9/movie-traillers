# Testing guide

## Automated tests included

Run from `backend/`:

```powershell
npm test
```

The included Node test suite checks:
- Flutterwave transaction reference/status/currency/amount validation.
- Month-end billing date calculation.
- Worldwide and country-specific licence coverage.

## Local smoke tests

1. Start PostgreSQL and run the Prisma setup commands.
2. Start the backend.
3. Open `http://localhost:4000/api/health`; expect `{ "status": "ok", ... }`.
4. Register a normal customer account.
5. Sign out and sign back in.
6. Confirm that monthly plans appear.
7. Open `/admin.html` after signing in with the seeded administrator.
8. Create a draft movie and licence record.
9. Verify the licence only after checking the real distribution agreement.
10. Configure Cloudflare Stream and upload a video you own or are authorised to distribute.
11. Refresh the video status until it is ready, then publish it.
12. Confirm that a signed-in user without a paid subscription receives an access-denied response when requesting playback.
13. Complete a Flutterwave sandbox payment and verify that the subscription becomes active only after server-side transaction verification.
14. Confirm that a duplicate webhook does not extend the subscription twice.
15. Confirm that an expired subscription cannot request a new playback token.
16. Confirm that a movie with no valid licence for the viewer's territory is not listed or playable.
17. Sign in on more browser sessions than the selected plan permits and confirm the active-screen limit is enforced.

## Tests that require external setup

Payment tests require a Flutterwave sandbox account and a reachable HTTPS webhook URL. Video upload and playback tests require Cloudflare Stream credentials. Full integration tests also require a running PostgreSQL database.

Do not test with copyrighted feature films unless you have permission to use them.
