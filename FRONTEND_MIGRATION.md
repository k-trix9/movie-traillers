# Switching FILMORA's frontend to React

1. Close the running backend. In your `filmora` folder, DELETE the old frontend files:
   `frontend\css`, `frontend\js`, and every `frontend\*.html` file
   (index, movie, account, admin, payment-result, terms, privacy).
2. Copy this package's `frontend\` folder into `filmora\` (it becomes the new `frontend\`).
3. Copy `backend\src\app.js` and `backend\src\routes\billing.routes.js` over your existing ones.
4. Optional: replace `README.md` with the updated one.
5. Install and run (see README, step 4).

Your `backend\.env`, database and everything else stay untouched.
