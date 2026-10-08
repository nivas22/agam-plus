# Today's queue: how patients flow

This page explains how a patient moves through Today's queue, both online bookings and walk-ins. It covers how token numbers are given, how the next patient is chosen, and what the two walk-in options mean. It ends with a worked example.

Both queue screens follow these rules:

- **Today's queue**, the classic layout (`TodaysQueuePage`)
- **Today's queue (new)** (`TodaysQueueV2Page`), switched on under Settings → Features → New queue layout

Both screens read the same state from `useTodaysQueue`, and the rules live in `queueBoard.ts`.

---

## 1. Patient journey: online booking vs walk-in

```
 ONLINE / DESK BOOKING                          WALK-IN (Add walk-in)
 ─────────────────────                          ─────────────────────
 Booked for a slot (e.g. 7:15 PM)                    │
 status: confirmed                         ┌─────────┴──────────────┐
 token:  B<n>                              │                        │
        │                         "Straight into queue"     "Next free slot"
        │                          created + checked in      booked for a slot
        │                          right now                 status: confirmed
        │                                  │                 token:  W<n>
        │                                  │                        │
        ▼                                  │                        ▼
 ┌───────────────┐   not here 20+ min      │               ┌───────────────┐
 │ Yet to arrive │ ─────────────────┐      │               │ Yet to arrive │
 └───────┬───────┘                  │      │               └───────┬───────┘
         │ desk presses "Check in"  │      │                       │ "Check in"
         ▼                          ▼      ▼                       ▼
         │                ┌──────────────────┐                     │
         │                │ NEEDS A DECISION │                     │
         │                │ Call / No-show / │                     │
         │                │ Move to doctor   │                     │
         │                └──────────────────┘                     │
         ▼                                                         ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  WAITING          token = arrival number today (1, 2, 3 …)          │
 │  ordered by the turn-order rule (section 3)                         │
 └───────────────────────────────┬──────────────────────────────────────┘
                                 │ "Send in" / "Call next"  (desk decides)
                                 ▼
                       ┌───────────────────┐
                       │ IN CONSULTATION   │  timer runs
                       └─────────┬─────────┘
                                 │ "Finish session" / "Done → payment"
                                 ▼
                       ┌───────────────────┐
                       │ AWAITING PAYMENT  │
                       └─────────┬─────────┘
                                 │ "Collect payment"
                                 ▼
                       ┌───────────────────┐
                       │ COMPLETED (Done)  │
                       └───────────────────┘
```

Nothing moves on its own. Every arrow is a button the front desk (or the doctor) presses.

**Overdue patients are only flagged.** A booked patient who is 20 or more minutes past their slot without checking in (`OVERDUE_GRACE_MINUTES`) moves to **Needs a decision**. Someone still has to choose whether to call them, mark them a no-show, or move them to another doctor.

**With Payments switched off**, finishing a session closes the visit directly. There is no "Awaiting payment" step.

---

## 2. Adding a walk-in: the two options

The **Add walk-in** dialog (`AddWalkInModal`) offers two ways to fit a walk-in into a doctor's day.

### Straight into the queue (no slot)

Use this for a patient who is at the desk now and will wait.

- It creates a walk-in appointment at the current time. It skips the slot check (`forceSlot`), so it works even when no slot is free.
- The patient is checked in immediately and joins the waiting list. The button reads **Add & check in**.
- On the new layout they get a plain token number and appear under **Next up**, with **Send in**.
- This option is only available while the doctor is in session. It is blocked if the doctor is fully booked and the hospital doesn't allow extra walk-ins.

### Next free slot ("keeps schedule")

Use this for a patient who would rather come back later than wait now.

- It books the doctor's next open slot, like a normal booking but marked as a walk-in.
- The patient is **not** checked in. The button reads **Book slot**, and they are expected back at that time.
- "Keeps schedule" means the patient takes a real slot instead of being squeezed in on top. So the doctor's finish time and the capacity numbers stay accurate.
- On the new layout they appear under **Later**, with a `W<n>` token and a **Check in** button. Once checked in, they get a plain token number and join the waiting list.

| Situation | Choose |
|---|---|
| Patient will sit and wait now | Straight into the queue |
| The wait is long and the patient wants to come back at a fixed time | Next free slot |
| Doctor is fully booked but the patient must be seen today | Straight into the queue (if the hospital allows it) |

In the dialog the two options are worded from the patient's side: **Wait now — seen around <time>** and **Come back at <slot time>**. The direct option shows the estimated time to be seen (people ahead × consult length + buffer), so the desk can compare it with the slot time.

The "ahead" count comes from `walkInAhead`. It includes booked patients whose 10-minute window opens before the walk-in would be seen, and says how many of those are booked ("2 ahead (incl. 1 booked)").

One option is pre-selected and tagged **Recommended**:

- **Wait now** by default.
- **Come back** only when the wait is 30 minutes or more *and* the slot would get the patient seen sooner than waiting.

Once the desk picks an option, it stays picked. Changing the doctor clears that choice.

---

## 3. Who is next? (turn-order rule)

One function, `orderQueue` in `queueBoard.ts`, decides the order of the waiting list. The queue board, the **Call next** button and the patient's wait estimate all use it, so they always agree.

```
 For each patient in WAITING:
                ┌──────────────────────────┐
                │ Marked URGENT by desk?   │── yes ──▶ 1st group (earliest marked first)
                └────────────┬─────────────┘
                             no
                ┌────────────▼─────────────────────────┐
                │ Walk-in waiting ≥ 45 min?            │── yes ──▶ 2nd group (longest wait first)
                │ (doctor's "fairness" limit)          │
                └────────────┬─────────────────────────┘
                             no
                ┌────────────▼─────────────────────────┐
                │ Booked, checked in by slot time,     │── yes ──▶ 3rd group (earliest SLOT first)
                │ and now ≥ slot − 10 min?             │
                │ ("booked priority")                  │
                └────────────┬─────────────────────────┘
                             no
                ┌────────────▼─────────────────────────┐
                │ Everyone else, by READY TIME:        │──────▶ 4th group (earliest ready first)
                │  • Walk-in      → time checked in    │
                │  • Late booked  → time checked in    │
                │  • Booked, more than 10 min early    │
                │                 → slot − 10 min      │
                └──────────────────────────────────────┘
```

**Booked priority** is the key idea:

- **A booked patient goes ahead of walk-ins from 10 minutes before their slot** (`BOOKED_PRIORITY_WINDOW_MINUTES`). Someone booked for 9:30 who checks in at 9:20 or later goes ahead of every ordinary walk-in, even walk-ins who arrived before them.
- **Arriving more than 10 minutes early is allowed but gains nothing extra.** Someone booked for 9:30 who checks in at 9:18 gets their token straight away. Their card says *"priority from 9:20 AM"*, and they move up at 9:20.
- **Arriving late loses booked priority.** Someone booked for 7:15 who arrives at 7:25 queues like a walk-in who arrived at 7:25. Their card says *"10 min late"*.
- **A walk-in is ready the moment they check in.**
- **Booked patients keep slot order among themselves**, whatever order they arrived in.
- **The fairness limit is per doctor** (`walkinFairnessMinutes`, default 45 minutes). It is a safety net, so a walk-in can't be pushed back indefinitely.

The order only suggests who is next. The desk still presses **Send in** for the patient they actually send in.

---

## 4. Token numbers

Tokens are shown on the new layout. They are not stored anywhere. `queueTokens` works them out from today's appointments, separately for each doctor.

| Patient state | Token | How it's numbered |
|---|---|---|
| Arrived (checked in), online booking or walk-in | `1`, `2`, `3` … | Order they checked in today. A later arrival never renumbers an earlier one. |
| Online or desk booking, not arrived yet | `B1`, `B2` … | Their place among the doctor's booked slots today, by time |
| Walk-in booked into a slot, not checked in yet | `W1`, `W2` … | Their place among the doctor's walk-ins today, by time |

When a `B` or `W` patient checks in, they switch to the next plain number. Cancelled, no-show and rescheduled bookings that never arrived get no token, so they leave no gaps.

A token is an identifier, not a place in line. Booked priority can put token 3 ahead of token 2, and the token numbers stay the same when that happens.

The Add walk-in dialog shows the same number (`nextArrivalToken`) the board will give the walk-in once checked in. It is still derived, not stored: if two desks add walk-ins for the same doctor at the same moment, both see the same number until the board refreshes. A token counter stored on the backend would close that gap.

---

## 5. Worked example: Dr. Rao, session 6:30–10:30 PM

### The patients

| Patient | Type | Slot | Arrived | Ready time | Token |
|---|---|---|---|---|---|
| Asha | Online booking | 7:00 | 6:50 (early) | **6:50** (priority) | 1 |
| Ravi | Walk-in (straight into queue) | — | 6:55 | **6:55** | 2 |
| Meena | Walk-in (straight into queue) | — | 7:05 | **7:05** | 3 |
| Karthik | Online booking | 7:15 | 7:25 (late) | **7:25** | 4 |
| Priya | Online booking | 7:30 | not yet | — | B3 |
| Suresh | Walk-in (next free slot) | 9:45 | not yet | — | W3 |

### How the evening plays out

```
 6:50  Asha checks in   → token 1   Waiting: [Asha(7:00)]
 6:55  Ravi walks in    → token 2   Waiting: [Asha(7:00), Ravi(6:55)]   ← Asha stays ahead:
                                                                         booked, within 10 min of her slot
 7:00  Desk: Call next  → Asha IN ROOM
 7:05  Meena walks in   → token 3   Waiting: [Ravi(6:55), Meena(7:05)]
 7:12  Asha done        → Done → payment;  Call next → Ravi IN ROOM
 7:25  Karthik arrives  → token 4   Waiting: [Meena(7:05), Karthik(7:25)]  ← late, so no booked
                                                                           priority; behind Meena
 7:27  Ravi done        → Meena IN ROOM
 7:40  Meena done       → Karthik IN ROOM
 7:50  Priya (7:30) still not here, 20 min late
                        → moves to NEEDS A DECISION: Call / Mark no-show / Move to another doctor
 9:40  Suresh arrives for his 9:45 walk-in slot → desk presses Check in → gets next token, joins Waiting
```

### Where the fairness rule matters

Suppose the desk had marked two patients urgent, and booked patients kept arriving inside their 10-minute windows. Meena (walk-in, checked in 7:05) could keep slipping back. Once she has waited 45 minutes, at 7:50, she moves into the second group and becomes next regardless. Her card shows *"waited 45 min — next regardless"*.

---

## 6. Buttons on the new layout

| Button | Where | What it does |
|---|---|---|
| **Send in** | Next up, Still waiting | Moves that patient into consultation |
| **Check in** | Next up (not arrived), Later | Marks a booked patient as arrived; they join the waiting list |
| **Call next** | Now card | Finishes the current visit (payment left for the desk) and sends in the top waiting patient |
| **Done → payment** | Now card | Finishes the current visit and opens Collect payment. Reads **Finish session** when Payments is off |
| **Call / Mark no-show / Move to another doctor** | "Late · not arrived": in the doctor's card (All doctors), at the top of Later (doctor view). Move to another doctor is in the doctor view only | Deals with a patient 20+ min late |
| **Collect payment** | Later → Show (awaiting payment) | Opens the payment dialog |

## Where the code lives

| What | File |
|---|---|
| Turn order, tokens, lateness, capacity | `queueBoard.ts` (`orderQueue`, `queueTokens`, `laneStatus`, `sessionCapacity`) |
| Shared state, actions and dialogs | `useTodaysQueue.tsx` |
| Classic layout | `TodaysQueuePage.tsx` |
| New layout | `TodaysQueueV2Page.tsx` |
| Add walk-in dialog | `AddWalkInModal.tsx` |
| Tests | `queueBoard.test.ts` |
