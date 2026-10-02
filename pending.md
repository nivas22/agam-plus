# Subscription billing — pending / follow-up items

Tracking doc for what's deliberately deferred on the subscription billing feature, plus operational setup still needed before/after deploy. Not a feature backlog for the rest of the app — scoped to billing only.

## Must do before/at next deploy

- **Set `CRON_SECRET` in Vercel's project environment variables** (`openssl rand -hex 32`) and redeploy. Without it, `/internal/cron/*` requests are rejected (fails closed) and the renewal sweep / WhatsApp reminders won't run at all — see `apps/api/src/auth/guards/cron-secret.guard.ts`.
- **Check your Vercel plan's Cron Jobs limits.** `apps/api/vercel.json` schedules `whatsapp-reminders` hourly (`0 */1 * * *`); Vercel's Hobby plan restricts cron jobs to once per day, which would make the hourly entry either get rejected at deploy or silently coalesced — confirm on Pro, or drop the frequency to daily and accept coarser reminder timing if staying on Hobby. `subscription-renewal` is already daily, so it's fine either way.
- Confirm the on-demand trigger actually works post-deploy: `curl -H "Authorization: Bearer $CRON_SECRET" https://<api-domain>/internal/cron/subscription-renewal` should return `{"success":true}`.

## Deliberately not implemented (needs a decision first)

- **Real payment gateway (Razorpay/Stripe/etc.).** Still manual: hospital admin submits a UPI/bank reference, platform admin confirms by hand. Fine at low volume; revisit once there's enough hospital count that manual confirmation becomes a bottleneck or a fraud-risk concern. The schema (`SubscriptionInvoice.status`, `paymentReference`) and service boundary (`SubscriptionsService.confirmPayment`) are shaped so swapping in a gateway later touches one service, not the data model.
- **Seat-change proration.** Adding a 6th doctor mid-cycle doesn't generate a pro-rated charge — the extra seat is only billed at the next renewal. Current design choice for simplicity; revisit if hospitals start gaming it (add doctors right after renewal, remove them before the next one).
- **No UI to extend/grant a trial for an *existing* hospital** (one that's already `active`/`past_due`/`suspended`, or was lazily backfilled as `active`). Only brand-new hospitals get a trial today, via the "Add hospital" form. Add a platform-admin action if sales/support needs this (e.g. "extend trial by N days" on a hospital that's already live).

## Known gaps / lower priority

- **No e2e/HTTP-level tests**, only service- and guard-level unit tests (`subscriptions.service.spec.ts`, `hospital-context.guard.spec.ts`, `cron-secret.guard.spec.ts`). Nothing drives the actual Nest HTTP stack (supertest) to confirm the full request→guard→controller→service chain for the new endpoints. Worth adding if this area sees more churn.
- **Email delivery is still the `EmailService` placeholder** (logs in dev, calls Resend only if `RESEND_API_KEY` is set) — the new trial/invoice-due/suspended emails go through the same path as existing auth emails, so they'll silently just log until Resend (or another provider) is actually wired up in production.
- **`notifyAdmins` failures are swallowed** (logged, not thrown) by design, so a broken email provider never blocks the renewal sweep itself — but also means a silent notification failure has no alerting. Consider surfacing failed-send counts somewhere (platform-admin dashboard stat, or a log-based alert) if notifications turn out to matter operationally.
- **Two independent status-override toggles** (Exempt, Cancelled) in the Subscriptions page both ultimately just set the same `Subscription.status` field — toggling one after the other works (last write wins) but there's no UI indication of that overlap. A future redesign could replace both with a single "status override" control if this becomes confusing in practice.
- **`SubscriptionsService.notifyAdmins`** does one email send per approved admin per event, sequentially per hospital inside the renewal sweep loop — fine at today's scale; if the hospital count grows large, the daily sweep's wall-clock time (and email provider rate limits) are worth revisiting.

## Reference: what this round of work covered

- Fixed: the renewal sweep (invoicing, past_due, suspension) now has a working production trigger (`/internal/cron/*` + Vercel Cron Jobs), not just an `@Cron` decorator that never fired in the serverless deployment.
- Added: audit log entries for every subscription action (plan change, payment submit/confirm, exempt, feature toggle, cancel/reactivate) — visible in each hospital's own Audit trail screen.
- Added: email notifications for trial-ending-soon (once, 3 days before), invoice-due/grace-period-started, and suspended — sent to every approved hospital admin.
- Added: a cancellation/reactivation flow (`SubscriptionsService.setCancelled`), distinct from `suspended`, enforced the same way in `HospitalContextGuard`.
