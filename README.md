# LocalLoop — Review and Local Presence Engine

Multi-tenant Next.js App Router / TypeScript / React / Tailwind application with Supabase Auth/Postgres, Twilio SMS, Resend email, Google Business Profile review ingestion, QR print assets, and an embeddable review widget.

## Run the two-minute demo

Requires Node 22+. No provider credentials are needed for the labeled fictional demo.

```sh
npm ci
npm run dev
```

1. Open `http://localhost:3000/dashboard`: Brooklyn Corner Barbers, sample customers, delivery states, Google reviews, feedback, and metrics.
2. Open `/r/demo-visit` on a phone: Google review CTA is visible immediately, alongside optional private feedback. Demo CTA opens an explanatory demo screen; it never solicits a real review for a fictional business.
3. Open `/dashboard/send`: show the name/contact/consent quick-send flow. Demo actions never send or persist live messages.
4. Open `/dashboard/qr`: scan the QR or download PNG, SVG, or a two-page PDF containing a counter card and foldable table tent.
5. Open `/dashboard/widget` and `/dashboard/reports`: show the embed snippet and sample Premium report.

When demonstrating with your phone, use a reachable deployment or development-host address. A phone cannot reach another computer's `localhost`. The app generates QR URLs from the page origin in the browser; set `APP_URL` to your reachable HTTPS origin for server-generated assets.

## Application routes

- `/dashboard`, `/dashboard/send`, `/dashboard/customers`, `/dashboard/templates`, `/dashboard/qr`, `/dashboard/reviews`, `/dashboard/widget`, `/dashboard/reports`, `/dashboard/settings`, `/dashboard/operator`.
- `/r/[token]` for tracked review requests; legacy `/r/[businessSlug]?t=UUID` remains supported.
- `/b/[orgSlug]` for anonymous QR visitors. Private feedback is available without making a Google review conditional on it.
- `/widget/[orgSlug]`, `/widget.js`, `/unsubscribe?t=UUID`.

The root `/` also opens the owner dashboard. Tabs update the URL and support direct links. Staff can manage customer/request work; business settings, access, templates, and manual review-assistance changes require owner/operator permissions on the server. Global operators can see and select all businesses; owners/staff see only their memberships.

## Database setup and upgrades

Create a Supabase project. Run **all** SQL files in `supabase/migrations/` in numeric order. Existing installations that already applied 001 and 002 apply only **003_complete_engine.sql**. Do not rerun earlier migrations on an existing database.

Migration 003 is additive and retains existing customers, review requests, and reviews. It replaces the original one-business-per-user constraint with memberships and roles, and adds consent proof, channel opt-outs, queue cancellation triggers, templates, reports, notifications, and server-side aggregate metrics. Existing consent records without a source cannot enroll in new campaigns until the operator supplies genuine consent evidence; the migration does not invent that evidence.

The original tables retain their names for compatibility. Specification names `organization_members`, `review_requests`, `google_reviews`, and `private_feedback` are security-invoker views over the RLS-protected tables. `customers` exposes generated specification aliases, including `organization_id`, `full_name`, `phone_e164`, `consent_given`, and `consent_timestamp`. `organizations.google_review_url` aliases the original `google_url`. Application domain and database types live in `lib/types.ts` and `lib/database.types.ts`.

Optional fictional database demo: run `supabase/seed.sql` **after all migrations**. It is repeatable and includes a demo token, customers with opt-outs, reviews across ratings, templates, feedback, metrics, and a monthly report. It does not create an Auth user or seed a password. Link an existing Auth user:

```sql
insert into public.memberships(user_id,org_id,role)
values ('YOUR_EXISTING_AUTH_USER_UUID','d0000000-0000-4000-8000-000000000001','owner')
on conflict(user_id,org_id) do nothing;
```

The reserved `brooklyn-corner-demo` tenant cannot send customer campaigns, even with providers configured. Use a separately onboarded real business for live acceptance tests.

Provision a trusted global operator in the Supabase SQL editor:

```sql
insert into public.operators(user_id) values ('YOUR_EXISTING_AUTH_USER_UUID');
```

No browser/API can self-promote to global operator. The operator screen can onboard tenants and add existing authenticated users to a business by UUID; it does not send unsolicited invitation emails. Tenant selection uses an HTTP-only cookie that is revalidated against membership/operator access on every server operation.

## Configure real services

Copy `.env.example` to `.env.local` for development; configure the same values in Vercel for deployment. Never commit credentials.

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`. Set Auth Site URL to your final HTTPS origin and allow `/auth/callback`. Configure Supabase Auth SMTP separately; the application's Resend API key does not configure magic-link email delivery.
- **Canonical origin:** `APP_URL` must be the exact public HTTPS origin, with no trailing slash. It is used for provider callback signatures, OAuth, messages, and printable assets.
- **Twilio:** configure an approved US A2P 10DLC campaign and Messaging Service. Set account SID, auth token, Messaging Service SID, and set `TWILIO_A2P_APPROVED=true` only after approval. Enable Advanced Opt-Out. Inbound callback: `POST /api/webhooks/twilio/inbound`. Status URLs are attached to outgoing messages. The old combined `/api/webhooks/twilio` endpoint remains supported. Signed callbacks are validated against `APP_URL` plus the exact callback path/query.
- **Resend:** verify the sending domain and set `RESEND_API_KEY` and `EMAIL_FROM`. Subscribe `/api/webhooks/resend` to delivered, bounced, complained, and failed events. Set `RESEND_WEBHOOK_SECRET`. Email uses RFC one-click unsubscribe headers and an unsubscribe link in the body.
- **Google:** enable Business Profile Account Management, Business Information, and Google My Business APIs; obtain required access approval and OAuth verification. Set client ID, client secret, and `GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/api/google/callback`. Set `TOKEN_ENCRYPTION_KEY` to 32 random bytes encoded as 64 hex characters (`openssl rand -hex 32`). Keep it stable and backed up. Owners/operators connect Google and select a managed location in Settings. OAuth state is bound to the initiating tenant. First sync imports history without historical-review alerts; later new reviews queue owner alerts.
- **Scheduling:** set a strong `CRON_SECRET`. The included Vercel schedule calls authenticated `GET /api/cron` every ten minutes; this runs follow-ups, Google sync, monthly reporting, and notification delivery independently. Select a Vercel plan supporting the cadence and 300-second function duration. An external scheduler may instead call authenticated `POST /api/cron/sequence-runner` and `POST /api/cron/sync-google-reviews`. Both require `Authorization: Bearer YOUR_CRON_SECRET`. Keep the combined cron scheduled for monthly reports and notification retry processing.

Onboard a real business, configure its direct Google review URL, brand and owner contacts, then connect its Business Profile. Supported direct links include `https://search.google.com/local/writereview?placeid=...` and `https://g.page/r/.../review`; generic Google homepages are rejected.

## Core API contracts

All owner mutations validate origin and tenant access server-side. Customer feedback and unsubscribe use public request capabilities; provider callbacks verify signatures; cron requires its secret.

- `POST /api/requests/send`: `{customer_id,channel}` or `{customer:{name,phone,email,sms_consent,email_consent,consent_at,consent_source},channel}`. Channels: `sms`, `email`, `multi_channel`. New contacts are normalized and checked for consent; opt-outs win. Initial messages dispatch immediately. Response includes request ID and provider queue results. Inspect Delivery details to distinguish accepted, delivered, failed, and unknown messages.
- `POST /api/customers/import`: `{csv,mapping,enroll,channel}`. Mapping keys: `name`, `phone`, `email`, `sms_consent`, `email_consent`, `consent_timestamp`; a mapped `consent` column can supply both flags when the underlying proof covers both channels. The CSV includes real original ISO timestamps. Maximum 500 rows/1 MB. Validation happens before persistence, and a database function imports atomically. Existing contacts retain consent/opt-outs and update their name. Conflicting duplicate identities reject the batch. Optional enrollment returns per-customer outcomes; one customer's ineligibility does not silently fail the others.
- `GET /api/customers?page=0&search=Alex&opted_out=true`: paginated directory.
- `GET/POST /api/templates`: per-channel, per-step templates with subjects and hourly delays. Initial delay is zero; follow-up is 1–336 hours. Variables: `{{customer_name}}`, `{{business_name}}`, `{{review_link}}`, `{{opt_out_text}}`; legacy variables remain supported. Sender name and opt-out instructions are enforced at send time even if removed from the editable template.
- `POST /api/settings`, `/api/organization`, `/api/members`, `/api/reviews`, `/api/feedback/resolve`: branding/business configuration, validated tenant switch, role assignment, manual reply-assistance/widget visibility, and feedback resolution.
- `GET /api/assets?format=png|svg|pdf`: printable tenant QR assets.

## Compliance and message semantics

Every customer has immediate access to the Google review button, regardless of feedback or sentiment. No rating gate, incentives, AI public review posting, Yelp automation, social/ad management, card-data handling, or local ranking guarantees are included.

Consent records include channel flags, original timestamp, and source. A database trigger writes the audit event atomically. Do not import consent you do not have. US phones normalize to E.164; international numbers must include country code. Reimport never re-subscribes opted-out contacts.

Twilio STOP/UNSUBSCRIBE/CANCEL/END/QUIT suppress the destination for SMS across the shared sender. Email complaints/bounces suppress email. Database triggers immediately cancel queued/processing jobs for the affected channel. Public unsubscribe stops both channels for that business and records proof. Eligibility is checked again before provider calls. A provider call already in flight cannot be recalled.

Requests support both channels and one follow-up per channel. Clicks stop all follow-ups; a click is **not** proof of a published review. Database claims use `FOR UPDATE SKIP LOCKED` and leases. Before network I/O a job is durably marked `unknown`; ambiguous outcomes are not blindly resent. Reconcile unknown jobs with provider logs. Resend requests also use idempotency keys. Twilio callbacks carry the local message ID to handle early delivery callbacks. Delivery statuses do not regress to sent when callbacks arrive early.

Owner alerts use a durable idempotent notification queue. SMS owner alerts require a configured owner number, explicit opt-in via the settings toggle, and approved Twilio setup. Suppressions apply to owner SMS too. Missing provider setup leaves owner notifications queued; failed/unknown provider outcomes are visible in the database for operator reconciliation.

## Premium and billing

Plans are recorded per tenant: Standard $79/month, Premium $129/month; the $299 setup fee has amount and paid-at tracking. Invoicing/payment collection remains external; the application never collects raw card data. Premium includes persisted monthly activity reports, email report notifications, report printing, and manual review-response draft/status tracking. Public replies are copied to Google manually, never generated or posted by AI.

Monthly reports cover the preceding UTC calendar month and distinguish contacts, messages, link opens, opt-outs, new Google reviews, and feedback. Google aggregate totals come from Google. Dashboard delivery/click-through rates use database aggregates rather than a capped browser history. Activity feeds show recent records; the customer directory paginates the complete collection.

## Verification

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Browser tests start the production server on port 3001. To use an existing Chromium installation: `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`. To test an existing server: set `TEST_BASE_URL`.

The SQL tests execute every migration and repeat the seed in embedded PostgreSQL, exercising role boundaries, tenant isolation, opt-out cancellation, consent evidence, multi-channel enrollment, and metrics access. Browser tests exercise the dashboard routes, mobile layout, always-visible Google CTA, feedback, unsubscribe, template previews, quick-send demo, widget script, PNG/SVG/PDF downloads, and webhook/cron guards. See `VERIFICATION.md` and `audit-evidence/` for this run's results and screenshots.

Live acceptance still requires your configured Supabase, Twilio, Resend, Google, and Vercel accounts: use two tenant accounts; send only to consented contacts you control; verify signed delivery callbacks, STOP/unsubscribe cancellation, Google OAuth/ingestion, owner alerts, reports, and cron behavior. No source build can prove carrier delivery, Google API approval, or production account configuration.

Before paid onboarding, configure backups/PITR, error monitoring and cron alerts, a business retention policy, and operator procedures for data export/deletion and provider reconciliation. Do not delete a shared sending identity when offboarding a single tenant.
