"use client";

import { useAuth } from "@/hooks/useAuth";
import { ROLE } from "../../constants";
import DoctorProfileView from "./DoctorProfileView";
import HospitalAdminProfile from "./HospitalAdminProfile";
import StaffProfileView from "./StaffProfileView";

// Dispatches to a role-specific profile layout — each role sees very
// different real data (a doctor's practice stats, a front desk's cash
// drawer, an admin's hospital roster), so one shared template would either
// show the wrong sections per role or force awkward conditionals inline.
// Platform admins have their own route at /platform-admin/profile since
// they aren't scoped to a single hospital.
export default function ProfilePage() {
  const { loading, getCurrentHospitalRole } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-canvas">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-brand-violet-soft rounded-full" />
            <div className="absolute inset-0 border-4 border-t-brand-violet rounded-full animate-spin" />
          </div>
          <p className="text-ink-700 font-medium text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  const role = getCurrentHospitalRole();

  return (
    <div className="min-h-screen bg-surface-canvas">
      {role === ROLE.DOCTOR ? (
        <DoctorProfileView />
      ) : role === ROLE.FRONT_DESK || role === ROLE.NURSE || role === ROLE.ACCOUNTANT ? (
        <StaffProfileView />
      ) : (
        <HospitalAdminProfile />
      )}
    </div>
  );
}
