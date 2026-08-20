"use client";

import { X, Filter, User } from "lucide-react";
import { FaVenusMars, FaUserMd, FaUser } from "react-icons/fa";
import FilterSelect from "./FilterSelect";
import { PageFilterOptions } from "@/types/filter";
import { GENDER } from "@agam-plus/shared";

type Option = {
  value: string;
  label: string;
};

interface FiltersPanelProps {
  title: string;
  filterType: string;
  filters: {
    statusFilter?: boolean;
    doctorFilter?: boolean;
    frequencyFilter?: boolean;
    genderFilter?: boolean;
    patientFilter?: boolean;
    dateFilter?: boolean;
  };
  doctors?: { id: string; name: string }[];
  patients?: { id: string; name: string }[];
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  frequencyFilter: string;
  setFrequencyFilter: (value: string) => void;
  genderFilter: string;
  setGenderFilter: (value: string) => void;
  doctorFilter: string;
  setDoctorFilter: (value: string) => void;
  patientFilter: string;
  setPatientFilter: (value: string) => void;
  dateFilter: string;
  setDateFilter: (value: string) => void;
  onClose: () => void;
  onClear: () => void;
}

// -------------------- FILTER CONFIGS --------------------
export const PATIENT_PAGE_FILTERS = {
  statusFilter: true,
  doctorFilter: true,
  frequencyFilter: false,
  genderFilter: false,
};

export const DOCTORS_PAGE_FILTERS = {
  statusFilter: true,
};

export const APPOINTMENTS_PAGE_FILTERS = {
  statusFilter: true,
  doctorFilter: true,
  patientFilter: true,
  dateFilter: false,
};

// -------------------- OPTIONS --------------------
const DOCTORS_STATUS_OPTIONS: Option[] = [
  { value: "all", label: "All Statuses" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

const PATIENT_STATUS_OPTIONS: Option[] = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const APPOINTMENT_STATUS_OPTIONS: Option[] = [
  { value: "all", label: "All Statuses" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PATIENT_FREQUENCY_OPTIONS: Option[] = [
  { value: "all", label: "All Frequencies" },
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const GENDER_OPTIONS: Option[] = [
  { value: "all", label: "All Genders" },
  { value: GENDER.MALE, label: GENDER.MALE },
  { value: GENDER.FEMALE, label: GENDER.FEMALE },
  { value: GENDER.OTHER, label: GENDER.OTHER },
];

const DATE_FILTER_OPTIONS: Option[] = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "thisWeek", label: "This Week" },
  { value: "thisMonth", label: "This Month" },
];

// -------------------- COMPONENT --------------------
export default function NewFiltersPanel({
  title,
  filterType,
  filters,
  doctors = [],
  patients = [],
  statusFilter,
  setStatusFilter,
  frequencyFilter,
  setFrequencyFilter,
  genderFilter,
  setGenderFilter,
  doctorFilter,
  setDoctorFilter,
  patientFilter,
  setPatientFilter,
  dateFilter,
  setDateFilter,
  onClose,
  onClear,
}: FiltersPanelProps) {
  const statusOptions =
    filterType === PageFilterOptions.DOCTOR
      ? DOCTORS_STATUS_OPTIONS
      : filterType === PageFilterOptions.APPOINTMENT
      ? APPOINTMENT_STATUS_OPTIONS
      : PATIENT_STATUS_OPTIONS;

  return (
    <div className="bg-surface-paper p-4 rounded-xl shadow-sm border border-border mb-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-ink-700">Filter {title}</h3>
        <button
          onClick={onClose}
          className="text-ink-500 hover:text-ink-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filters.statusFilter && (
          <FilterSelect
            label="Status"
            icon={User}
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
          />
        )}

        {filters.frequencyFilter && (
          <FilterSelect
            label="Frequency"
            icon={Filter}
            value={frequencyFilter}
            onChange={setFrequencyFilter}
            options={PATIENT_FREQUENCY_OPTIONS}
          />
        )}

        {filters.genderFilter && (
          <FilterSelect
            label="Gender"
            icon={FaVenusMars}
            value={genderFilter}
            onChange={setGenderFilter}
            options={GENDER_OPTIONS}
          />
        )}

        {filters.doctorFilter && (
          <FilterSelect
            label="Doctor"
            icon={FaUserMd}
            value={doctorFilter}
            onChange={setDoctorFilter}
            options={[
              { value: "all", label: "All Doctors" },
              ...doctors.map((d) => ({
                value: d.id,
                label: d.name,
              })),
            ]}
          />
        )}

        {filters.patientFilter && (
          <FilterSelect
            label="Patient"
            icon={FaUser}
            value={patientFilter}
            onChange={setPatientFilter}
            options={[
              { value: "all", label: "All Patients" },
              ...patients.map((p) => ({
                value: p.id,
                label: p.name,
              })),
            ]}
          />
        )}

        {filters.dateFilter && (
          <FilterSelect
            label="Date"
            icon={Filter}
            value={dateFilter}
            onChange={setDateFilter}
            options={DATE_FILTER_OPTIONS}
          />
        )}
      </div>

      {/* Clear Filters */}
      <div className="flex justify-end mt-4">
        <button
          onClick={onClear}
          className="px-4 py-2 text-sm text-ink-700 hover:text-ink-900 font-medium"
        >
          Clear all filters
        </button>
      </div>
    </div>
  );
}
