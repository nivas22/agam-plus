"use client";

import { format } from "date-fns";
import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getDoctorById } from "@/hooks/useNewDoctorApi";
import { useAvailabilityApi } from "@/hooks/useAvailability";
import { useDoctorDashboardPracticeStats } from "@/hooks/useDoctorDashboardApi";
import type { Doctor } from "@/types/doctorNew";
import type { TimeSlot } from "@/types/appointment";
import {
  Card,
  KV,
  ProfileHero,
  SecuritySummaryCard,
  SessionsCard,
  Tag,
} from "./ProfileShared";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

export default function DoctorProfileView() {
  const router = useRouter();
  const { user, currentHospital } = useAuth();
  const hospitalId = currentHospital?.id || "";
  const doctorId = user?.id || "";

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!hospitalId || !doctorId) return;
    setLoading(true);
    getDoctorById(hospitalId, doctorId)
      .then((d) => !cancelled && setDoctor(d))
      .catch(() => !cancelled && setDoctor(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [hospitalId, doctorId]);

  const { availability } = useAvailabilityApi(hospitalId, doctorId);
  const month = format(new Date(), "yyyy-MM");
  const { data: stats } = useDoctorDashboardPracticeStats(month, hospitalId);

  const getDaySlots = (day: string): TimeSlot[] =>
    availability?.availability?.filter((s) => s.day === day) || [];

  if (loading || !doctor) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="animate-pulse text-sm text-ink-500">Loading profile…</div>
      </div>
    );
  }

  const days = availability?.availability?.map((s) => s.day) || [];
  const activeDays = Array.from(new Set(days));

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <ProfileHero
        name={doctor.name}
        meta={
          <>
            {doctor.qualification}
            {doctor.medicalRegistrationNumber && <> · {doctor.medicalRegistrationNumber}</>} · {currentHospital?.name}
          </>
        }
        tags={
          <>
            <Tag variant={doctor.status === "active" ? "ok" : "quiet"}>
              ● {doctor.status === "active" ? "ACCEPTING BOOKINGS" : doctor.status.toUpperCase()}
            </Tag>
            {activeDays.length > 0 && <Tag variant="quiet">{activeDays.join(" · ").toUpperCase()}</Tag>}
            {doctor.consultationFee != null && (
              <Tag variant="quiet">
                ₹{doctor.consultationFee}
                {doctor.appointmentDuration ? ` · ${doctor.appointmentDuration} MIN` : ""}
              </Tag>
            )}
          </>
        }
        actions={
          <button
            onClick={() =>
              router.push(`/hospital/${hospitalId}/doctors/${doctorId}/add/availability`)
            }
            className="px-3.5 py-2 rounded-lg border border-border text-sm font-semibold text-ink-700 hover:bg-surface-canvas"
          >
            Manage availability
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Card
            title="Professional details"
            right={
              <button
                onClick={() => router.push("/setup/doctor-profile")}
                className="text-xs font-medium text-brand-violet hover:underline"
              >
                Edit
              </button>
            }
          >
            <KV label="Qualification" value={doctor.qualification} />
            {doctor.medicalRegistrationNumber && (
              <KV label="Medical registration" value={doctor.medicalRegistrationNumber} />
            )}
            <KV label="Specialization" value={doctor.specialization} />
            <KV label="Consultation fee" value={doctor.consultationFee != null ? `₹${doctor.consultationFee}` : "—"} />
            {doctor.experience && <KV label="Experience" value={doctor.experience} />}
          </Card>

          <Card title="About">
            <div className="px-4 py-3.5 text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
              {doctor.bio || <span className="text-ink-500 italic">No bio added yet.</span>}
            </div>
          </Card>

          <Card
            title="Weekly schedule"
            right={
              <button
                onClick={() =>
                  router.push(`/hospital/${hospitalId}/doctors/${doctorId}/add/availability`)
                }
                className="text-xs font-medium text-brand-violet hover:underline"
              >
                Edit
              </button>
            }
          >
            {!availability?.availability?.length ? (
              <div className="px-4 py-6 text-center">
                <Clock className="w-8 h-8 text-border mx-auto mb-2" />
                <p className="text-sm text-ink-500">No schedule configured yet.</p>
              </div>
            ) : (
              DAYS.map((day) => {
                const slots = getDaySlots(day);
                return (
                  <div
                    key={day}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border first:border-t-0 text-sm"
                  >
                    <span className="font-medium text-ink-900 w-24 shrink-0">{day}</span>
                    {slots.length === 0 ? (
                      <span className="text-ink-500">Unavailable</span>
                    ) : (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {slots.map((s, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-brand-violet-soft text-brand-violet text-xs font-medium rounded-md font-mono tabular"
                          >
                            {formatTime(s.startTime)}–{formatTime(s.endTime)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {stats && (
            <Card title="Your practice" subtitle={format(new Date(), "MMMM")}>
              <div className="grid grid-cols-3 divide-x divide-border">
                <div className="px-3 py-3.5">
                  <div className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">Patients seen</div>
                  <div className="text-xl font-bold text-ink-900 font-mono tabular mt-0.5">
                    {stats.patientsSeen.value}
                  </div>
                  <div className="text-[11px] text-ink-500">{stats.patientsSeen.clinicDaysCount} clinic days</div>
                </div>
                <div className="px-3 py-3.5">
                  <div className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">Diary filled</div>
                  <div className="text-xl font-bold text-ink-900 font-mono tabular mt-0.5">
                    {stats.diaryFilledPct.value != null ? `${stats.diaryFilledPct.value}%` : "—"}
                  </div>
                </div>
                <div className="px-3 py-3.5">
                  <div className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">Notes same day</div>
                  <div className="text-xl font-bold text-ink-900 font-mono tabular mt-0.5">
                    {stats.notesSameDayPct != null ? `${stats.notesSameDayPct}%` : "—"}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <SecuritySummaryCard hasPassword={user?.hasPassword} lastLogin={user?.lastLogin} hospitalId={hospitalId} />
          <SessionsCard hospitalId={hospitalId} hasPassword={user?.hasPassword} />
        </div>
      </div>
    </div>
  );
}
