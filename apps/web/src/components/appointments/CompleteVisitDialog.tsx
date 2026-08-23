// components/appointments/CompleteVisitDialog.tsx
"use client";

import {
  AlertCircle,
  Clock,
  Loader2,
  Package as PackageIcon,
  ReceiptText,
  Smartphone,
  SplitSquareHorizontal,
  Trash2,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { usePackageLedger } from "@/hooks/useNewPackageApi";
import { useCompleteVisit } from "@/hooks/useNewPaymentApi";
import { useChargeCatalogItems } from "@/hooks/useChargeCatalogApi";
import { useAuth } from "@/hooks/useAuth";
import type { AppointmentWithDetails } from "@/types/appointment";
import type {
  FollowUpOption,
  PaymentItem,
  PaymentMethod,
} from "@/types/payment";
import {
  APPOINTMENT_TYPE,
  FOLLOW_UP_OPTIONS,
  PAYMENT_DUE_REASONS,
  PAYMENT_METHOD,
} from "../../constants";
import {
  ContextStrip,
  DialogShell,
  primaryBtn,
  secondaryBtn,
} from "./AppointmentActionDialogs";

type UpdateStatusFn = (
  appointmentId: string,
  status: string,
  sessionNotes?: string,
  appointmentData?: Partial<AppointmentWithDetails>,
) => Promise<void>;

interface CompleteVisitDialogProps {
  appointment: AppointmentWithDetails;
  hospitalId: string;
  consultationFee?: number;
  doctorName?: string;
  patientCode?: string;
  collectedByName?: string;
  updateAppointmentStatus: UpdateStatusFn;
  // Lets a caller that already collected these live (e.g. the doctor's Today
  // console) carry that work into the dialog instead of losing it.
  initialSessionNotes?: string;
  initialFollowUp?: FollowUpOption;
  initialExtraItems?: PaymentItem[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function dateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Deterministic placeholder QR pattern — not a real scan target. A production
// build would encode `upi://pay?pa=<vpa>&am=<total>` through a QR library.
function PlaceholderQr({ seed }: { seed: number }) {
  const cells = useMemo(() => {
    const size = 21;
    const grid: number[][] = [];
    let s = Math.max(1, Math.round(seed));
    for (let i = 0; i < size; i++) {
      grid[i] = [];
      for (let j = 0; j < size; j++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        grid[i][j] = (s >> 7) & 1;
      }
    }
    const finder = (x: number, y: number) => {
      for (let a = 0; a < 7; a++) {
        for (let b = 0; b < 7; b++) {
          const on =
            a === 0 ||
            a === 6 ||
            b === 0 ||
            b === 6 ||
            (a > 1 && a < 5 && b > 1 && b < 5);
          grid[y + a][x + b] = on ? 1 : 0;
        }
      }
    };
    finder(0, 0);
    finder(size - 7, 0);
    finder(0, size - 7);
    const rects: { x: number; y: number }[] = [];
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (grid[i][j]) rects.push({ x: j, y: i });
      }
    }
    return rects;
  }, [seed]);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 113.4 113.4"
      fill="currentColor"
      className="text-ink-900"
    >
      {cells.map((c) => (
        <rect
          key={`${c.x}-${c.y}`}
          x={c.x * 5.4}
          y={c.y * 5.4}
          width={5.4}
          height={5.4}
        />
      ))}
    </svg>
  );
}

export default function CompleteVisitDialog({
  appointment,
  hospitalId,
  consultationFee,
  doctorName,
  patientCode,
  collectedByName,
  updateAppointmentStatus,
  initialSessionNotes,
  initialFollowUp,
  initialExtraItems,
  onClose,
  onSuccess,
}: CompleteVisitDialogProps) {
  const [sessionNotes, setSessionNotes] = useState(
    initialSessionNotes ?? appointment.sessionNotes ?? "",
  );
  const [followUp, setFollowUp] = useState<FollowUpOption>(
    initialFollowUp ?? "none",
  );
  const [items, setItems] = useState<PaymentItem[]>([
    {
      name: "Consultation",
      quantity: 1,
      unitPrice: consultationFee ?? 0,
      isAuto: true,
    },
    ...(initialExtraItems ?? []),
  ]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>(
    PAYMENT_METHOD.CASH as PaymentMethod,
  );
  const [amountTendered, setAmountTendered] = useState<number | "">("");
  const [upiReference, setUpiReference] = useState("");
  const [splitCash, setSplitCash] = useState<number | "">("");
  const [dueReason, setDueReason] = useState<string>(PAYMENT_DUE_REASONS[0]);
  const [sendReceipt, setSendReceipt] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);
  const [optOutPackage, setOptOutPackage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completeVisit = useCompleteVisit(hospitalId);
  const { isDoctor } = useAuth();
  const { data: chargeCatalogData } = useChargeCatalogItems(hospitalId, { status: "active" });
  const quickAddItems = (chargeCatalogData?.items || []).filter(
    (item) => isDoctor || item.frontDeskCanAdd,
  );

  const isPackageAppointment =
    appointment.type === APPOINTMENT_TYPE.PACKAGE && !!appointment.packageId;
  const { data: packageLedger } = usePackageLedger(
    hospitalId,
    appointment.packageId,
  );
  const pkg = isPackageAppointment ? packageLedger?.package : undefined;
  const canUsePackage =
    !!pkg &&
    (pkg.displayStatus === "active" || pkg.displayStatus === "lapsing") &&
    pkg.remainingVisits > 0;
  const usingPackage = canUsePackage && !optOutPackage;

  const rawSubtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const coveredAmount = usingPackage
    ? items
        .filter((item) => item.isAuto)
        .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    : 0;
  const subtotal = rawSubtotal - coveredAmount;
  const total = Math.max(subtotal - discount, 0);
  const tendered = amountTendered === "" ? 0 : amountTendered;
  const change = Math.max(tendered - total, 0);
  const splitCashAmount = splitCash === "" ? 0 : Math.min(splitCash, total);
  const splitUpiAmount = Math.max(total - splitCashAmount, 0);

  const addItem = (name: string, price: number, chargeCatalogItemId?: string) => {
    setItems((cur) => {
      const existing = cur.find((i) => i.name === name);
      if (existing)
        return cur.map((i) =>
          i.name === name ? { ...i, quantity: i.quantity + 1 } : i,
        );
      return [...cur, { name, quantity: 1, unitPrice: price, chargeCatalogItemId }];
    });
  };

  const handleAddCustomItem = () => {
    const name = newItemName.trim();
    const price = Number(newItemPrice) || 0;
    if (!name) return;
    addItem(name, price);
    setNewItemName("");
    setNewItemPrice("");
  };

  const updateQuantity = (index: number, quantity: number) => {
    setItems((cur) =>
      cur.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    );
  };

  const removeItem = (index: number) => {
    setItems((cur) => cur.filter((_, i) => i !== index));
  };

  const saveNotesOnly = async () => {
    setSavingNotes(true);
    setError(null);
    try {
      await updateAppointmentStatus(
        appointment.id,
        appointment.status,
        sessionNotes,
      );
      onSuccess("Session notes saved");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const validate = (): string | null => {
    if (method === PAYMENT_METHOD.CASH && tendered < total) {
      return "Amount received is less than the total payable";
    }
    if (
      method === PAYMENT_METHOD.SPLIT &&
      splitCashAmount + splitUpiAmount !== total
    ) {
      return "Split amounts must add up to the total payable";
    }
    if (method === PAYMENT_METHOD.DUE && !dueReason) {
      return "Pick a reason for recording this visit as unpaid";
    }
    return null;
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    try {
      const result = await completeVisit.mutateAsync({
        appointmentId: appointment.id,
        sessionNotes: sessionNotes || undefined,
        followUp,
        items,
        discount,
        method,
        amountTendered: method === PAYMENT_METHOD.CASH ? tendered : undefined,
        collectedBy:
          method === PAYMENT_METHOD.CASH ? collectedByName : undefined,
        upiReference:
          method === PAYMENT_METHOD.UPI ? upiReference || undefined : undefined,
        splitCashAmount:
          method === PAYMENT_METHOD.SPLIT ? splitCashAmount : undefined,
        splitUpiAmount:
          method === PAYMENT_METHOD.SPLIT ? splitUpiAmount : undefined,
        dueReason: method === PAYMENT_METHOD.DUE ? dueReason : undefined,
        sendReceiptWhatsApp: sendReceipt,
        usePackageVisit: isPackageAppointment ? !optOutPackage : undefined,
      });
      onSuccess(result.message);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to complete the visit",
      );
    }
  };

  const ctaLabel =
    method === PAYMENT_METHOD.DUE
      ? `Complete with ${money(total)} due`
      : usingPackage
        ? total > 0
          ? `Redeem visit & collect ${money(total)}`
          : "Redeem visit & complete"
        : `Collect ${money(total)} & complete`;

  return (
    <DialogShell
      icon={<ReceiptText className="w-4.5 h-4.5" />}
      iconTone="bg-status-open-soft text-status-open"
      title={`Complete visit — ${appointment.patientName}`}
      subtitle={doctorName ? `Dr. ${doctorName}` : undefined}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <label className="flex items-center gap-2 text-xs text-ink-500 mr-auto">
            <input
              type="checkbox"
              checked={sendReceipt}
              onChange={(e) => setSendReceipt(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-brand-violet focus:ring-2 focus:ring-brand-violet/30"
            />
            {appointment.patientPhone
              ? `Send receipt on WhatsApp to ${appointment.patientPhone}`
              : "Send receipt on WhatsApp"}
          </label>
          <button
            type="button"
            className={secondaryBtn}
            onClick={saveNotesOnly}
            disabled={savingNotes || completeVisit.isPending}
          >
            {savingNotes ? "Saving…" : "Save notes only"}
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-brand-violet hover:bg-brand-violet-hover disabled:opacity-60`}
            disabled={completeVisit.isPending}
            onClick={submit}
          >
            {completeVisit.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            ) : null}
            {ctaLabel}
          </button>
        </>
      }
    >
      <ContextStrip appointment={appointment} patientCode={patientCode} />

      {error && (
        <div className="mx-5 mt-3 flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-status-danger-soft border border-status-danger/20 text-sm text-status-danger">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[0.85fr_1.15fr] flex-1 overflow-y-auto">
        {/* clinical */}
        <div className="p-5 pt-4">
          <label className="text-xs font-semibold text-ink-700 mb-1 block">
            Session notes
          </label>
          <p className="text-[11.5px] text-ink-500 mb-2">
            Goes to the patient record. Not printed on the receipt.
          </p>
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="Details about the session, treatment provided, observations, etc."
            rows={7}
            className="w-full p-3 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
          />

          <div className="mt-4">
            <label className="text-xs font-semibold text-ink-700 mb-1 block">
              Follow-up{" "}
              <span className="font-normal text-ink-500">optional</span>
            </label>
            <select
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value as FollowUpOption)}
              className="w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
            >
              {FOLLOW_UP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[11.5px] text-ink-500 mt-1.5">
              Creates a draft appointment the front desk can confirm.
            </p>
          </div>
        </div>

        {/* billing */}
        <div className="p-5 pt-4 border-t md:border-t-0 md:border-l border-border bg-surface-canvas/30">
          {isPackageAppointment && pkg && (
            <div className="flex items-start gap-2.5 mb-3.5 px-3.5 py-3 rounded-xl bg-brand-violet-soft border border-brand-violet/20">
              <span className="w-7 h-7 rounded-lg bg-brand-violet text-white flex items-center justify-center shrink-0">
                <PackageIcon className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink-900">
                  {pkg.totalVisits}-visit plan · Dr.{" "}
                  {pkg.doctorName || doctorName}
                </div>
                <div className="text-[11.5px] text-brand-violet mt-0.5">
                  Visit {Math.min(pkg.usedVisits + 1, pkg.totalVisits)} of{" "}
                  {pkg.totalVisits} · expires {dateLabel(pkg.validUntil)}
                </div>
                <div className="h-1.5 rounded-full bg-brand-violet/20 overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full bg-brand-violet"
                    style={{
                      width: `${Math.min(100, (pkg.usedVisits / pkg.totalVisits) * 100)}%`,
                    }}
                  />
                </div>
                {!canUsePackage && (
                  <div className="text-[11.5px] text-status-warning mt-1.5">
                    {pkg.remainingVisits === 0
                      ? "No visits left on this package — charged in full."
                      : "This package has lapsed — charged in full. Extend it from Payments → Package."}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-baseline gap-2">
            <h4 className="text-sm font-semibold text-ink-900">Bill</h4>
          </div>
          <p className="text-[11.5px] text-ink-500 mb-2.5">
            {usingPackage
              ? "Consultation is drawn from the package. Anything else is payable today."
              : "Consultation is pulled from the doctor's profile. Add anything given during the visit."}
          </p>

          <div className="border border-border rounded-xl bg-surface-paper overflow-hidden">
            {items.map((item, index) => {
              const covered = usingPackage && item.isAuto;
              return (
                <div
                  key={`${item.name}-${index}`}
                  className={`grid grid-cols-[1fr_50px_76px_20px] gap-2 items-center px-3 py-2 text-[13px] ${index > 0 ? "border-t border-border" : ""} ${covered ? "bg-brand-violet-soft" : item.isAuto ? "bg-surface-canvas/40" : ""}`}
                >
                  <div className="min-w-0 truncate">
                    {item.name}
                    {covered ? (
                      <span className="ml-1.5 text-[10px] font-semibold bg-brand-violet text-white rounded px-1 py-0.5 align-middle">
                        PACKAGE
                      </span>
                    ) : (
                      item.isAuto && (
                        <span className="ml-1.5 text-[10px] font-semibold bg-brand-violet-soft text-brand-violet rounded px-1 py-0.5 align-middle">
                          AUTO
                        </span>
                      )
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateQuantity(index, Number(e.target.value) || 1)
                    }
                    className="w-full text-center border border-border rounded-md py-1 text-xs bg-surface-canvas"
                  />
                  <div className="text-right font-mono">
                    {covered ? (
                      <>
                        <div className="text-[11px] text-ink-500 line-through">
                          {money(item.quantity * item.unitPrice)}
                        </div>
                        <div className="font-semibold text-brand-violet">
                          ₹0
                        </div>
                      </>
                    ) : (
                      money(item.quantity * item.unitPrice)
                    )}
                  </div>
                  {!item.isAuto ? (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-ink-500 hover:text-status-danger"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
          </div>

          {canUsePackage && (
            <label className="flex items-start gap-2 mt-2.5 text-[11.5px] text-ink-500 cursor-pointer">
              <input
                type="checkbox"
                checked={optOutPackage}
                onChange={(e) => setOptOutPackage(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 rounded border-border text-brand-violet focus:ring-2 focus:ring-brand-violet/30"
              />
              Don't use a package visit — charge the consultation in full
            </label>
          )}

          <div className="grid grid-cols-[1fr_78px_auto] gap-1.5 mt-2.5">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Add medicine, injection, test…"
              className="px-2.5 py-2 border border-border rounded-lg text-xs bg-surface-paper"
            />
            <input
              type="number"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              placeholder="₹"
              className="px-2.5 py-2 border border-border rounded-lg text-xs bg-surface-paper"
            />
            <button
              type="button"
              onClick={handleAddCustomItem}
              className="px-3.5 py-2 rounded-lg border border-status-open bg-status-open-soft text-status-open text-xs font-semibold whitespace-nowrap"
            >
              Add
            </button>
          </div>

          {quickAddItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-ink-500">Common:</span>
              {quickAddItems.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addItem(c.name, c.currentPrice, c.id)}
                  className="border border-dashed border-border rounded-md px-2 py-1 text-[11px] text-ink-700 hover:border-status-open hover:text-status-open hover:bg-status-open-soft"
                >
                  + {c.name.replace("Injection — ", "Inj. ")}{" "}
                  <span className="font-mono text-ink-500">{money(c.currentPrice)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 pt-2.5 border-t border-dashed border-border">
            {usingPackage && coveredAmount > 0 && (
              <div className="flex justify-between text-[13px] text-brand-violet py-0.5">
                <span>Covered by package</span>
                <span className="font-mono">− {money(coveredAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] text-ink-700 py-0.5">
              <span>Subtotal</span>
              <span className="font-mono">{money(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-ink-700 py-0.5">
              <span>Discount</span>
              <span className="flex items-center gap-1">
                − ₹
                <input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) =>
                    setDiscount(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-[70px] text-right border border-border rounded-md px-1.5 py-0.5 text-xs bg-surface-paper"
                />
              </span>
            </div>
            <div className="flex justify-between items-baseline mt-1.5 pt-2 border-t border-border">
              <span className="text-sm font-semibold text-ink-900">
                {usingPackage ? "Payable today" : "Total payable"}
              </span>
              <span className="font-mono text-2xl font-bold text-ink-900">
                {money(total)}
              </span>
            </div>
          </div>

          {usingPackage && pkg && (
            <div className="mt-2.5 text-[11.5px] text-ink-500 bg-surface-paper border border-border rounded-lg px-3 py-2">
              After this visit:{" "}
              <b className="text-ink-900">
                {Math.max(0, pkg.remainingVisits - 1)} visits left
              </b>{" "}
              · package value remaining{" "}
              <b className="font-mono text-ink-900">
                {money(
                  Math.max(0, pkg.remainingVisits - 1) * pkg.pricePerVisit,
                )}
              </b>{" "}
              · lapses {dateLabel(pkg.validUntil)}
            </div>
          )}

          <div className="mt-4">
            <label className="text-xs font-semibold text-ink-700 mb-2 block">
              How is the patient paying?
            </label>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[
                { m: PAYMENT_METHOD.CASH, icon: Wallet, label: "Cash" },
                {
                  m: PAYMENT_METHOD.UPI,
                  icon: Smartphone,
                  label: "UPI / GPay",
                },
                {
                  m: PAYMENT_METHOD.SPLIT,
                  icon: SplitSquareHorizontal,
                  label: "Split",
                },
                { m: PAYMENT_METHOD.DUE, icon: Clock, label: "Pay later" },
              ].map(({ m, icon: Icon, label }) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m as PaymentMethod)}
                  aria-pressed={method === m}
                  className={`flex flex-col items-center gap-1 border rounded-lg py-2.5 text-xs font-medium transition-colors ${
                    method === m
                      ? "border-brand-violet bg-brand-violet-soft text-brand-violet ring-1 ring-brand-violet/30"
                      : "border-border text-ink-700 hover:border-ink-500/40"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="border border-border rounded-xl bg-surface-paper p-3.5">
              {method === PAYMENT_METHOD.CASH && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-ink-700 mb-1 block">
                        Amount received
                      </label>
                      <input
                        type="number"
                        value={amountTendered}
                        onChange={(e) =>
                          setAmountTendered(
                            e.target.value === "" ? "" : Number(e.target.value),
                          )
                        }
                        className="w-full h-9 px-2.5 border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-700 mb-1 block">
                        Collected by
                      </label>
                      <div className="h-9 px-2.5 flex items-center border border-border rounded-lg text-sm bg-surface-canvas text-ink-700 truncate">
                        {collectedByName || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-baseline mt-3 px-3 py-2.5 rounded-lg bg-status-open-soft border border-status-open/20">
                    <span className="text-xs text-status-open">
                      Change to return
                    </span>
                    <span className="font-mono text-base font-semibold text-status-open">
                      {money(change)}
                    </span>
                  </div>
                </>
              )}

              {method === PAYMENT_METHOD.UPI && (
                <div className="flex gap-3.5">
                  <div className="w-28 h-28 shrink-0 border border-border rounded-lg p-2 bg-white">
                    <PlaceholderQr seed={total || 1} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-bold text-ink-900">
                      {money(total)}
                    </div>
                    <div className="text-[10.5px] text-status-open bg-status-open-soft rounded px-1.5 py-0.5 inline-block mt-1 mb-2">
                      Amount encoded — patient can't underpay
                    </div>
                    <label className="text-xs font-semibold text-ink-700 mb-1 block">
                      UPI reference (UTR)
                    </label>
                    <input
                      type="text"
                      value={upiReference}
                      onChange={(e) => setUpiReference(e.target.value)}
                      placeholder="Last 6 digits from the patient's app"
                      className="w-full h-9 px-2.5 border border-border rounded-lg text-sm font-mono"
                    />
                    <p className="text-[11px] text-ink-500 mt-1">
                      Optional, but it is the only way to trace a disputed
                      payment.
                    </p>
                  </div>
                </div>
              )}
              {method === PAYMENT_METHOD.UPI && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-status-warning-soft border border-status-warning/20 text-[11.5px] text-status-warning">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    <b>UPI does not confirm itself.</b> Check the merchant app
                    or the bank SMS before you mark it paid.
                  </span>
                </div>
              )}

              {method === PAYMENT_METHOD.SPLIT && (
                <div>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <label className="text-xs font-semibold text-ink-700 w-14">
                      Cash
                    </label>
                    <input
                      type="number"
                      value={splitCash}
                      onChange={(e) =>
                        setSplitCash(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      className="flex-1 h-9 px-2.5 border border-border rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <label className="text-xs font-semibold text-ink-700 w-14">
                      UPI
                    </label>
                    <input
                      type="number"
                      value={splitUpiAmount}
                      readOnly
                      className="flex-1 h-9 px-2.5 border border-border rounded-lg text-sm bg-surface-canvas"
                    />
                  </div>
                  <p className="text-xs text-ink-500">
                    {splitCashAmount + splitUpiAmount === total
                      ? `Adds up to ${money(total)}`
                      : `Does not add up to ${money(total)}`}
                  </p>
                </div>
              )}

              {method === PAYMENT_METHOD.DUE && (
                <div>
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-status-danger-soft border border-status-danger/20 text-[13px] text-status-danger mb-3">
                    <b>{money(total)} will be recorded as unpaid.</b>
                  </div>
                  <label className="text-xs font-semibold text-ink-700 mb-1 block">
                    Reason
                  </label>
                  <select
                    value={dueReason}
                    onChange={(e) => setDueReason(e.target.value)}
                    className="w-full h-9 px-2.5 border border-border rounded-lg text-sm"
                  >
                    {PAYMENT_DUE_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}
