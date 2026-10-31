# LocalLoop — Review & Local Presence Engine

A Next.js App Router + React SaaS MVP for local service businesses. Supabase Auth/Postgres, Twilio SMS, Resend email, and Google Business Profile review sync. Designed for Vercel. The unconfigured local app shows **explicitly labeled sample data**; it cannot send messages or persist changes.

## Run locally

Requires Node 22+.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without Supabase configuration, explore the demo. Add real configuration to enable email-link login and durable tenant data. Never commit `.env.local` or service credentials.

```sh
npm run typecheck
npm test
npm run build
```

Tests exercise consent, input validation, Google URL validation, token encryption/tampering, and the actual SQL migration using embedded Postgres (PGlite). Database tests check tenant isolation, denied writes, cross-tenant request rejection, deduplication, suppression, and exclusive queue claims. PGlite uses an auth stub and a replacement random-bytes function; production uses Supabase Auth and pgcrypto. Real provider, OAuth, carrier, and deployed browser tests require configured accounts.

## Production setup

1. **GitHub**: create a private `local-presence-engine` repository and push this directory. No secrets are tracked. GitHub Actions runs typecheck, tests, and build.
2. **Supabase**: create a project. Apply `supabase/migrations/001_initial.sql` through the SQL editor or Supabase CLI. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The service role is server-only and must never use a `NEXT_PUBLIC_` name. Configure Auth Site URL to your final HTTPS URL and allow `/auth/callback` as a redirect. Configure a production SMTP sender for authentication email; the app's Resend key does not configure Supabase Auth SMTP.
3. **Vercel**: import the repository as a Next.js project. Add environment variables from `.env.example`, with `APP_URL` set to the exact canonical HTTPS origin (no trailing slash). Deploy. Use a plan that supports 10-minute cron scheduling and 300-second functions; the included Vercel cron runs `/api/cron` every 10 minutes with `Authorization: Bearer $CRON_SECRET`. For a different host, schedule that authenticated endpoint externally. Generate a strong CRON_SECRET. Never expose the cron route without it.
4. **Twilio**: configure a Messaging Service with an approved sending number and applicable A2P/10DLC registration (or your jurisdiction's equivalent). Set the account SID, auth token, and messaging service SID. Enable Advanced Opt-Out. Set inbound message/opt-out webhook to `https://YOUR_DOMAIN/api/webhooks/twilio` (POST). Status callbacks are included on outbound messages. Signature verification uses `APP_URL`, which must match Twilio's public callback origin. Carrier/A2P charges apply in addition to SMS usage.
5. **Resend**: verify your sending domain and set `RESEND_API_KEY` and `EMAIL_FROM`. Add webhook `https://YOUR_DOMAIN/api/webhooks/resend` for delivered, bounced, complained, and failed email events. Set `RESEND_WEBHOOK_SECRET` to the signing secret. Signatures are verified before status/suppression updates.
6. **Google**: create OAuth web credentials. Enable Business Profile Account Management, Business Information, and Google My Business APIs and obtain required API access approval. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/api/google/callback`. Configure the consent screen and required OAuth verification before broad external launch. Generate `TOKEN_ENCRYPTION_KEY` with `openssl rand -hex 32`; keep it stable and securely backed up. Refresh tokens are encrypted with AES-256-GCM. Changing the key requires reconnecting all accounts.
7. **Owner onboarding**: sign in through the email link, create a business workspace, add the direct Google review URL and branding in Settings, connect Google, load managed locations, and select a location. The next cron imports review history. Initial import does not send historical-review notifications; subsequent newly detected reviews create notifications and owner emails.
8. **Launch smoke test**: use two owner accounts and two businesses; verify each sees only their own records. Add a consented test contact you control, queue one email and one SMS on different days/contacts, run cron, inspect delivery callbacks, open the review page, submit feedback, and opt out. Confirm future sends cancel. Test QR scanning and widget embedding on your website. Verify counts against the Google Business Profile and confirm a new review produces an owner notification. This live smoke test has not been run without credentials.

Source repository: https://github.com/polancojoseph1/local-presence-engine. The repository was created by the owner. Live deployment and provider activation require the configuration above; a successful source push does not activate services.

## Features

- Email magic-link owner signup/login and one organization workspace per owner.
- Tenant-scoped customers, requests, messages, private feedback, reviews, stats, and notifications. Database RLS protects reads. Mutations validate the session/tenant server-side; enqueue and onboarding use restricted database functions.
- Manual customer entry and CSV import (500-row maximum, international E.164 phones, explicit channel consent flags, atomic duplicate rejection). Template: `public/customers-template.csv`.
- One request per customer per UTC day. Initial SMS/email plus one scheduled reminder, configurable 1–14 days. Consent and opt-out are checked again immediately before send. Reminder stops on a review-link click or opt-out. A link click is **not** proof of a published review.
- Branded public review page, direct one-tap Google link, optional token-protected private feedback. QR visitors receive the same public Google option without providing a rating or identifying themselves. Private feedback does not gate Google access.
- Downloadable QR PNG and copyable iframe widget; widget shows the latest six synced reviews across all ratings. Uses escaped React text, no public customer information.
- Counts, recent Google reviews, delivery states, link opens, opt-outs, feedback, owner email notifications, configurable branding/templates.
- Suggested commercial tiers are presented in Settings: $299 setup + $79/month, $129/month premium. **No automated billing, subscriptions, premium report generation, or response-assistance service** is implemented; fulfill and invoice these manually.

## Messaging and operations

The queue claims at most ten due jobs per cron using `FOR UPDATE SKIP LOCKED`. Claimed jobs have a ten-minute lease. A job is marked `unknown` immediately before calling a provider; ambiguous network/provider failures are not automatically resent, preventing blind duplicate sends. Resend also uses message IDs as idempotency keys. Inspect unknown jobs in Review requests and reconcile with provider logs before changing status. Never requeue an unknown job without confirming no message was accepted. Failed jobs caused by missing configuration may be requeued by an operator after fixing configuration. Pre-network processing jobs abandoned on a crash can be reclaimed after ten minutes. Higher volume needs a dedicated worker and separate Google sync schedule; the MVP targets low-volume tenants.

Provider callbacks update message delivery status. Sending acceptance is shown as `sent`, not `delivered`. Twilio STOP suppresses the number across the shared sender; email complaints/bounces suppress that address. Shared suppressions also apply to future imports. The customer unsubscribe link stops both channels for that business. Reimport cannot overwrite opted-out customers; duplicate contacts are rejected. Consent evidence beyond the recorded flag/timestamp remains the business's responsibility. No automatic re-subscription is provided.

Only the initial request's channel is used for its reminder. Templates get SMS STOP instructions or an email unsubscribe link appended. Google sync failures do not block other tenants; inspect the authenticated cron JSON for per-tenant sync failures and reconnect revoked accounts. Current sync imports Google-reported total/average and paginated recent reviews; historical deleted reviews are not purged from the local review cache in this MVP. The dashboard currently loads up to 500 customers and 200 records per activity collection; counts for contacted/delivery/link opens reflect loaded activity, while Google total comes from Google. Add server pagination/aggregates before a larger rollout.

Maintain encrypted backups, Supabase backups/PITR as appropriate, provider error monitoring, and cron alerts before paid onboarding. Tenant offboarding/data export and deletion currently require an operator via Supabase; do not delete a shared provider identity when offboarding one tenant. Google OAuth disconnect/reconnect is handled by replacing the business connection; a self-service disconnect screen is not included.

## Product boundaries

No AI public replies, Yelp automation, social media/ad management, review incentives, happy-customer routing, or local-ranking/review-count guarantees. Sell the operational workflow. Private feedback is optional and never changes public review access. Engineering/onboarding estimates supplied in the brief are planning estimates, not market evidence.

## Layout

- `app/` owner UI, public review/unsubscribe/widget pages, authenticated APIs, provider callbacks.
- `lib/` session/tenant checks, validation, queue processing, encrypted Google integration.
- `supabase/migrations/` schema, RLS, atomic onboarding/enqueue/queue claiming.
- `tests/` workflow and database security checks.

The Sites hosting workflow was not used: this deliverable preserves the explicitly requested Next.js + Supabase + Vercel architecture rather than converting it to a Cloudflare-hosted application.
