// Modules a hospital admin can switch on/off under Settings > Features. Keys
// and dependencies mirror HOSPITAL_MODULE / HOSPITAL_MODULE_DEPENDENCIES in
// apps/api/src/constants.ts — keep in sync. The API is the source of truth
// for what's enabled (GET /hospitals/:id/modules) and enforces it; this file
// only adds the copy and the route mapping the web app needs.
export type HospitalModuleKey =
  | "appointments"
  | "queue"
  | "packages"
  | "prescriptions"
  | "payments"
  | "sms"
  | "whatsappNotify"
  | "whatsapp"
  | "reports"
  | "audit"
  | "leaveRequests"
  | "hospitalHolidays"
  | "chargeCatalog"
  | "medicines"
  | "medicinePacks"
  | "patientFields";

export type HospitalModuleDisabledReason = "plan" | "switched_off" | "requires";

export interface ResolvedHospitalModule {
  key: HospitalModuleKey;
  switchedOn: boolean;
  enabled: boolean;
  disabledReason?: HospitalModuleDisabledReason;
  blockedBy?: HospitalModuleKey;
}

export interface HospitalModuleInfo {
  key: HospitalModuleKey;
  label: string;
  description: string;
  // What happens when it's off — shown on the Features screen so an admin
  // isn't surprised.
  offNote: string;
  group: HospitalModuleGroup;
  requires?: HospitalModuleKey[];
}

export type HospitalModuleGroup = "care" | "frontDesk" | "admin" | "setup";

export const HOSPITAL_MODULE_GROUPS: {
  key: HospitalModuleGroup;
  label: string;
}[] = [
  { key: "care", label: "Care" },
  { key: "frontDesk", label: "Front desk & patients" },
  { key: "admin", label: "Oversight" },
  { key: "setup", label: "Catalogs & setup" },
];

export const HOSPITAL_MODULES: HospitalModuleInfo[] = [
  {
    key: "appointments",
    label: "Appointments",
    description:
      "Book, reschedule and complete visits, with the calendar view.",
    offNote:
      "Hides appointments everywhere, along with everything built on them.",
    group: "care",
  },
  {
    key: "queue",
    label: "Today's queue",
    description:
      "The live check-in queue for the front desk and each doctor's Today screen.",
    offNote: "Appointments still work; there's just no live queue view.",
    group: "care",
    requires: ["appointments"],
  },
  {
    key: "packages",
    label: "Package appointments",
    description:
      "Sell multi-visit packages that book a whole course of appointments at once.",
    offNote: "Existing packages stay on record but can't be sold or managed.",
    group: "care",
    requires: ["appointments"],
  },
  {
    key: "prescriptions",
    label: "Prescriptions",
    description:
      "Doctors write, sign and print prescriptions from the medicine catalog.",
    offNote: "Saved prescriptions are kept but can't be opened or written.",
    group: "care",
    requires: ["appointments", "medicines"],
  },
  {
    key: "leaveRequests",
    label: "Doctor leave requests",
    description:
      "Doctors apply for leave and admins approve it, with impact on booked visits.",
    offNote: "Doctors can't apply for leave from the app.",
    group: "care",
  },
  {
    key: "payments",
    label: "Payments",
    description: "Collect, refund and day-close payments at the front desk.",
    offNote: "No payment screens or collection when completing a visit.",
    group: "frontDesk",
  },
  {
    key: "sms",
    label: "SMS to patients",
    description:
      "Offer to text patients when an appointment is moved, cancelled or missed.",
    offNote: 'The "Tell the patient by SMS" options are hidden.',
    group: "frontDesk",
  },
  {
    key: "whatsappNotify",
    label: "WhatsApp to patients",
    description:
      "Offer to message patients on WhatsApp when an appointment is moved, cancelled or missed.",
    offNote: 'The "Tell the patient by WhatsApp" options are hidden.',
    group: "frontDesk",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    description:
      "Patients book and ask questions on WhatsApp; enquiries land in the inbox.",
    offNote:
      "Incoming WhatsApp messages and reminders stop until it's turned back on.",
    group: "frontDesk",
    requires: ["appointments"],
  },
  {
    key: "patientFields",
    label: "Custom patient fields",
    description:
      "Rename, hide and add your own fields to the patient form's Notes section.",
    offNote:
      "The patient form uses the standard fields; your setup is kept for later.",
    group: "frontDesk",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Daily collection, doctor revenue, dues ageing and no-shows.",
    offNote: "Reports and their CSV exports are hidden.",
    group: "admin",
  },
  {
    key: "audit",
    label: "Audit trail",
    description: "A log of who changed what, with CSV export.",
    offNote: "Changes are still recorded; only the screen is hidden.",
    group: "admin",
  },
  {
    key: "medicines",
    label: "Medicines",
    description:
      "The catalog doctors prescribe from, including allergy class tags.",
    offNote:
      "Prescriptions and medicine packs need this, so they turn off too.",
    group: "setup",
  },
  {
    key: "medicinePacks",
    label: "Medicine packs",
    description:
      "One-click treatment templates for the prescription writer — Fever pack, URI pack.",
    offNote: "Doctors add medicines one at a time.",
    group: "setup",
    requires: ["medicines"],
  },
  {
    key: "chargeCatalog",
    label: "Charge catalog",
    description: "Preset items and prices the front desk can add to a bill.",
    offNote: "Bills are entered by hand, without quick-add items.",
    group: "setup",
    requires: ["payments"],
  },
  {
    key: "hospitalHolidays",
    label: "Hospital holidays",
    description: "Hospital-wide closures that block every doctor's slots.",
    offNote:
      "Saved holidays stop closing slots; they come back if you turn this on again.",
    group: "setup",
  },
];

export const HOSPITAL_MODULE_BY_KEY = Object.fromEntries(
  HOSPITAL_MODULES.map((m) => [m.key, m]),
) as Record<HospitalModuleKey, HospitalModuleInfo>;

// Which module a page under /hospital/[id] belongs to, most specific first.
// Pages not listed here (dashboard, doctors, patients, team…) are always on.
const ROUTE_MODULES: { pattern: RegExp; module: HospitalModuleKey }[] = [
  {
    pattern: /^\/appointments\/[^/]+\/prescription(\/|$)/,
    module: "prescriptions",
  },
  { pattern: /^\/appointments(\/|$)/, module: "appointments" },
  { pattern: /^\/queue(\/|$)/, module: "queue" },
  { pattern: /^\/today(\/|$)/, module: "queue" },
  { pattern: /^\/payments(\/|$)/, module: "payments" },
  { pattern: /^\/enquiries(\/|$)/, module: "whatsapp" },
  { pattern: /^\/reports(\/|$)/, module: "reports" },
  { pattern: /^\/settings\/audit(\/|$)/, module: "audit" },
  { pattern: /^\/settings\/whatsapp(\/|$)/, module: "whatsapp" },
  {
    pattern: /^\/settings\/hospital-holidays(\/|$)/,
    module: "hospitalHolidays",
  },
  { pattern: /^\/settings\/charge-catalog(\/|$)/, module: "chargeCatalog" },
  { pattern: /^\/settings\/medicines(\/|$)/, module: "medicines" },
  { pattern: /^\/settings\/medicine-packs(\/|$)/, module: "medicinePacks" },
  { pattern: /^\/settings\/patient-fields(\/|$)/, module: "patientFields" },
];

// `subPath` is the part after /hospital/[id], e.g. "/appointments/add".
export function moduleForHospitalPath(
  subPath: string,
): HospitalModuleKey | undefined {
  return ROUTE_MODULES.find((r) => r.pattern.test(subPath))?.module;
}

// Re-resolves the server's list against unsaved switch changes, so the
// Features screen can preview cascades (turning off Appointments greys out
// the queue) before saving. Same precedence as the API's
// resolveHospitalModules: plan, then the switch, then dependencies.
export function resolveDraftModules(
  server: ResolvedHospitalModule[],
  switches: Partial<Record<HospitalModuleKey, boolean>>,
): Record<HospitalModuleKey, ResolvedHospitalModule> {
  const byKey = new Map(server.map((m) => [m.key, m]));
  const resolved = {} as Record<HospitalModuleKey, ResolvedHospitalModule>;

  const resolve = (key: HospitalModuleKey): ResolvedHospitalModule => {
    if (resolved[key]) return resolved[key];
    const switchedOn = switches[key] ?? byKey.get(key)?.switchedOn ?? true;
    let result: ResolvedHospitalModule;

    if (byKey.get(key)?.disabledReason === "plan") {
      result = { key, switchedOn, enabled: false, disabledReason: "plan" };
    } else if (!switchedOn) {
      result = {
        key,
        switchedOn,
        enabled: false,
        disabledReason: "switched_off",
      };
    } else {
      const blockedBy = (HOSPITAL_MODULE_BY_KEY[key].requires ?? []).find(
        (dep) => !resolve(dep).enabled,
      );
      result = blockedBy
        ? {
            key,
            switchedOn,
            enabled: false,
            disabledReason: "requires",
            blockedBy,
          }
        : { key, switchedOn, enabled: true };
    }

    resolved[key] = result;
    return result;
  };

  for (const m of HOSPITAL_MODULES) resolve(m.key);
  return resolved;
}

export function describeDisabledModule(module: ResolvedHospitalModule): string {
  switch (module.disabledReason) {
    case "plan":
      return "Not included in your plan — contact us to add it.";
    case "requires":
      return module.blockedBy
        ? `Needs ${HOSPITAL_MODULE_BY_KEY[module.blockedBy].label}, which is off.`
        : "Needs another feature that's off.";
    case "switched_off":
      return "Turned off for this hospital.";
    default:
      return "";
  }
}
