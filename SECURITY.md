# Security

## What protects what

| Asset | Protection |
|---|---|
| Admin screens and actions | Password plus authenticator code (`aal2`), checked in middleware, in every server action, and again in the database (RLS `is_staff()`). |
| Purchase price, minimum price, finance | Encrypted in the browser with the vault key (Argon2id 64 MiB, then AES-256-GCM, with the field name bound to each value). The server, the database and backups hold only ciphertext. The key stays in memory and locks after 5 minutes idle or when the app goes to the background. |
| Finance page | Vault password, plus a fresh authenticator code. The server checks that the code was entered in the last 10 minutes. |
| ID numbers | AES-256-GCM on the server with `ID_NUMBER_KEY`, which is kept outside the database. HMAC for exact search. Only the last 4 digits are ever shown. |
| Deal documents, scrap photos | Private buckets. View links are signed and expire after 60 seconds. Each bucket has a size limit and a file-type limit. |
| Public forms | Same-origin check, 16 KB body cap, zod validation, honeypot, minimum time on the form, rate limits in memory and in the database. The database functions can be called only with the service role. |
| Audit | Inserts, updates and deletes on sensitive tables are logged with the user and the changed column names. Values are never logged. The log is append-only. |
| Retention | `purge_personal_data()` runs daily: leads that didn't become a deal are deleted after 24 months, closed scrap requests after 12 months. |

## Before going live (Supabase dashboard)

1. Run `supabase/migrations/0001_init.sql`, then `0002_security.sql`.
2. **Authentication → Providers → Email:** turn off "Allow new users to sign up". Create the staff users yourself.
3. **Authentication → Multi-Factor:** enable TOTP.
4. **Authentication → Policies:** set a minimum password length of 12 and turn on leaked-password protection.
5. **Database → Extensions:** enable `pg_cron`, then run `0002_security.sql` again so the daily purge is scheduled.
6. **Database → Backups:** confirm daily backups. Prices and finance stay encrypted inside them.
7. Add a row to `staff` for each user. Set `vault_access = false` for anyone who should not see prices.

## Vercel

- Set every variable in `.env.example`. Never set `GCAR_DEMO` in production, because the app refuses to start in demo mode on the production deployment.
- `SUPABASE_SERVICE_ROLE_KEY`, `ID_NUMBER_KEY`, `ID_NUMBER_HMAC_KEY`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY` and `GEMINI_API_KEY` are server-only. Never prefix them with `NEXT_PUBLIC_`.

## Demo mode

Demo mode runs only under `next dev`, or with `GCAR_DEMO=1` plus a `DEMO_SECRET` of at least 32 characters, and never on Vercel production.

## Tests

```bash
npm test
# SQL tests (Postgres 16): stub → 0001 → 0002 → rls_test.sql → security_test.sql
```

## Known limits

- The in-memory rate limit is per server instance. The database limit is the real one.
- Photos in the public `vehicle-photos` bucket have random, unguessable paths, but photos of unpublished cars are still public to anyone who has the link.
- Losing both the vault password and the recovery code means the encrypted prices cannot be recovered. This is by design.
