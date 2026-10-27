# Phase 1: security and release checklist

What changed on branch `phase1-hardening`, and what must happen **before this is merged to `main`**, because a push to
`main` deploys to the EC2 server automatically.

## Fixed in this branch

| Problem | Fix |
|---|---|
| Anyone could register with `role: "admin"` and use every admin endpoint | Role is always `user` on signup; admins are created only with `scripts/createAdmin.js` |
| Login (and Google login) returned the password hash and the email/reset tokens, and the frontend stored them in localStorage | Fixed public shape: id, name, email, role, isVerified, emailVerified, profilePicture |
| Government IDs uploaded to S3 with `ACL: public-read`, stored as permanent URLs | Private objects; the DB stores an opaque ref; admins get 5-minute signed URLs; file content is sniffed (PNG/JPEG/PDF) and stored under a random name |
| `/uploads` served everything in `backend/uploads` | Only `/uploads/profile` is public |
| `PATCH /admin/verify-user` returned the whole user row | Returns id, name, email, isVerified |
| forgot-password / resend-verification revealed which emails are registered | Same answer either way |
| Role was trusted from a 7-day JWT; deleted or demoted users kept access | Role and existence are read from the DB on every request |
| Open CORS, no rate limits, no body limit, no input validation | `CORS_ORIGINS` allow-list, helmet, global + auth rate limits, 100 kb JSON limit, zod validation |
| `createAdmin.js` used a published default password | Requires `ADMIN_EMAIL`; password from `ADMIN_PASSWORD` or generated and shown once |
| No tests; every push to `main` deployed | 27 backend tests, CI (backend tests + frontend build), deploy now `needs: ci` |

## Payments and the delivery lifecycle (second part of this branch)

Reading the payment code turned up more than a missing webhook, so this is a rework of how a delivery moves from
"created" to "delivered":

| Problem | Fix |
|---|---|
| The browser chose the amount (`amount: 10.0`), so a sender could pay $0.01 | Price comes from `DELIVERY_FEE_CENTS` on the server; the browser sends only the delivery id |
| Anyone could start a checkout for any delivery id | Only the delivery's sender; others get 404 |
| "Payment Successful" page shown to anyone who opened the URL; nothing recorded the payment | `Payment` table; a delivery becomes `paid` only through the signature-verified Stripe webhook; the success page asks the server and polls |
| No webhook idempotency or amount check | Each event id is stored once (replays are no-ops); amount and currency must match what the server asked for |
| `POST /api/request` and `PATCH /api/request/:id/accept` had **no authentication** | Login required; the sender must own the delivery; only the requested traveler can accept; one transaction claims the delivery |
| Any verified user could mark any delivery accepted or delivered; accepting never recorded who the traveler was | `Delivery.travelerId`; accepting is one conditional UPDATE (two travelers cannot both win); only the assigned traveler (or an admin) can complete |
| Travelers saw every pending delivery, paid or not, and other travelers' accepted ones | Only paid, unclaimed deliveries plus your own jobs |
| `GET /api/request/mine` returned the sender's whole user row, password hash included | Selected fields only |
| `CreateDelivery` read `res.data.deliveryId`, which the API never returns, so checkout was started with `undefined` | Uses `res.data.id` |

Tested with a fake Stripe client for session creation and Stripe's real signing and verification code for webhooks.
**Not tested against real Stripe.** Do a full run in test mode (see below) before taking real money.

### Setting up Stripe (test mode first)

1. Set `STRIPE_SECRET_KEY` (`sk_test_...`) and `DELIVERY_FEE_CENTS` on the server.
2. Add a webhook endpoint `https://<api-host>/api/payments/webhook` in the Stripe dashboard with the events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `charge.refunded`;
   put its signing secret in `STRIPE_WEBHOOK_SECRET`. Locally: `stripe listen --forward-to localhost:5050/api/payments/webhook`.
3. Pay with test card `4242 4242 4242 4242` and watch the delivery flip to `paid` on My Deliveries.
4. Check the nginx config passes the raw request body to Node unchanged (no body rewriting on that path).

## Handover code, delivery confirmation and manual payouts (third part of this branch)

How a delivery now ends, and how money reaches the traveler:

1. A traveler accepts a paid delivery. The sender can open **Show handover code** in My Deliveries (6 digits).
2. The sender gives the code to whoever receives the package. The traveler asks the recipient for it and enters it at drop-off
   (**Mark as Delivered**). The code is not stored: it is derived from the delivery id, a per-delivery salt and a server
   secret. Five wrong tries lock the delivery (an admin can complete it).
3. The sender has `AUTO_CONFIRM_HOURS` (72) to **Confirm** or **Report a problem**. If they do nothing, it counts as confirmed.
4. **Admin > Payouts > Ready to pay** lists every traveler who is owed money, with the platform fee already taken off
   (`PLATFORM_FEE_PERCENT`, 20 by default). You pay the traveler yourself (bank transfer, Zelle, whatever you use), type the
   reference, and press **Mark as paid**. A delivery can be paid out once; the screen keeps the history.
5. **Disputes**: the sender's report freezes the payout. The admin writes a decision note and either **Releases** the money to
   the traveler (it then shows up in Ready to pay) or **Refunds** the sender through Stripe (asks for a second click).

Tested: 71 backend tests; the sender and admin screens were also clicked through in a browser against the dev server
(show code, wrong and right code, confirm, report, mark paid, release, refund failing safely without Stripe).
**The traveler's page (Requests to Me) was not exercised in a browser**: it lists jobs through Google Maps routing, which needs a
key. Its code-entry form is covered by the API tests and compiles under `CI=true`, but click through it once you have a Maps key.

Things this does not solve, so you can decide how much they matter for the beta:
- **Traveler no-shows.** If a traveler accepts and disappears, nothing happens until the sender reports a problem. There is no
  automatic timeout or re-listing.
- **Collusion.** A sender and traveler who are the same person (two accounts) can still run money through the platform; the
  code only proves the recipient had the code, not that a package moved. Keep the beta to people you can identify.
- **Status emails are event-driven only.** Paid, accepted, delivered, confirmed, disputed, refunded and paid-out each send an email (`utils/notify.js`; printed to the console without SMTP). There is no scheduler, so nobody gets a *reminder* before the auto-confirm window ends, and a delivery that auto-confirms by timeout sends no "payout is due" email. Sending is fire-and-forget: a mail outage is logged, never surfaced to the user. The mailer is still Gmail SMTP, which is fine for a closed beta (about 500/day) but not for launch: move to a transactional provider.
- Payouts are manual and only recorded here; the app never moves money to a traveler.

## Terms, prohibited items and declared value (fourth part of this branch)

- **Signup requires accepting the Terms, the Privacy Policy and the prohibited-items rules.** The version and time are stored on
  the user. People who signed up before this existed, Google sign-ups, and everyone whenever `TERMS_VERSION` changes are sent to
  "Before you continue" before they can create or take a delivery, post a trip, send a request or pay. Finishing, confirming and
  disputing a delivery are not gated, so nobody is stranded mid-delivery. Admins are exempt.
- **A sender declares the item's value** (capped by `MAX_ITEM_VALUE_CENTS`, default $200) and ticks that the contents are not on
  the prohibited list. Both are stored (`declaredValueCents`, `contentsConfirmedAt`), and travelers see the value before they accept.
- **One source of truth:** `backend/config/legal.js` holds the prohibited list, the traveler rules and the terms version; the app
  reads them from `GET /api/legal/rules`, so the screens cannot disagree with the server.
- `/terms`, `/privacy` and `/prohibited-items` are public pages with footer links. **They are a draft written without a lawyer**
  and carry a visible banner. Bracketed sections ([refund policy], [liability], [retention periods]) are deliberately left for you.

**Before launch you must:** set `COMPANY_NAME` and `SUPPORT_EMAIL` (until then the pages show a red `[set COMPANY_NAME ...]`),
have the Terms and Privacy pages reviewed and filled in, then remove the banner in `frontend/src/components/LegalPage.js`.
Whenever you change the legal text or the list, bump `TERMS_VERSION` in `backend/config/legal.js`.

Also found and fixed here: posting a trip never required ID verification or valid input, and the trip auto-match created requests
for unpaid and own deliveries (it bypassed the payment rule and exposed unpaid senders to travelers); the signup form allowed
6-character passwords while the server requires 8; and signup and delivery creation used blocking `alert()` popups.

## Before merging to `main` (production impact)

1. **Set `CORS_ORIGINS` on the server** to the real site origin (e.g. `https://shipify.example.com`). The default is
   `http://localhost:3000` only, so without this the production frontend gets blocked by CORS.
2. **Set `TRUST_PROXY=1`** if nginx sits in front of Node. Without it every user shares one IP and the 20-per-15-minutes
   login limit applies to *everyone at once*.
3. **Check the server `.env`**: `JWT_SECRET` must be at least 16 characters (32 if `NODE_ENV=production`) or the app
   refuses to start. Set `NODE_ENV=production`.
4. **Look for rogue admins.** The registration hole may have been live in production:
   `select email, "createdAt" from "User" where role = 'admin';` and delete anyone you do not recognise.
5. **Rotate `JWT_SECRET`** if there is any chance a token or the old login response was exposed (this logs everyone out).
6. **S3:** turn on "Block all public access" for the bucket. Existing documents were uploaded as public objects and stored
   as full URLs; they keep working through the legacy path until migrated. Migrate them to the private `doc:` scheme
   (copy the object, store `doc:<key>`, remove the public ACL), then treat the old URLs as compromised.
7. **Purge `backend/uploads/`** from git history. Seven files were committed in 2025 (5 PDFs). If they are real documents,
   removing them from the working tree is not enough. Use `git filter-repo`, then force-push.
8. **The migration runs `payments_and_delivery_traveler`** (additive: two columns, two tables). Every existing delivery
   becomes `paymentStatus = 'unpaid'`, so open deliveries from before this change **disappear from traveler matches** until
   they are marked paid. Review open rows and set `paymentStatus = 'paid'` for any that were really paid in Stripe.
   Deliveries already `accepted` have no `travelerId`; nobody can complete them except an admin until you assign one.
9. **A second migration, `handover_confirmation_payouts`** (additive: delivery columns and a `Payout` table). Deliveries that are
   already `accepted` get a handover code the first time their sender opens it. Create at least one admin
   (`ADMIN_EMAIL=you@example.com node scripts/createAdmin.js`) so someone can use the Payouts screen.
10. **A third migration, `terms_and_declared_contents`** (additive). Every existing user starts with no accepted terms, so they will
    see the accept screen on their next login. Existing deliveries have no declared value (shown as nothing).
11. The first deploy runs `npm install --production`, which now needs the new dependencies (helmet, express-rate-limit,
   zod). That is automatic, but check the pm2 logs after deploying.

## Known gaps (not done in this phase)

- **Automatic payouts (Stripe Connect):** payouts are manual for now (see above). Build Connect only once the idea has proven itself.
- Broken or dead routes found on the way and **not** fixed: the frontend calls `/api/ratings/...` but the server mounts
  `/rating`; `MatchTrips` calls `GET /api/match/:id`, which does not exist; `matches-for-traveler` calls the Google
  Directions API for every trip on every request with no caching (cost, and slow).
- Reset and email tokens are stored in plain text in the DB (hash them).
- Socket.IO authenticates the JWT but, unlike the HTTP routes, does not re-check the user in the DB.
- `nodemailer` (high) and `aws-sdk` v2 (moderate) still have advisories that need major upgrades; `aws-sdk` v2 is end-of-life.
- The frontend (Create React App) is unmaintained and has its own dev-dependency advisories.
- Google login accepts an ID token but the audience is not pinned beyond `GOOGLE_CLIENT_ID`; review before enabling.

## Running the tests

```
createdb shipify_test
DATABASE_URL=postgresql://$USER@localhost:5432/shipify_test npx prisma migrate deploy
cd backend && npm test        # refuses to run unless the database name contains "test"
```
