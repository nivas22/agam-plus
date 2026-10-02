# WhatsApp patient bot — flow & options

What a patient can currently do when they message the hospital's WhatsApp number, and where each option is implemented. Source of truth is [whatsapp-conversation.service.ts](./whatsapp-conversation.service.ts) — update this file whenever that one changes.

## Main menu

Sent whenever there's no active session (first message, after a session expires, or after typing a [restart keyword](#restart--cancel-keywords)).

> Hello! How can we help you today?
> **[ Book appointment ]** **[ My appointments ]** **[ General enquiry ]**

| Option | Leads to |
|---|---|
| Book appointment | [Book appointment](#1-book-appointment) |
| My appointments | [My appointments](#2-my-appointments) |
| General enquiry | [General enquiry](#3-general-enquiry) |

Meta caps interactive button messages at 3 — this menu is at that limit.

## 1. Book appointment

1. **Choose doctor** — lists doctors who are hospital-approved *and* `isAcceptingBookings` (name + specialization, up to 10).
   - If none qualify: instead of a dead end, the patient is dropped into [enquiry capture](#3-general-enquiry) with copy asking for their name/need, and the resulting enquiry is tagged `[Booking request]` in the admin Enquiries list so staff know it's a blocked booking, not a general question.
2. **Choose day** — next 7 days.
3. **Choose time** — open slots for that doctor/day.
   - No slots that day → re-shows the day list plus a **Choose another doctor** row (jumps back to step 1).
4. **Confirm** — `Yes, book it` / `Cancel`.
   - Confirmed → creates the appointment as `PENDING` (`bookedVia: 'whatsapp'`) for staff to confirm.
   - Slot taken in the meantime (race condition) → apologizes and re-runs step 1.
   - Declined → session ends with a reminder they can type `menu` to start over.

## 2. My appointments

1. Looks up the patient **by phone only** — never creates a new patient record just because someone tapped this.
   - No matching patient → "We couldn't find any appointments for this number." → main menu.
2. Lists their upcoming active appointments (status pending/confirmed/checked-in/waiting/in-consultation, sorted by date), doctor + date as the row title, time as the description.
   - None found → "You have no upcoming appointments." → main menu.
3. Tap one → **Reschedule** / **Cancel it** / **Back to menu**.
   - **Cancel it** → asks `Are you sure you want to cancel this appointment?` (`Yes, cancel it` / `No, keep it`) before anything happens. Only on `Yes` does status get set to `cancelled` (`cancelReason: 'Cancelled by patient via WhatsApp'`).
   - **Reschedule** → same day/time picker as booking (step 2–3 above), but doctor is fixed to the existing one (no "choose another doctor" escape here). On confirm, the appointment's date/time are updated and status resets to `PENDING` for staff to re-confirm — it does **not** create a second appointment.
   - Slot taken mid-reschedule → apologizes and re-prompts the day list for the same appointment.

Every cancel/reschedule call re-verifies the appointment belongs to both the resolved hospital **and** the resolved patient before touching it. The availability re-check and the write happen inside one Mongo transaction (falls back to non-transactional if the deployment doesn't support transactions — e.g. a standalone dev Mongo) so two patients can't both win the same last-open slot.

## 3. General enquiry

Free-text capture: the patient's next message is saved to the hospital's Enquiries list (staff-visible, resolvable from the admin panel) and they get a "we'll reply soon" confirmation. Also the landing spot when booking is blocked (see above), tagged accordingly. If the phone number already matches an existing patient record (read-only lookup — a question never creates one), the enquiry is linked to that `patientId` so staff have full context, not just a phone number.

## Restart / cancel keywords

Recognized at **any** step, regardless of what the bot is currently waiting for, so a patient is never stuck until the 30-minute session TTL expires:

| Typed (exact, case-insensitive) | Effect |
|---|---|
| `menu`, `hi`, `hello`, `hey`, `start`, `restart`, `main menu` | Clears the session, re-sends the main menu |
| `cancel`, `stop`, `quit` | Clears the session, ends the chat politely with a "type menu to start again" note |

A **Back to menu** button (same effect as typing `menu`) also appears wherever a patient might reasonably want to bail without cancelling or typing anything — e.g. the appointment action screen.

## Reliability

- **Webhook idempotency** — Meta's webhook delivery is at-least-once, so `WhatsappWebhookController` claims each inbound `message.id` via `WhatsappProcessedMessageRepository` (unique index, 7-day TTL) before processing it. A redelivered message is skipped rather than replayed against the bot's state machine.
- **Booking/reschedule race safety** — the slot-availability re-check and the appointment insert/update run inside one Mongo transaction (`AppointmentRepository.runInTransaction`), so two patients can't both pass the check and write for the same last-open slot. Falls back to non-transactional execution if the deployment isn't a replica set/mongos (e.g. local dev Mongo) — same behavior as before this existed.
- **Audit trail** — booking, cancelling, and rescheduling via WhatsApp each write an `AuditService` entry (`appointment.booked` / `appointment.cancelled` / `appointment.rescheduled`), same log staff actions go through, actor recorded as the patient.

## Automated reminders

Not part of the interactive flow — a background cron (`WhatsappReminderService`, every 15 minutes) sends a one-time reminder ~24h before each active appointment, to any hospital with WhatsApp connected, then stamps `reminderSentAt` so it's never sent twice. No second (e.g. 2h-before) reminder tier yet.

## Not currently supported

- No appointment history / past visits view
- No multi-language support (all copy is hardcoded English)
- No admin dashboard warning when a hospital has zero bookable doctors (only discoverable via the Enquiries list today)
- No proactive "appointment confirmed by staff" push — the patient finds out by messaging in
- No per-hospital timezone handling — dates/times are computed in the server's local timezone everywhere in this app (not just WhatsApp), same as `appointments.service.ts`, `payments.service.ts`, `packages.service.ts`, etc. Fixing this properly needs a hospital-level IANA timezone field and touches all of those, not just the bot — out of scope here.
- Transaction-backed race protection only covers the WhatsApp self-booking/reschedule path. Staff/admin booking (`AppointmentsService.createAppointment`) has the same check-then-insert race and doesn't use a transaction yet.
