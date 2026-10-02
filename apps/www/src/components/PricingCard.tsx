"use client";

import { useState } from "react";
import { DemoRequestModal } from "./DemoRequestModal";

// Mirrors the live billing model in apps/api/src/constants.ts
// (SUBSCRIPTION_BASE_PRICE / SUBSCRIPTION_DOCTOR_ADDON_PRICE /
// SUBSCRIPTION_STAFF_ADDON_PRICE, and SUBSCRIPTION_INCLUDED_DOCTORS/STAFF).
// The real numbers are platform-admin editable (subscription-plan-config) —
// if they're changed there, update these display values to match.
const PRICING = {
  includedDoctors: 5,
  includedStaff: 1,
  base: { monthly: 799, annual: 7990 },
  doctorAddon: { monthly: 299, annual: 2990 },
  staffAddon: { monthly: 149, annual: 1490 },
};

const FEATURES = [
  "Queue, bookings and walk-ins",
  "Payments, dues and day close",
  "Prescriptions with allergy checks",
  "WhatsApp reminders and receipts",
  "Prepaid packages and series booking",
  "Waiting-room TV board",
  "Reports — collections, dues aging, no-shows",
  "Roles, approvals and the audit trail",
];

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function PricingCard() {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const unit = cycle === "monthly" ? "/ month" : "/ year";
  const savingsPct = Math.round(
    (1 - PRICING.base.annual / (PRICING.base.monthly * 12)) * 100,
  );

  return (
    <>
      <div className="price-toggle">
        <button
          className={cycle === "monthly" ? "active" : ""}
          onClick={() => setCycle("monthly")}
          type="button"
        >
          Monthly
        </button>
        <button
          className={cycle === "annual" ? "active" : ""}
          onClick={() => setCycle("annual")}
          type="button"
        >
          Annual <span className="save">Save {savingsPct}%</span>
        </button>
      </div>

      <div className="pricewrap">
        <div className="plan plan-base">
          <div className="nm">Agam Plus</div>
          <div className="who">One hospital or clinic location</div>
          <div className="pr">
            <b>{formatInr(PRICING.base[cycle])}</b>
            <span>{unit}</span>
          </div>
          <div className="included">
            Includes {PRICING.includedDoctors} doctors and{" "}
            {PRICING.includedStaff} front-desk/staff account
          </div>
          <ul>
            {FEATURES.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <div className="addons">
            <div className="addon-row">
              <span>Extra doctor</span>
              <b>
                +{formatInr(PRICING.doctorAddon[cycle])} {unit}
              </b>
            </div>
            <div className="addon-row">
              <span>Extra staff account</span>
              <b>
                +{formatInr(PRICING.staffAddon[cycle])} {unit}
              </b>
            </div>
          </div>
          <DemoRequestModal label="Book a demo" className="btn p" />
        </div>

        <div className="plan-talk">
          <h4>Running several hospitals?</h4>
          <p>
            Multiple branches, data migration from your current system, on-site
            setup and a named support contact — we&apos;ll put together a plan
            and a price for your group.
          </p>
          <DemoRequestModal label="Talk to us" className="btn q" />
        </div>
      </div>
    </>
  );
}
