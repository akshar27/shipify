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
8. The first deploy runs `npm install --production`, which now needs the new dependencies (helmet, express-rate-limit,
   zod). That is automatic, but check the pm2 logs after deploying.

## Known gaps (not done in this phase)

- **Payments:** no Stripe webhook and no payment record, so "paid" is decided by the browser reaching `/payment-success`.
  This is the next thing to build.
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
