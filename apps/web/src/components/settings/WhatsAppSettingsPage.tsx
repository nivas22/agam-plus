// components/settings/WhatsAppSettingsPage.tsx
"use client";

import { AlertTriangle, CheckCircle2, MessageCircle } from "lucide-react";
import { useState } from "react";
import {
  useConnectWhatsapp,
  useDisconnectWhatsapp,
  useSetWhatsappEnabled,
  useWhatsappStatus,
} from "@/hooks/useWhatsappApi";
import type { ConnectWhatsappData } from "@/types/whatsapp";

interface WhatsAppSettingsPageProps {
  hospitalId: string;
}

const EMPTY_FORM: ConnectWhatsappData = {
  phoneNumberId: "",
  wabaId: "",
  accessToken: "",
};

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function WhatsAppSettingsPage({
  hospitalId,
}: WhatsAppSettingsPageProps) {
  const { data: status, isLoading } = useWhatsappStatus(hospitalId);
  const connect = useConnectWhatsapp(hospitalId);
  const disconnect = useDisconnectWhatsapp(hospitalId);
  const setEnabled = useSetWhatsappEnabled(hospitalId);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ConnectWhatsappData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const assigned = status?.assigned ?? false;
  const connected = status?.connected ?? false;

  const setField = (key: keyof ConnectWhatsappData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
      return false;
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(
      () => connect.mutateAsync(form),
      "Could not connect WhatsApp",
    );
    if (ok) {
      setForm(EMPTY_FORM);
      setShowForm(false);
    }
  };

  const handleToggle = () => {
    if (
      connected &&
      !window.confirm(
        "Turn WhatsApp off? Patients will no longer be able to book or send enquiries through it.",
      )
    ) {
      return;
    }
    run(() => setEnabled.mutateAsync(!connected), "Could not update WhatsApp");
  };

  const handleDisconnect = () => {
    if (
      !window.confirm(
        "Disconnect WhatsApp? Your saved credentials will be removed and you will need to enter them again to reconnect.",
      )
    ) {
      return;
    }
    run(() => disconnect.mutateAsync(), "Could not disconnect WhatsApp");
  };

  const canSubmit =
    form.phoneNumberId.trim() &&
    form.wabaId.trim() &&
    form.accessToken.trim() &&
    !connect.isPending;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">
          WhatsApp
        </h1>
        <p className="text-sm text-ink-500 mt-0.5">
          Connect your WhatsApp Business account so patients can book
          appointments and send enquiries. Bookings arrive as pending for your
          team to confirm.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-ink-500">Loading…</div>
      ) : (
        <div className="bg-surface-paper border border-border rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg grid place-items-center flex-none ${
                connected
                  ? "bg-status-open-soft text-status-open"
                  : "bg-brand-violet-soft text-brand-violet"
              }`}
            >
              {connected ? <CheckCircle2 size={20} /> : <MessageCircle size={20} />}
            </div>

            <div className="flex-1">
              {assigned ? (
                <>
                  <div className="text-sm font-bold text-ink-900">
                    {status?.businessPhoneNumber || status?.phoneNumberId}
                  </div>
                  <div className="text-xs text-ink-500 mt-1 leading-relaxed">
                    {connected ? "Active" : "Turned off"}
                    {status?.verifiedName ? ` · ${status.verifiedName}` : ""}
                    {connected && status?.connectedAt
                      ? ` · since ${formatDate(status.connectedAt)}`
                      : ""}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-bold text-ink-900">
                    Not connected
                  </div>
                  <div className="text-xs text-ink-500 mt-1 leading-relaxed">
                    Connect your WhatsApp Business account to switch this on.
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              {assigned && (
                <>
                  <button
                    type="button"
                    onClick={handleToggle}
                    disabled={setEnabled.isPending}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                      connected
                        ? "border border-border text-ink-700 hover:bg-surface-canvas"
                        : "bg-brand-violet text-white hover:opacity-90"
                    }`}
                  >
                    {setEnabled.isPending
                      ? "Saving…"
                      : connected
                        ? "Turn off"
                        : "Turn on"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={disconnect.isPending}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-ink-700 hover:bg-surface-canvas disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowForm((v) => !v);
                  setError(null);
                }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                  assigned
                    ? "border border-border text-ink-700 hover:bg-surface-canvas"
                    : "bg-brand-violet text-white hover:opacity-90"
                }`}
              >
                {assigned ? "Update credentials" : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 flex gap-2.5 items-start bg-status-danger-soft border border-status-danger/30 rounded-lg p-3 text-xs text-status-danger">
          <AlertTriangle size={16} className="flex-none mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleConnect}
          className="bg-surface-paper border border-border rounded-xl p-4 grid gap-3 sm:grid-cols-2"
        >
          <div className="sm:col-span-2 text-xs text-ink-500 leading-relaxed">
            From your Meta app dashboard, under WhatsApp → API Setup. Your
            access token is encrypted before it is stored and is never shown
            back to you.
          </div>
          <label className="text-xs font-semibold text-ink-700">
            Phone number ID
            <input
              value={form.phoneNumberId}
              onChange={(e) => setField("phoneNumberId", e.target.value)}
              className="mt-1 w-full text-sm font-normal border border-border rounded-lg px-2.5 py-1.5"
            />
          </label>
          <label className="text-xs font-semibold text-ink-700">
            WhatsApp Business Account ID
            <input
              value={form.wabaId}
              onChange={(e) => setField("wabaId", e.target.value)}
              className="mt-1 w-full text-sm font-normal border border-border rounded-lg px-2.5 py-1.5"
            />
          </label>
          <label className="text-xs font-semibold text-ink-700 sm:col-span-2">
            Access token
            <input
              type="password"
              value={form.accessToken}
              onChange={(e) => setField("accessToken", e.target.value)}
              className="mt-1 w-full text-sm font-normal border border-border rounded-lg px-2.5 py-1.5"
            />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-violet text-white hover:opacity-90 disabled:opacity-50"
            >
              {connect.isPending ? "Checking with WhatsApp…" : "Connect"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-ink-700 hover:bg-surface-canvas"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
