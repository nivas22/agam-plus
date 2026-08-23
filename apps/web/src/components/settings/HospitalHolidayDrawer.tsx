// components/settings/HospitalHolidayDrawer.tsx
"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Field,
  inputClass,
  ToggleSwitch,
} from "@/components/common/EditFormControls";
import {
  useCreateHospitalHoliday,
  usePreviewHolidayImpact,
  useSetHolidayStatus,
  useUpdateHospitalHoliday,
} from "@/hooks/useHospitalHolidaysApi";
import { useActiveDoctors } from "@/hooks/useNewDoctorApi";
import {
  HOLIDAY_CLOSURE_TYPE_OPTIONS,
  type HolidayClosureType,
  type HolidayResolution,
  type HospitalHoliday,
} from "@/types/hospitalHoliday";
import HolidayImpactModal from "./HolidayImpactModal";

interface HospitalHolidayDrawerProps {
  hospitalId: string;
  holiday?: HospitalHoliday;
  onClose: () => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(startsOn: string, endsOn: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const start = new Date(`${startsOn}T00:00:00`).toLocaleDateString(
    "en-IN",
    opts,
  );
  if (endsOn === startsOn) return start;
  const end = new Date(`${endsOn}T00:00:00`).toLocaleDateString("en-IN", opts);
  return `${start} – ${end}`;
}

export default function HospitalHolidayDrawer({
  hospitalId,
  holiday,
  onClose,
}: HospitalHolidayDrawerProps) {
  const isEdit = !!holiday;

  const [name, setName] = useState(holiday?.name || "");
  const [startsOn, setStartsOn] = useState(holiday?.startsOn || todayIso());
  const [endsOn, setEndsOn] = useState(holiday?.endsOn || "");
  const [closureType, setClosureType] = useState<HolidayClosureType>(
    holiday?.closureType || "full",
  );
  const [halfDayUntil, setHalfDayUntil] = useState(
    holiday?.halfDayUntil || "13:00",
  );
  const [repeatsAnnually, setRepeatsAnnually] = useState(
    holiday?.repeatsAnnually || false,
  );
  const [exceptionDoctorIds, setExceptionDoctorIds] = useState<string[]>(
    holiday?.exceptionDoctorIds || [],
  );
  const [error, setError] = useState<string | null>(null);
  const [showImpactModal, setShowImpactModal] = useState(false);

  const { data: doctorsData } = useActiveDoctors(hospitalId);
  const doctors = doctorsData?.doctors || [];

  const createHoliday = useCreateHospitalHoliday(hospitalId);
  const updateHoliday = useUpdateHospitalHoliday(hospitalId);
  const setStatus = useSetHolidayStatus(hospitalId);
  const previewImpact = usePreviewHolidayImpact(hospitalId);

  const resolvedEndsOn = endsOn || startsOn;

  // Live impact preview — re-checked whenever the draft changes, so the
  // clash warning stays accurate as the user edits the form.
  useEffect(() => {
    if (isEdit) return;
    if (!startsOn) return;
    if (closureType === "half_day" && !halfDayUntil) return;

    const handle = setTimeout(() => {
      previewImpact.mutate({
        startsOn,
        endsOn: resolvedEndsOn,
        closureType,
        halfDayUntil: closureType === "half_day" ? halfDayUntil : undefined,
        exceptionDoctorIds,
      });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEdit,
    startsOn,
    resolvedEndsOn,
    closureType,
    halfDayUntil,
    exceptionDoctorIds,
  ]);

  const preview = previewImpact.data;
  const totalAffected = useMemo(
    () =>
      preview?.doctors.reduce((sum, d) => sum + d.appointments.length, 0) ?? 0,
    [preview],
  );
  const packageCount = useMemo(
    () =>
      preview?.doctors.reduce(
        (sum, d) =>
          sum + d.appointments.filter((a) => a.type === "package").length,
        0,
      ) ?? 0,
    [preview],
  );

  const toggleException = (doctorId: string) => {
    setExceptionDoctorIds((prev) =>
      prev.includes(doctorId)
        ? prev.filter((id) => id !== doctorId)
        : [...prev, doctorId],
    );
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Name is required";
    if (!startsOn) return "Start date is required";
    if (resolvedEndsOn < startsOn)
      return "End date can't be before the start date";
    if (closureType === "half_day" && !halfDayUntil)
      return "A cut-off time is required for a half day";
    return null;
  };

  const doCreate = async (resolutions: HolidayResolution[]) => {
    await createHoliday.mutateAsync({
      name: name.trim(),
      startsOn,
      endsOn: resolvedEndsOn,
      closureType,
      halfDayUntil: closureType === "half_day" ? halfDayUntil : undefined,
      repeatsAnnually,
      exceptionDoctorIds,
      resolutions,
    });
    setShowImpactModal(false);
    onClose();
  };

  const save = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    if (isEdit && holiday) {
      try {
        await updateHoliday.mutateAsync({
          holidayId: holiday.id,
          updates: {
            name: name.trim(),
            closureType,
            halfDayUntil: closureType === "half_day" ? halfDayUntil : undefined,
            repeatsAnnually,
            exceptionDoctorIds,
          },
        });
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update holiday",
        );
      }
      return;
    }

    if (totalAffected > 0) {
      setShowImpactModal(true);
      return;
    }

    try {
      await doCreate([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save holiday");
    }
  };

  const removeOrRestore = async () => {
    if (!holiday) return;
    await setStatus.mutateAsync({
      holidayId: holiday.id,
      status: holiday.status === "active" ? "removed" : "active",
    });
    onClose();
  };

  const saving = createHoliday.isPending || updateHoliday.isPending;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/35" onClick={onClose} />
      <div className="relative w-full max-w-[520px] h-full bg-surface-paper shadow-2xl flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink-900">
              {isEdit ? "Edit holiday" : "Add a holiday"}
            </h2>
            <p className="text-xs text-ink-500 mt-1">
              Closes the day for every doctor unless you list exceptions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-canvas text-ink-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="text-sm text-status-danger">{error}</div>}

          <Field label="Name" hint="Patients see this">
            <input
              type="text"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <input
                type="date"
                className={inputClass}
                value={startsOn}
                disabled={isEdit}
                onChange={(e) => setStartsOn(e.target.value)}
              />
            </Field>
            <Field label="To" hint="Same day if blank">
              <input
                type="date"
                className={inputClass}
                value={endsOn}
                disabled={isEdit}
                min={startsOn}
                onChange={(e) => setEndsOn(e.target.value)}
              />
            </Field>
          </div>

          <Field label="What closes">
            <div className="space-y-2">
              {HOLIDAY_CLOSURE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={closureType === opt.value}
                  onClick={() => setClosureType(opt.value)}
                  className={`w-full flex gap-3 items-start text-left p-3 rounded-xl border ${
                    closureType === opt.value
                      ? "border-brand-violet bg-brand-violet-soft"
                      : "border-border"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border flex-none mt-0.5 ${
                      closureType === opt.value
                        ? "border-[5px] border-brand-violet bg-white"
                        : "border-border bg-white"
                    }`}
                  />
                  <span>
                    <span
                      className={`block text-sm font-semibold ${closureType === opt.value ? "text-brand-violet" : "text-ink-900"}`}
                    >
                      {opt.label}
                    </span>
                    <span className="block text-xs text-ink-500 mt-0.5 leading-snug">
                      {opt.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {closureType === "half_day" && (
              <div className="mt-2.5">
                <Field label="Open until">
                  <input
                    type="time"
                    className={inputClass}
                    value={halfDayUntil}
                    onChange={(e) => setHalfDayUntil(e.target.value)}
                  />
                </Field>
              </div>
            )}
          </Field>

          <Field label="Repeats">
            <div className="flex gap-3 items-start border border-border rounded-lg p-3">
              <ToggleSwitch
                checked={repeatsAnnually}
                onChange={setRepeatsAnnually}
              />
              <div>
                <div className="text-sm font-semibold text-ink-900">
                  Every year on{" "}
                  {startsOn ? formatDateLabel(startsOn, startsOn) : "this date"}
                </div>
                <div className="text-xs text-ink-500 mt-0.5 leading-snug">
                  Only for fixed-date holidays. Leave off for festivals that
                  move each year.
                </div>
              </div>
            </div>
          </Field>

          <Field label="Doctors who still see patients" optional>
            <div className="border border-border rounded-lg divide-y divide-border">
              {doctors.length === 0 && (
                <div className="px-3 py-2.5 text-xs text-ink-500">
                  No doctors in this hospital yet.
                </div>
              )}
              {doctors.map((doc: any) => (
                <label
                  key={doc.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={exceptionDoctorIds.includes(doc.id)}
                    onChange={() => toggleException(doc.id)}
                    className="w-4 h-4 rounded border-border text-brand-violet"
                  />
                  <span className="text-ink-900">Dr. {doc.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-ink-500 mt-1.5">
              Anyone ticked keeps their normal hours. Everyone else shows as
              closed to patients.
            </p>
          </Field>

          {!isEdit && totalAffected > 0 && preview && (
            <div className="bg-status-danger-soft border border-status-danger/30 rounded-xl p-3">
              <div className="text-sm font-semibold text-status-danger">
                {totalAffected} appointment{totalAffected === 1 ? "" : "s"}{" "}
                already booked on {formatDateLabel(startsOn, resolvedEndsOn)}
              </div>
              {packageCount > 0 && (
                <div className="text-xs text-status-danger mt-1 leading-relaxed">
                  {packageCount} of them {packageCount === 1 ? "is a" : "are"}{" "}
                  prepaid package visit
                  {packageCount === 1 ? "" : "s"} — cancelling those
                  doesn&apos;t cost the patient a visit, since it hasn&apos;t
                  been used yet.
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowImpactModal(true)}
                className="mt-2.5 bg-status-danger text-white text-xs font-semibold rounded-lg px-3 py-1.5"
              >
                Review and reschedule →
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          {isEdit && holiday && (
            <button
              type="button"
              onClick={removeOrRestore}
              disabled={setStatus.isPending}
              className="px-3.5 py-2 rounded-lg border border-status-danger/30 text-status-danger text-sm font-semibold disabled:opacity-60"
            >
              {holiday.status === "active"
                ? "Remove holiday"
                : "Restore holiday"}
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-ink-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="px-4 py-2 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-1.5"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {!isEdit && totalAffected > 0
              ? "Review and reschedule"
              : "Save holiday"}
          </button>
        </div>
      </div>

      {showImpactModal && preview && (
        <HolidayImpactModal
          preview={preview}
          holidayLabel={formatDateLabel(startsOn, resolvedEndsOn)}
          isSubmitting={createHoliday.isPending}
          onBack={() => setShowImpactModal(false)}
          onApply={(resolutions) => {
            doCreate(resolutions).catch((err) => {
              setError(
                err instanceof Error ? err.message : "Failed to save holiday",
              );
            });
          }}
        />
      )}
    </div>
  );
}
