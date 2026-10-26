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
9. The first deploy runs `npm install --production`, which now needs the new dependencies (helmet, express-rate-limit,
   zod). That is automatic, but check the pm2 logs after deploying.

## Known gaps (not done in this phase)

- **Money movement after payment:** the sender's payment is recorded, but nothing pays the traveler out (Stripe Connect),
  and there is no refund endpoint (a refund made in the Stripe dashboard is picked up by the webhook). "Delivered" is marked
  by the traveler, so before payouts exist it needs a sender confirmation or a handover code, or a traveler could mark
  anything delivered and claim the money.
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
