# Verification — 2026-10-31

This implementation closes the original demo and functional gaps. See `REQUIREMENTS.md` for the specification mapping and `README.md` for setup.

## Local results

- `npm run typecheck`: passed.
- `npm run lint`: passed without warnings.
- `npm test`: **8 passed, 0 failed**. Tests include all migrations, tenant/role isolation, protected metrics, consent evidence, atomic import rollback, opt-out preservation, multi-channel enrollment, immediate queued-message cancellation, click cancellation, repeated seed execution, template sender enforcement, phone normalization, direct Google URL validation, and token encryption/tampering.
- `npm run build`: passed for the complete route set.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`: **4 test groups passed** against the production server. Checked dashboard routes, quick-send demo, template preview, always-visible Google CTA with negative feedback, unsubscribe, widget script/iframe, aggregate/review content, PNG/SVG/two-page PDF assets, mobile widths 320/375/768, and webhook/cron guards.
- `git diff --check`: passed.

Raw logs are under `audit-evidence/`. Browser screenshots: `dashboard-desktop.png`, `dashboard-mobile.png`, and `customer-review.png`. Sample data is visibly labeled and cannot send real campaign messages.

## Limits of this evidence

No Supabase, Twilio, Resend, Google, or Vercel credentials are configured in this workspace. Hosted Supabase Auth/RLS, actual SMS/email delivery, signed provider round trips, Google OAuth/ingestion, owner-alert delivery and deployed cron execution were not live-tested. They require account setup and a consented acceptance test. The SQL tests use embedded PostgreSQL with an Auth stub; they are not a substitute for hosted account verification.

No customer messages were sent, no raw card data is collected, and no public deployment was activated. Source push and local passing tests do not by themselves activate services or prove commercial outcomes.

Follow-up verification also covers one-tap unsubscribe directly from the request-page footer, operator first-login workspace selection, blocking legacy jobs without consent evidence, and excluding queued-only requests from customers-contacted metrics. All checks and browser groups pass after these changes.
