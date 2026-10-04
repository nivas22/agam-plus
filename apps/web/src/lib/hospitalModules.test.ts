import { describe, expect, it } from "vitest";
import {
  HOSPITAL_MODULES,
  moduleForHospitalPath,
  type ResolvedHospitalModule,
  resolveDraftModules,
} from "./hospitalModules";

const allOn: ResolvedHospitalModule[] = HOSPITAL_MODULES.map((m) => ({
  key: m.key,
  switchedOn: true,
  enabled: true,
}));

describe("moduleForHospitalPath", () => {
  it("maps the prescription writer before the broader appointments route", () => {
    expect(moduleForHospitalPath("/appointments/a1/prescription")).toBe(
      "prescriptions",
    );
    expect(moduleForHospitalPath("/appointments/a1")).toBe("appointments");
    expect(moduleForHospitalPath("/appointments")).toBe("appointments");
  });

  it("maps settings pages and leaves always-on pages alone", () => {
    expect(moduleForHospitalPath("/settings/medicine-packs")).toBe(
      "medicinePacks",
    );
    expect(moduleForHospitalPath("/settings/medicines")).toBe("medicines");
    expect(moduleForHospitalPath("/enquiries")).toBe("whatsapp");
    expect(moduleForHospitalPath("/today")).toBe("queue");
    expect(moduleForHospitalPath("/settings")).toBeUndefined();
    expect(moduleForHospitalPath("/settings/features")).toBeUndefined();
    expect(moduleForHospitalPath("/patients")).toBeUndefined();
  });
});

describe("resolveDraftModules", () => {
  it("cascades an unsaved switch-off to dependents", () => {
    const resolved = resolveDraftModules(allOn, { appointments: false });
    expect(resolved.queue).toMatchObject({
      enabled: false,
      disabledReason: "requires",
      blockedBy: "appointments",
    });
    expect(resolved.payments.enabled).toBe(true);
  });

  it("keeps plan-locked modules off whatever the switch says", () => {
    const server = allOn.map((m) =>
      m.key === "reports"
        ? { ...m, enabled: false, disabledReason: "plan" as const }
        : m,
    );
    expect(
      resolveDraftModules(server, { reports: true }).reports,
    ).toMatchObject({
      enabled: false,
      disabledReason: "plan",
    });
  });
});
