import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { Doctor } from "@/types/doctorNew";
import {
  appointmentToQueueCandidate,
  buildLanes,
  capacityMessage,
  computePresence,
  DEFAULT_WALKIN_FAIRNESS_MINUTES,
  earliestConsultationStart,
  laneStatus,
  nextInQueue,
  orderQueue,
  projectFinish,
  type QueueCandidate,
  type QueueLane,
  type QueueOrderingRules,
  sessionCapacity,
  toISODate,
  todaysWindows,
} from "./queueBoard";

describe("toISODate", () => {
  it("uses the local calendar date, not UTC (vitest.config.ts pins TZ=Asia/Kolkata)", () => {
    expect(toISODate(new Date("2026-08-25T03:30:00"))).toBe("2026-08-25");
  });
});

const RULES: QueueOrderingRules = {
  walkinFairnessMinutes: DEFAULT_WALKIN_FAIRNESS_MINUTES,
};

function t(hhmm: string): Date {
  return new Date(`2026-08-25T${hhmm}:00`);
}

function tExact(hhmmss: string): Date {
  return new Date(`2026-08-25T${hhmmss}`);
}

function booked(
  id: string,
  scheduledStart: string,
  checkedInAt: string,
): QueueCandidate {
  return {
    id,
    bookingSource: "scheduled",
    checkedInAt: t(checkedInAt),
    scheduledStart: t(scheduledStart),
    urgentOverrideAt: null,
  };
}

function walkin(id: string, checkedInAt: string): QueueCandidate {
  return {
    id,
    bookingSource: "walk-in",
    checkedInAt: t(checkedInAt),
    scheduledStart: null,
    urgentOverrideAt: null,
  };
}

function ids(entries: { id: string }[]): string[] {
  return entries.map((e) => e.id);
}

describe("orderQueue", () => {
  it("a walk-in who arrived well before a booked patient's slot goes first", () => {
    const result = orderQueue(
      [booked("booked", "10:30", "10:25"), walkin("walkin", "09:50")],
      RULES,
      t("10:26"),
    );
    expect(ids(result)).toEqual(["walkin", "booked"]);
  });

  it("a booked patient ready at their slot time goes before a walk-in who checked in after it", () => {
    const result = orderQueue(
      [booked("booked", "10:30", "10:25"), walkin("walkin", "10:40")],
      RULES,
      t("10:41"),
    );
    expect(ids(result)).toEqual(["booked", "walkin"]);
  });

  it("a booked patient who arrives late loses their place to a walk-in who was already ready", () => {
    const result = orderQueue(
      [booked("booked", "10:30", "11:05"), walkin("walkin", "10:50")],
      RULES,
      t("11:06"),
    );
    expect(ids(result)).toEqual(["walkin", "booked"]);
  });

  it("arriving early gains a booked patient nothing — readyAt stays their scheduled start", () => {
    const result = orderQueue(
      [booked("booked", "10:30", "09:40")],
      RULES,
      t("09:41"),
    );
    expect(result).toHaveLength(1);
    expect(result[0].readyAt).toEqual(t("10:30"));
  });

  it("two booked patients on time sort by scheduled start", () => {
    const result = orderQueue(
      [booked("later", "10:15", "10:14"), booked("earlier", "10:00", "09:58")],
      RULES,
      t("10:16"),
    );
    expect(ids(result)).toEqual(["earlier", "later"]);
  });

  it("two walk-ins sort by check-in time", () => {
    const result = orderQueue(
      [walkin("later", "10:05"), walkin("earlier", "09:55")],
      RULES,
      t("10:06"),
    );
    expect(ids(result)).toEqual(["earlier", "later"]);
  });

  it("a walk-in waiting past the fairness threshold is promoted ahead of a booked patient who is ready now", () => {
    const result = orderQueue(
      [booked("booked", "10:00", "10:00"), walkin("walkin", "09:10")],
      RULES,
      t("10:00"),
    );
    expect(ids(result)).toEqual(["walkin", "booked"]);
    expect(result[0].reason).toBe("waited 50 min — next regardless");
  });

  it("a walk-in one minute under the fairness threshold is not promoted", () => {
    // 44 min wait, one short of the 45-min threshold — checked via `reason`
    // rather than order, since a walk-in's readyAt can legitimately sort
    // before a booked patient's without any fairness promotion involved.
    const result = orderQueue(
      [walkin("walkin", "09:16")],
      RULES,
      t("10:00"),
    );
    expect(result[0].reason).toBe("walked in 9:16 AM");
  });

  it("a walk-in exactly at the fairness threshold is promoted", () => {
    const result = orderQueue(
      [walkin("walkin", "09:15")],
      RULES,
      t("10:00"),
    );
    expect(result[0].reason).toBe("waited 45 min — next regardless");
  });

  it("a 44m31s wait is not promoted — rounding must not fire the threshold ~30s early", () => {
    const candidate: QueueCandidate = {
      id: "walkin",
      bookingSource: "walk-in",
      checkedInAt: tExact("09:15:29"),
      scheduledStart: null,
      urgentOverrideAt: null,
    };
    const result = orderQueue([candidate], RULES, tExact("10:00:00"));
    expect(result[0].reason).toBe("walked in 9:15 AM");
  });

  it("an urgent override beats a fairness-promoted walk-in", () => {
    const urgent: QueueCandidate = {
      id: "urgent",
      bookingSource: "scheduled",
      checkedInAt: t("09:58"),
      scheduledStart: t("10:00"),
      urgentOverrideAt: t("09:59"),
      urgentOverrideReason: "chest pain",
    };
    const result = orderQueue(
      [booked("booked", "10:00", "10:00"), walkin("walkin", "09:10"), urgent],
      RULES,
      t("10:00"),
    );
    expect(ids(result)).toEqual(["urgent", "walkin", "booked"]);
    expect(result[0].reason).toBe("urgent — chest pain");
  });

  it("ties on readyAt break on checkedInAt, then id", () => {
    const a: QueueCandidate = {
      id: "b-later-id",
      bookingSource: "walk-in",
      checkedInAt: t("10:00"),
      scheduledStart: null,
      urgentOverrideAt: null,
    };
    const b: QueueCandidate = {
      id: "a-earlier-id",
      bookingSource: "walk-in",
      checkedInAt: t("10:00"),
      scheduledStart: null,
      urgentOverrideAt: null,
    };
    const result = orderQueue([a, b], RULES, t("10:01"));
    expect(ids(result)).toEqual(["a-earlier-id", "b-later-id"]);
  });

  it("a readyAt tie between a booked patient and a walk-in breaks on checkedInAt, not id", () => {
    // id order alone would put "aaa-walkin" first; checkedInAt must decide
    // first, regardless of booking source.
    const result = orderQueue(
      [booked("zzz-booked", "10:00", "09:50"), walkin("aaa-walkin", "10:00")],
      RULES,
      t("10:01"),
    );
    expect(ids(result)).toEqual(["zzz-booked", "aaa-walkin"]);
  });

  it("a booked patient with a future readyAt loses to a walk-in already waiting", () => {
    const result = orderQueue(
      [booked("booked", "11:00", "10:00"), walkin("walkin", "10:05")],
      RULES,
      t("10:06"),
    );
    expect(ids(result)).toEqual(["walkin", "booked"]);
  });

  it("reasons describe booked vs walked-in patients", () => {
    const result = orderQueue(
      [booked("booked", "10:45", "10:40"), walkin("walkin", "10:52")],
      RULES,
      t("10:53"),
    );
    expect(result.find((e) => e.id === "booked")?.reason).toBe(
      "booked 10:45 AM · checked in 10:40 AM",
    );
    expect(result.find((e) => e.id === "walkin")?.reason).toBe(
      "walked in 10:52 AM",
    );
  });

  it("an online booking's reason shows both the booked slot and the check-in time", () => {
    // Scheduled for 10:20, arrived (checked in) at 10:25 — already ready by
    // 10:26, so no "early" suffix should appear.
    const result = orderQueue(
      [booked("booked", "10:20", "10:25")],
      RULES,
      t("10:26"),
    );
    expect(result[0].reason).toBe("booked 10:20 AM · checked in 10:25 AM");
  });
});

describe("nextInQueue", () => {
  it("returns null for an empty queue", () => {
    expect(nextInQueue([], RULES, t("10:00"))).toBeNull();
  });

  it("returns the same top entry orderQueue would produce", () => {
    const candidates = [
      booked("booked", "10:30", "10:25"),
      walkin("walkin", "09:50"),
    ];
    const now = t("10:26");
    expect(nextInQueue(candidates, RULES, now)).toEqual(
      orderQueue(candidates, RULES, now)[0],
    );
  });

  it("a booked patient who checked in early is still returned when nobody else is waiting", () => {
    const next = nextInQueue(
      [booked("booked", "11:00", "10:00")],
      RULES,
      t("10:06"),
    );
    expect(next?.id).toBe("booked");
    expect(next?.readyAt).toEqual(t("11:00"));
  });

  it("picks the earliest override when every candidate is urgent", () => {
    const a: QueueCandidate = {
      id: "a",
      bookingSource: "walk-in",
      checkedInAt: t("09:00"),
      scheduledStart: null,
      urgentOverrideAt: t("09:50"),
      urgentOverrideReason: "fall",
    };
    const b: QueueCandidate = {
      id: "b",
      bookingSource: "scheduled",
      checkedInAt: t("09:10"),
      scheduledStart: t("09:30"),
      urgentOverrideAt: t("09:20"),
      urgentOverrideReason: "fever",
    };
    const next = nextInQueue([a, b], RULES, t("10:00"));
    expect(next?.id).toBe("b");
    expect(next?.reason).toBe("urgent — fever");
  });
});

describe("laneStatus", () => {
  it("computes lateness only from scheduled bookings, not walk-ins", () => {
    const walkinAppt = makeAppt({
      id: "walkin",
      time: "09:00",
      bookingSource: "walk-in",
    });
    const lane: QueueLane = {
      doctor: makeDoctor(),
      inConsultation: [],
      waiting: [walkinAppt],
      waitingOrder: [],
      yetToArrive: [],
      overdue: [],
      done: [],
      all: [walkinAppt],
    };
    expect(laneStatus(lane, t("10:00"))).toEqual({
      label: "On time",
      tone: "ok",
    });
  });
});

function makeDoctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: "doc-1",
    profileId: "doc-1",
    hospitalId: "hosp-1",
    name: "Dr. Test",
    email: "doc@test.com",
    specialization: "General",
    qualification: "MBBS",
    consultationFee: 500,
    availability: [],
    bio: "",
    status: "active",
    membershipStatus: "approved",
    createdAt: "2026-01-01",
    isActive: true,
    canEdit: true,
    ...overrides,
  };
}

function makeAppt(
  overrides: Partial<AppointmentWithDetails> & { id: string },
): AppointmentWithDetails {
  return {
    hospitalId: "hosp-1",
    patientId: `patient-${overrides.id}`,
    doctorProfileId: "doc-1",
    date: "2026-08-25",
    time: "10:00",
    status: "waiting",
    createdAt: "2026-08-25T09:00:00",
    updatedAt: "2026-08-25T09:00:00",
    patientName: "Patient",
    doctorName: "Dr. Test",
    ...overrides,
  };
}

describe("buildLanes waiting order", () => {
  it("orders `waiting` exactly as orderQueue would for the same appointments", () => {
    const doctor = makeDoctor({ walkinFairnessMinutes: 45 });
    const bookedAppt = makeAppt({
      id: "booked",
      bookingSource: "scheduled",
      time: "10:30",
      checkedInAt: "2026-08-25T10:25:00",
      waitingAt: "2026-08-25T10:25:00",
    });
    const walkinAppt = makeAppt({
      id: "walkin",
      bookingSource: "walk-in",
      time: "09:50",
      checkedInAt: "2026-08-25T09:50:00",
      waitingAt: "2026-08-25T09:50:00",
    });
    const now = t("10:26");

    const lanes = buildLanes([doctor], [bookedAppt, walkinAppt], now);

    const rules: QueueOrderingRules = { walkinFairnessMinutes: 45 };
    const candidates = [bookedAppt, walkinAppt]
      .map(appointmentToQueueCandidate)
      .filter((c): c is QueueCandidate => c !== null);
    const expectedOrder = orderQueue(candidates, rules, now).map((e) => e.id);

    expect(expectedOrder).toEqual(["walkin", "booked"]);
    expect(lanes[0].waiting.map((a) => a.id)).toEqual(expectedOrder);
    expect(lanes[0].waitingOrder.map((e) => e.id)).toEqual(expectedOrder);
  });

  it("appends an appointment with no checkedInAt/waitingAt after the ranked list, instead of dropping it", () => {
    const doctor = makeDoctor();
    const rankedAppt = makeAppt({
      id: "ranked",
      bookingSource: "walk-in",
      checkedInAt: "2026-08-25T09:50:00",
      waitingAt: "2026-08-25T09:50:00",
    });
    const orphanAppt = makeAppt({ id: "orphan", bookingSource: "walk-in" });
    const now = t("10:00");

    const lanes = buildLanes([doctor], [rankedAppt, orphanAppt], now);

    expect(lanes[0].waiting.map((a) => a.id)).toEqual(["ranked", "orphan"]);
    expect(lanes[0].waitingOrder.map((e) => e.reason)).toEqual([
      expect.any(String),
      "missing check-in time",
    ]);
  });
});

describe("sessionCapacity", () => {
  // 2026-08-25 is a Tuesday. Morning session holds exactly 8 x 30-min slots
  // (09:00-13:00); evening is a separate 17:00-20:00 session.
  const doctor = makeDoctor({
    appointmentDuration: 30,
    bufferMinutes: 0,
    patientsPerSlot: 1,
    acceptWalkIns: true,
    heldSlotsPerSession: 2,
    availability: [
      { day: "Tuesday", startTime: "09:00", endTime: "13:00" },
      { day: "Tuesday", startTime: "17:00", endTime: "20:00" },
    ],
  });
  const morningAppts = Array.from({ length: 8 }, (_, i) => {
    const mins = 9 * 60 + i * 30;
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    return makeAppt({
      id: `morning-${i}`,
      time: `${hh}:${mm}`,
      status: "confirmed",
      bookingSource: "scheduled",
    });
  });
  const eveningWalkIn = makeAppt({
    id: "evening-walkin",
    time: "17:30",
    status: "confirmed",
    bookingSource: "walk-in",
  });
  const allAppts = [...morningAppts, eveningWalkIn];

  it("reports the morning session full while the evening session is untouched", () => {
    const now = t("10:00");
    const lane = buildLanes([doctor], allAppts, now)[0];
    const cap = sessionCapacity(lane, now);
    expect(cap.freeCount).toBe(0);
    const msg = capacityMessage(cap, null, todaysWindows(doctor, now));
    expect(msg).toEqual({
      tone: "ok",
      text: "Full for this session — next session 5:00 PM",
    });
  });

  it("an evening walk-in does not consume the morning session's held slots", () => {
    const now = t("10:00");
    const lane = buildLanes([doctor], allAppts, now)[0];
    const cap = sessionCapacity(lane, now);
    expect(cap.walkInCount).toBe(0);
    expect(cap.heldUsed).toBe(0);
    expect(cap.heldFree).toBe(2);
  });

  it("the same walk-in counts toward the evening session once it's current", () => {
    const now = t("18:00");
    const lane = buildLanes([doctor], allAppts, now)[0];
    const cap = sessionCapacity(lane, now);
    expect(cap.walkInCount).toBe(1);
    expect(cap.heldUsed).toBe(1);
  });
});

describe("buildLanes date filter", () => {
  it("only includes today's appointments in all/waiting/done/overdue", () => {
    const doctor = makeDoctor();
    const now = t("10:00");
    const todayWaiting = makeAppt({
      id: "today-waiting",
      status: "waiting",
      date: "2026-08-25",
      checkedInAt: "2026-08-25T09:50:00",
      waitingAt: "2026-08-25T09:50:00",
    });
    const yesterdayWaiting = makeAppt({
      id: "yesterday-waiting",
      status: "waiting",
      date: "2026-08-24",
      checkedInAt: "2026-08-24T09:50:00",
      waitingAt: "2026-08-24T09:50:00",
    });
    const todayDone = makeAppt({
      id: "today-done",
      status: "completed",
      date: "2026-08-25",
    });
    const yesterdayDone = makeAppt({
      id: "yesterday-done",
      status: "completed",
      date: "2026-08-24",
    });
    const todayOverdue = makeAppt({
      id: "today-overdue",
      status: "confirmed",
      date: "2026-08-25",
      time: "09:00",
    });
    const yesterdayOverdue = makeAppt({
      id: "yesterday-overdue",
      status: "confirmed",
      date: "2026-08-24",
      time: "09:00",
    });

    const lane = buildLanes(
      [doctor],
      [
        todayWaiting,
        yesterdayWaiting,
        todayDone,
        yesterdayDone,
        todayOverdue,
        yesterdayOverdue,
      ],
      now,
    )[0];

    expect(lane.all.map((a) => a.id).sort()).toEqual(
      ["today-waiting", "today-done", "today-overdue"].sort(),
    );
    expect(lane.waiting.map((a) => a.id)).toEqual(["today-waiting"]);
    expect(lane.done.map((a) => a.id)).toEqual(["today-done"]);
    expect(lane.overdue.map((a) => a.id)).toEqual(["today-overdue"]);
  });

  it("a waiting appointment dated yesterday is absent from today's lane and cannot rank first", () => {
    const doctor = makeDoctor();
    const now = t("10:00");
    const yesterdayWaiting = makeAppt({
      id: "yesterday-waiting",
      status: "waiting",
      date: "2026-08-24",
      time: "10:30",
      checkedInAt: "2026-08-24T10:25:00",
      waitingAt: "2026-08-24T10:25:00",
    });
    const todayWalkIn = makeAppt({
      id: "today-walkin",
      status: "waiting",
      bookingSource: "walk-in",
      date: "2026-08-25",
      checkedInAt: "2026-08-25T09:55:00",
      waitingAt: "2026-08-25T09:55:00",
    });

    const lane = buildLanes([doctor], [yesterdayWaiting, todayWalkIn], now)[0];

    expect(lane.waiting.map((a) => a.id)).toEqual(["today-walkin"]);
  });
});

describe("earliestConsultationStart / computePresence", () => {
  it("does not fall back to updatedAt when consultationStartedAt is missing", () => {
    const doctor = makeDoctor();
    const inConsultAppt = makeAppt({
      id: "in-consult",
      status: "in-consultation",
      // Clearly-wrong "arrival" time if it leaked through the old
      // stageStart(a, undefined) -> a.updatedAt fallback.
      updatedAt: "2026-08-25T06:00:00",
    });
    const lane: QueueLane = {
      doctor,
      inConsultation: [inConsultAppt],
      waiting: [],
      waitingOrder: [],
      yetToArrive: [],
      overdue: [],
      done: [],
      all: [inConsultAppt],
    };

    expect(earliestConsultationStart(lane)).toBeNull();

    const now = t("10:00");
    const presence = computePresence(lane, undefined, now);
    expect(presence.detail).toBe(`In since ${format(now, "h:mm a")}`);
  });
});

describe("projectFinish", () => {
  it("excludes a stale morning `waiting` patient from the evening session's remainingInWindow", () => {
    const doctor = makeDoctor({
      appointmentDuration: 30,
      bufferMinutes: 0,
      patientsPerSlot: 1,
      availability: [
        { day: "Tuesday", startTime: "09:00", endTime: "13:00" },
        { day: "Tuesday", startTime: "17:00", endTime: "20:00" },
      ],
    });
    const staleMorningWaiting = makeAppt({
      id: "stale-morning",
      time: "09:30",
      status: "waiting",
    });
    const eveningYetToArrive = makeAppt({
      id: "evening-upcoming",
      time: "17:30",
      status: "confirmed",
    });
    const now = t("18:00");
    const lane: QueueLane = {
      doctor,
      inConsultation: [],
      waiting: [staleMorningWaiting],
      waitingOrder: [],
      yetToArrive: [eveningYetToArrive],
      overdue: [],
      done: [],
      all: [staleMorningWaiting, eveningYetToArrive],
    };

    const proj = projectFinish(lane, now);

    expect(proj?.remainingInWindow).toBe(1);
  });
});

describe("overdue boundary", () => {
  it("is overdue at exactly 20 minutes elapsed", () => {
    const doctor = makeDoctor();
    const appt = makeAppt({ id: "appt", status: "confirmed", time: "09:00" });
    const now = tExact("09:20:00");
    const lane = buildLanes([doctor], [appt], now)[0];
    expect(lane.overdue.map((a) => a.id)).toEqual(["appt"]);
  });

  it("is not overdue at 19 minutes 59 seconds elapsed", () => {
    const doctor = makeDoctor();
    const appt = makeAppt({ id: "appt", status: "confirmed", time: "09:00" });
    const now = tExact("09:19:59");
    const lane = buildLanes([doctor], [appt], now)[0];
    expect(lane.overdue).toEqual([]);
  });
});

describe("orderQueue reason — not-yet-ready booked patient", () => {
  it("names the earliness when alone in the queue", () => {
    const next = nextInQueue(
      [booked("booked", "11:00", "10:00")],
      RULES,
      t("10:06"),
    );
    expect(next?.reason).toBe(
      "booked 11:00 AM · checked in 10:00 AM — 54 min early",
    );
  });
});
