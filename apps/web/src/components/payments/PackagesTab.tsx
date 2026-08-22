// components/payments/PackagesTab.tsx
"use client";

import { format } from "date-fns";
import {
  BookOpen,
  Loader2,
  Package as PackageIcon,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import SellPackageDialog from "@/components/appointments/SellPackageDialog";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { usePackageStats, usePackagesList } from "@/hooks/useNewPackageApi";
import {
  useHospitalPatient,
  useSearchHospitalPatients,
} from "@/hooks/useNewPatientApi";
import type { Doctor } from "@/types/doctorNew";
import type { PackageRecord } from "@/types/package";
import { PACKAGE_DISPLAY_STATUS } from "../../constants";
import {
  DialogShell,
  secondaryBtn,
} from "../appointments/AppointmentActionDialogs";
import {
  ExtendDialog,
  LedgerDialog,
  RefundOrExtendDialog,
} from "./PackageActionDialogs";

interface PackagesTabProps {
  hospitalId: string;
  onToast: (message: string) => void;
}

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function dateLabel(dateStr: string): string {
  return format(new Date(`${dateStr}T00:00:00`), "d MMM yyyy");
}

type DialogState =
  | { kind: "ledger"; pkg: PackageRecord }
  | { kind: "extend"; pkg: PackageRecord }
  | { kind: "refundOrExtend"; pkg: PackageRecord }
  | { kind: "renew"; pkg: PackageRecord }
  | null;

function StatusPill({ pkg }: { pkg: PackageRecord }) {
  switch (pkg.displayStatus) {
    case PACKAGE_DISPLAY_STATUS.ACTIVE:
      return (
        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-status-open-soft text-status-open">
          Active
        </span>
      );
    case PACKAGE_DISPLAY_STATUS.LAPSING:
      return (
        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-status-warning-soft text-status-warning">
          Lapses in {Math.max(0, pkg.daysUntilExpiry)} day
          {pkg.daysUntilExpiry === 1 ? "" : "s"}
        </span>
      );
    case PACKAGE_DISPLAY_STATUS.USED_UP:
      return (
        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-surface-canvas text-ink-500">
          Used up
        </span>
      );
    case PACKAGE_DISPLAY_STATUS.LAPSED:
      return (
        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-status-danger-soft text-status-danger">
          Lapsed
        </span>
      );
    case PACKAGE_DISPLAY_STATUS.REFUNDED:
      return (
        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-surface-canvas text-ink-500">
          Refunded
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-surface-canvas text-ink-500">
          Cancelled
        </span>
      );
  }
}

function ActionButton({
  pkg,
  onPick,
}: {
  pkg: PackageRecord;
  onPick: (kind: "ledger" | "extend" | "refundOrExtend" | "renew") => void;
}) {
  const cls =
    "h-7 px-3 rounded-lg border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas transition-colors";
  switch (pkg.displayStatus) {
    case PACKAGE_DISPLAY_STATUS.LAPSING:
      return (
        <button type="button" className={cls} onClick={() => onPick("extend")}>
          Extend
        </button>
      );
    case PACKAGE_DISPLAY_STATUS.USED_UP:
      return (
        <button type="button" className={cls} onClick={() => onPick("renew")}>
          Renew
        </button>
      );
    case PACKAGE_DISPLAY_STATUS.LAPSED:
      return (
        <button
          type="button"
          className={cls}
          onClick={() => onPick("refundOrExtend")}
        >
          Refund / extend
        </button>
      );
    default:
      return (
        <button type="button" className={cls} onClick={() => onPick("ledger")}>
          Ledger
        </button>
      );
  }
}

function ProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 rounded-full bg-surface-canvas overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-violet"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-ink-700 whitespace-nowrap">
        {used} / {total}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*                    "+ Sell package" — pick a patient first             */
/* ---------------------------------------------------------------------- */

function PatientPickerDialog({
  hospitalId,
  onClose,
  onPick,
}: {
  hospitalId: string;
  onClose: () => void;
  onPick: (patientId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useSearchHospitalPatients(hospitalId, query);
  const results = data?.patients || [];

  return (
    <DialogShell
      icon={<Search className="w-4.5 h-4.5" />}
      iconTone="bg-brand-violet-soft text-brand-violet"
      title="Sell a package — find the patient"
      onClose={onClose}
      footer={
        <button type="button" className={secondaryBtn} onClick={onClose}>
          Cancel
        </button>
      }
    >
      <div className="p-5 overflow-y-auto flex-1">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
          />
        </div>
        {query.trim().length < 2 ? (
          <div className="text-sm text-ink-500 text-center py-8">
            Type at least 2 characters to search.
          </div>
        ) : isLoading ? (
          <div className="text-sm text-ink-500 text-center py-8 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Searching…
          </div>
        ) : results.length === 0 ? (
          <div className="text-sm text-ink-500 text-center py-8">
            No patients found.
          </div>
        ) : (
          <div className="space-y-1.5">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id)}
                className="w-full text-left border border-border rounded-lg px-3.5 py-2.5 hover:border-brand-violet hover:bg-brand-violet-soft/40 transition-colors"
              >
                <div className="text-sm font-medium text-ink-900">{p.name}</div>
                <div className="text-xs text-ink-500">{p.phone}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function RenewLauncher({
  hospitalId,
  pkg,
  doctors,
  onClose,
  onSuccess,
}: {
  hospitalId: string;
  pkg: PackageRecord;
  doctors: Doctor[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const { data, isLoading } = useHospitalPatient(pkg.patientId, hospitalId);

  if (isLoading || !data?.patient) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-surface-paper rounded-xl px-5 py-4 text-sm text-ink-700 flex items-center gap-2 shadow-2xl">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading patient…
        </div>
      </div>
    );
  }

  return (
    <SellPackageDialog
      hospitalId={hospitalId}
      patient={data.patient}
      doctors={doctors}
      initialDoctorId={pkg.doctorProfileId}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

/* ---------------------------------------------------------------------- */
/*                                  tab                                   */
/* ---------------------------------------------------------------------- */

export default function PackagesTab({ hospitalId, onToast }: PackagesTabProps) {
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [sellFlow, setSellFlow] = useState<
    { step: "pickPatient" } | { step: "sell"; patientId: string } | null
  >(null);

  const { data: statsData, isLoading: statsLoading } =
    usePackageStats(hospitalId);
  const { data: listData, isLoading: listLoading } =
    usePackagesList(hospitalId);
  const { data: doctorsData } = useHospitalDoctors(hospitalId, undefined, true);
  const doctors = doctorsData?.doctors || [];

  const patientForSell = useHospitalPatient(
    sellFlow?.step === "sell" ? sellFlow.patientId : "",
    hospitalId,
  );

  const packages = listData?.packages || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (p) =>
        p.patientName?.toLowerCase().includes(q) ||
        p.patientPhone?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [packages, search]);

  const handleSuccess = (message: string) => {
    onToast(message);
    setDialog(null);
    setSellFlow(null);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setSellFlow({ step: "pickPatient" })}
            className="h-9 px-3.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold flex items-center gap-1.5"
          >
            <PackageIcon className="w-3.5 h-3.5" /> Sell package
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Packages sold · {format(new Date(), "MMMM")}
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {statsLoading ? "—" : money(statsData?.soldThisMonth.amount || 0)}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {statsData?.soldThisMonth.count ?? 0} package
            {statsData?.soldThisMonth.count === 1 ? "" : "s"} ·{" "}
            {statsData?.soldThisMonth.patients ?? 0} patients
          </div>
        </div>
        <div className="rounded-xl p-4 bg-brand-violet-soft border border-brand-violet/20 shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-brand-violet">
            Unredeemed — money owed in visits
          </div>
          <div className="font-mono text-2xl font-bold text-brand-violet mt-1">
            {statsLoading ? "—" : money(statsData?.unredeemed.value || 0)}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {statsData?.unredeemed.patients ?? 0} patients ·{" "}
            {statsData?.unredeemed.visits ?? 0} visits outstanding
          </div>
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-status-warning">
            Lapsing in 30 days
          </div>
          <div className="font-mono text-2xl font-bold text-status-warning mt-1">
            {statsLoading ? "—" : money(statsData?.lapsingSoon.value || 0)}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {statsData?.lapsingSoon.patients ?? 0} patients ·{" "}
            {statsData?.lapsingSoon.visits ?? 0} unused visits
          </div>
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Redeemed today
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {statsData?.redeemedToday.visits ?? 0} visit
            {statsData?.redeemedToday.visits === 1 ? "" : "s"}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {money(statsData?.redeemedToday.cashCollected || 0)} cash collected
          </div>
        </div>
      </div>

      <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-ink-900">
            Active packages
          </h2>
          <div className="ml-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Patient, phone or package ID"
              className="h-9 pl-8 pr-3 rounded-lg border border-border bg-surface-canvas text-sm w-56 focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
            />
          </div>
        </div>

        {listLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-violet" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 px-6 text-center text-sm text-ink-500">
            No packages sold yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500 bg-surface-canvas/40">
                  <th className="px-4 py-2.5 font-semibold">Patient</th>
                  <th className="px-3 py-2.5 font-semibold">Package</th>
                  <th className="px-3 py-2.5 font-semibold">Doctor</th>
                  <th className="px-3 py-2.5 font-semibold">Progress</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Paid</th>
                  <th className="px-3 py-2.5 font-semibold text-right">
                    Value left
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Expires</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="font-medium text-ink-900">
                        {p.patientName || "—"}
                      </div>
                      <div className="text-[11px] text-ink-500">
                        {p.patientPhone}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {p.totalVisits} visits ·{" "}
                      <span className="font-mono text-xs text-ink-500">
                        #{p.id.slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-700">
                      Dr. {p.doctorName || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <ProgressBar used={p.usedVisits} total={p.totalVisits} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {money(p.amountPaid)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {money(p.valueLeft)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-ink-700">
                      {p.displayStatus === PACKAGE_DISPLAY_STATUS.USED_UP
                        ? "—"
                        : dateLabel(p.validUntil)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <StatusPill pkg={p} />
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <ActionButton
                        pkg={p}
                        onPick={(kind) =>
                          setDialog({ kind, pkg: p } as DialogState)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3.5 bg-surface-paper border border-border border-l-4 border-l-brand-violet rounded-xl px-4 py-3 text-xs text-ink-700 leading-relaxed flex gap-2.5">
        <BookOpen className="w-4 h-4 shrink-0 mt-0.5 text-brand-violet" />
        <span>
          <b className="text-ink-900">
            Why package sales sit apart from the day's collection.
          </b>{" "}
          The money arrives today but the hospital hasn't earned it yet — it is
          owed as future visits. Collections counts cash on the day it lands;
          earned revenue counts a visit's share only once it's actually
          delivered. Mixing the two makes a good month look better than it was,
          and the month the visits get used look empty.
        </span>
      </div>

      {dialog?.kind === "ledger" && (
        <LedgerDialog
          hospitalId={hospitalId}
          pkg={dialog.pkg}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "extend" && (
        <ExtendDialog
          hospitalId={hospitalId}
          pkg={dialog.pkg}
          onClose={() => setDialog(null)}
          onSuccess={handleSuccess}
        />
      )}
      {dialog?.kind === "refundOrExtend" && (
        <RefundOrExtendDialog
          hospitalId={hospitalId}
          pkg={dialog.pkg}
          onClose={() => setDialog(null)}
          onSuccess={handleSuccess}
          onChooseExtend={() => setDialog({ kind: "extend", pkg: dialog.pkg })}
        />
      )}
      {dialog?.kind === "renew" && (
        <RenewLauncher
          hospitalId={hospitalId}
          pkg={dialog.pkg}
          doctors={doctors}
          onClose={() => setDialog(null)}
          onSuccess={handleSuccess}
        />
      )}

      {sellFlow?.step === "pickPatient" && (
        <PatientPickerDialog
          hospitalId={hospitalId}
          onClose={() => setSellFlow(null)}
          onPick={(patientId) => setSellFlow({ step: "sell", patientId })}
        />
      )}
      {sellFlow?.step === "sell" && patientForSell.data?.patient && (
        <SellPackageDialog
          hospitalId={hospitalId}
          patient={patientForSell.data.patient}
          doctors={doctors}
          onClose={() => setSellFlow(null)}
          onSuccess={handleSuccess}
        />
      )}
      {sellFlow?.step === "sell" && !patientForSell.data?.patient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface-paper rounded-xl px-5 py-4 text-sm text-ink-700 flex items-center gap-2 shadow-2xl">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading patient…
          </div>
        </div>
      )}
    </div>
  );
}
