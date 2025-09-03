
# Secure Premium Membership Flow (PayPal + Firebase)

## What changed
- Removed **registration-free*** and **dating*** pages and scripts.
- Added **register-premium.html** with signup + email verification + PayPal ($10).
- Added **list-of-member.html** (restricted to verified + paid users) with profile editor (one photo, bio, lost names) saved to Firestore & Storage.
- Hardened **firestore.rules** and **storage.rules** to require both `email_verified` and `member` custom claim.
- Added Cloud Function **verifyPayPalOrder** that verifies the PayPal order server-side and sets the `member` custom claim on the user.

## Setup (one-time)
1. In **assets/js/firebase-config.js**, set your Firebase config (already present).
2. In Firebase Console → Authentication → Sign-in method: enable **Email/Password**.
3. Deploy security rules:
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only storage:rules
   ```
4. Deploy Cloud Functions and configure PayPal API keys:
   ```bash
   cd functions
   npm install
   firebase functions:config:set paypal.client_id="YOUR_PAYPAL_CLIENT_ID" paypal.secret="YOUR_PAYPAL_SECRET"
   firebase deploy --only functions
   ```
5. In **register-premium.html**, replace `{{PAYPAL_CLIENT_ID}}` with your actual PayPal **Client ID**.

## How it works
- User signs up → verification email is sent.
- After clicking the email link, they return to **register-premium.html** and click **I verified**.
- PayPal button becomes active; upon payment, the function **verifyPayPalOrder** checks the order and sets a custom claim `member: true`.
- The user is redirected to **list-of-member.html**, which requires both `email_verified === true` and `member === true`.

## Notes
- Without the Cloud Function, marking users as "paid" purely on the client is insecure. The provided function is required for a secure public repo.
- Storage uploads are limited to a single image per user (`members/{uid}/profile.jpg`, max 5 MB).


## What I changed (Sep 3, 2025)
- Added `login.html`, `forgot-password.html`, `dashboard.html` with modern UI and bindings to `assets/js/auth.js`.
- Implemented admin plan controls in `assets/js/admin-dashboard.js` (buttons to set Free/Premium).
- Switched gating logic to also honor `users/{uid}.plan === 'premium'` (besides legacy custom claims).
- Hardened security: rewrote `firestore.rules` and `storage.rules` to allow admin either via custom claim **or** presence of `/admins/{uid}` doc; only admins can change another user's plan.
- Added Cloud Function `setAdmin` to toggle admin claim and mirror to Firestore (`functions/index.js`).
- Added `seed-admin.html` + `assets/js/seed-admin.js` for first-time admin seeding (edit UID array there).

### After deploy checklist
1. Fill `assets/js/firebase-config.js` with your Firebase project keys.
2. Deploy rules:
   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```
3. Deploy functions (for PayPal + admin toggles via claims):
   ```bash
   cd functions
   npm i
   firebase functions:config:set paypal.client_id="YOUR_ID" paypal.secret="YOUR_SECRET"
   firebase deploy --only functions
   ```
4. Seed your first admin:
   - Build & host the site locally or on Firebase Hosting.
   - Sign up & verify email.
   - Edit `assets/js/seed-admin.js` and put your UID into `SEED_ADMIN_UIDS`.
   - Open `/seed-admin.html` while logged in and click **Make me admin**.
5. In **Admin Posts** screen, use **Set Premium / Set Free** to add/remove users from the paid plan. Paid members can now access `list-of-member.html` and register their profile.

### Notes
- Email verification is enforced before any restricted access.
- Forgot-password flow sends reset email via Firebase Auth.
- Profile uploads are limited to 5 MB and image/* types.
