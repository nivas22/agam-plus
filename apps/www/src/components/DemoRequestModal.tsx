"use client";

import { useEffect, useState } from "react";

// Mirrors apps/web/src/lib/api.ts's API_BASE_URL convention — this is a
// separate Next.js app (apps/www) so it needs its own NEXT_PUBLIC_AGAM_API_URL
// set in its deployment environment, pointing at the same backend.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_AGAM_API_URL || "http://localhost:3001";

type Status = "form" | "submitting" | "success" | "error";

export function DemoRequestModal({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("form");
  const [contactName, setContactName] = useState("");

  function close() {
    setOpen(false);
    setStatus("form");
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setStatus("form");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("contactName") || "");
    setContactName(name);
    setStatus("submitting");

    const doctorCountRaw = form.get("doctorCount");

    try {
      const res = await fetch(`${API_BASE_URL}/demo-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalName: form.get("hospitalName"),
          contactName: name,
          phone: form.get("phone"),
          email: form.get("email") || undefined,
          city: form.get("city") || undefined,
          doctorCount: doctorCountRaw ? Number(doctorCountRaw) : undefined,
          message: form.get("message") || undefined,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button className={className} onClick={() => setOpen(true)} type="button">
        {label}
      </button>
      {open && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click is a supplementary close affordance — Escape (above) and the visible close button already cover keyboard access.
        // biome-ignore lint/a11y/useKeyWithClickEvents: see above.
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="modal-box" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              onClick={close}
              aria-label="Close"
              type="button"
            >
              ✕
            </button>

            {status === "success" ? (
              <div className="modal-success">
                <div className="modal-success-ic">✓</div>
                <h3>Thanks{contactName ? `, ${contactName}` : ""}!</h3>
                <p>
                  We&apos;ve got your details. Our team will reach out within 24
                  hours to set up your demo.
                </p>
                <button className="btn p" onClick={close} type="button">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3 className="modal-title">Book a demo</h3>
                <p className="modal-sub">
                  Tell us a bit about your clinic — we&apos;ll reach out within
                  24 hours to set up a time.
                </p>

                <div className="field">
                  <label htmlFor="hospitalName">Clinic / hospital name</label>
                  <input
                    id="hospitalName"
                    name="hospitalName"
                    required
                    placeholder="e.g. City Hospital"
                  />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="contactName">Your name</label>
                    <input id="contactName" name="contactName" required />
                  </div>
                  <div className="field">
                    <label htmlFor="phone">Phone</label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      placeholder="+91"
                    />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="email">Email (optional)</label>
                    <input id="email" name="email" type="email" />
                  </div>
                  <div className="field">
                    <label htmlFor="doctorCount">Doctors (optional)</label>
                    <input
                      id="doctorCount"
                      name="doctorCount"
                      type="number"
                      min={1}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="city">City (optional)</label>
                  <input id="city" name="city" />
                </div>
                <div className="field">
                  <label htmlFor="message">Anything else? (optional)</label>
                  <textarea id="message" name="message" rows={3} />
                </div>

                {status === "error" && (
                  <p className="modal-error">
                    Something went wrong sending that — please try again, or
                    call us directly.
                  </p>
                )}

                <button
                  className="btn p"
                  style={{ width: "100%" }}
                  type="submit"
                  disabled={status === "submitting"}
                >
                  {status === "submitting" ? "Sending…" : "Request a demo"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
