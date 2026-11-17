# gcar

Management system and public website for the gcar car lot: a mobile-first admin app plus the public catalog. Built with Next.js 15, Supabase and Vercel.

## Run locally (demo mode)

```bash
npm install
npm run dev        # http://localhost:3000
```

The app runs in demo mode when the Supabase environment variables are missing. It uses seeded in-memory data (`lib/demo.ts`), so every screen works without a database. Changes reset when the server restarts.

- Admin: `/admin`. Password `gcar-demo`, then any 6-digit code.
- Vault password (purchase prices and finance): `gcar-demo-vault`.

## Production

1. Create a Supabase project. Run `supabase/migrations/0001_init.sql`.
2. Create the staff user in Supabase Auth and add it to the `staff` table. On first sign-in the app enrols an authenticator app (TOTP).
3. On Vercel, set the variables from `.env.example`. Generate `ID_NUMBER_KEY` and `ID_NUMBER_HMAC_KEY` with `openssl rand -base64 32`.
4. In the admin, go to "עוד" and then "כספת", set the vault password, and keep the recovery code on paper.

## Security model

- Every `/admin` page and server action requires password plus TOTP (`aal2`). The database enforces the same rule again in RLS (`is_staff()`).
- Purchase price, minimum price and all finance rows are encrypted in the browser with the vault key (Argon2id, then AES-GCM). The database and the server only ever see ciphertext.
- The finance page also requires a fresh authenticator code. The server checks the TOTP timestamp in the session.
- ID numbers are encrypted on the server with an environment key. The app shows only the last 4 digits.
- Public forms are protected by a same-origin check, zod validation, a honeypot field, a minimum time on the form and rate limits.

## Tests

```bash
npm test                    # vault crypto, Israeli ID/phone, margin VAT
npm run typecheck
# RLS tests against Postgres 16: see supabase/tests/
```
