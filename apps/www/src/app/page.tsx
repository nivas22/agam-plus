import {
  DoctorPhonesMock,
  PatientCardMock,
  PaymentMock,
  QueueBoardMock,
  WaitingRoomTvMock,
} from "@/components/mocks";

function Logo({ dark }: { dark?: boolean }) {
  return (
    <a className="logo">
      <svg width="34" height="34" viewBox="0 0 64 64" fill="none">
        {dark ? (
          <rect width="64" height="64" rx="18" fill="#fff" fillOpacity=".14" />
        ) : (
          <>
            <defs>
              <linearGradient id="n1" x1="0" y1="0" x2="64" y2="64">
                <stop stopColor="#5B4BDB" />
                <stop offset="1" stopColor="#9A3FD0" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="18" fill="url(#n1)" />
          </>
        )}
        <circle cx="32" cy="32" r="16" stroke="#fff" strokeWidth="5.5" />
        <rect x="29.75" y="23" width="4.5" height="18" rx="2.25" fill="#fff" />
        <rect x="23" y="29.75" width="18" height="4.5" rx="2.25" fill="#fff" />
      </svg>
      <span className="wm" style={dark ? { color: "#fff" } : undefined}>
        Agam
        <span style={dark ? { color: "rgba(255,255,255,.6)" } : undefined}>
          Plus
        </span>
      </span>
    </a>
  );
}

const PROBLEMS = [
  {
    q: "“A walk-in came at 10:40 and now the 11 o'clock patient is waiting 40 minutes.”",
    body: "Most systems treat a booking as sacred and a walk-in as an afterthought — so the desk starts booking fake appointments to squeeze people in, and the schedule stops meaning anything.",
    tag: "We hold slots back for walk-ins",
    cls: "t-a",
  },
  {
    q: "“The patient left without paying and nobody noticed until month end.”",
    body: "Unpaid visits sit in a register nobody reads. By the time anyone looks, the bill is six weeks old and the patient has moved on.",
    tag: "Dues age on the dashboard, daily",
    cls: "t-b",
  },
  {
    q: "“The drawer is ₹400 short and nobody can say who took what.”",
    body: "Shared logins mean every refund, discount and cash payment belongs to “admin”. There's no way to ask a useful question afterwards.",
    tag: "Every rupee carries a name",
    cls: "t-c",
  },
];

const ROLES = [
  {
    icon: "◉",
    bg: "var(--brandSoft)",
    fg: "var(--brand)",
    title: "Owner & admin",
    body: "Opens one page in the morning and knows what needs a decision.",
    items: ["Collections and dues", "Doctor utilisation", "Approves refunds", "Roles and audit trail"],
  },
  {
    icon: "☺",
    bg: "var(--flagSoft)",
    fg: "var(--flag)",
    title: "Front desk",
    body: "Books, checks in, collects, and closes the day. Can't quietly refund.",
    items: ["Queue and walk-ins", "Payments and receipts", "Package sales", "Reschedules"],
  },
  {
    icon: "✚",
    bg: "var(--clinicSoft)",
    fg: "var(--clinicInk)",
    title: "Doctor",
    body: "Their day, their patients, their notes. On a laptop or a phone.",
    items: ["Today's list", "Notes and prescriptions", "Own hours and leave", "No money screens"],
  },
  {
    icon: "◆",
    bg: "var(--packSoft)",
    fg: "var(--pack)",
    title: "Patient",
    body: "Books, pays, and sees their place in the queue without phoning.",
    items: ["Live token position", "Prescriptions and receipts", "Pay dues by UPI", "Package balance"],
  },
];

const PLANS = [
  {
    name: "Clinic",
    who: "1–3 doctors, single location",
    price: "₹1,499",
    unit: "/ doctor / month",
    features: [
      "Queue, bookings and walk-ins",
      "Payments, dues and day close",
      "Prescriptions with allergy checks",
      "WhatsApp reminders and receipts",
      "Unlimited front-desk accounts",
    ],
    cta: "Start a trial",
    best: false,
  },
  {
    name: "Hospital",
    who: "4–20 doctors, one or more branches",
    price: "₹1,199",
    unit: "/ doctor / month",
    features: [
      "Everything in Clinic",
      "Prepaid packages and series booking",
      "Waiting-room TV board",
      "Reports — collections, dues aging, no-shows",
      "Roles, approvals and the audit trail",
      "Multi-hospital switching",
    ],
    cta: "Book a demo",
    best: true,
  },
  {
    name: "Group",
    who: "20+ doctors, several branches",
    price: "Let's talk",
    unit: "",
    features: [
      "Everything in Hospital",
      "Data migration from your current system",
      "On-site setup and staff training",
      "Named support contact",
      "Custom reports and exports",
    ],
    cta: "Talk to us",
    best: false,
  },
];

const TRUST = [
  {
    icon: "✎",
    title: "Everything is signed",
    body: "Who collected the cash, who approved the refund, who changed the fee — with before and after values. Entries can't be edited or deleted by anyone, including the owner.",
  },
  {
    icon: "◍",
    title: "Roles, not one shared login",
    body: "Front desk collects but can't refund alone. Clinical notes stay with doctors. Money leaving the building always needs two people.",
  },
  {
    icon: "⌂",
    title: "Your data stays in India",
    body: "Hosted in Mumbai, encrypted at rest, daily backups. Built to the DPDP Act — patient names never appear on the waiting-room screen unless you choose it.",
  },
];

const FAQ = [
  {
    q: "Our desk staff don't have email addresses. Can they still use it?",
    a: "Yes. Front desk and nursing staff sign in with a username and password, or a phone number and a code on WhatsApp. Email is only needed for admins and doctors, who sign in with Google.",
  },
  {
    q: "Most of our patients just walk in. Is this only for appointments?",
    a: "No — walk-ins are a first-class case. You can hold slots back for them so they aren't squeezed between booked patients, and the desk is warned before adding someone who would push the doctor past closing time.",
  },
  {
    q: "What happens when a doctor doesn't turn up?",
    a: "The desk marks them absent with a reason, and the system walks through every appointment that day — move to the next working day, offer another doctor, or cancel and notify. Package visits get their credit back automatically.",
  },
  {
    q: "Do we have to stop using our current billing software?",
    a: "Not on day one. Plenty of clinics run the queue and prescriptions here first, then move billing across once the desk is comfortable. We'll import your open dues when you're ready.",
  },
  {
    q: "How long does setup take?",
    a: "A morning for a single clinic — doctors, hours, fees and staff accounts. We do it with you on a call rather than handing you a manual.",
  },
];

export default function HomePage() {
  return (
    <div className="site">
      <div className="nav">
        <div className="in">
          <Logo />
          <div className="links">
            <a>How it works</a>
            <a>For doctors</a>
            <a>Pricing</a>
            <a>Security</a>
            <a>Help</a>
          </div>
          <span className="sp" />
          <a style={{ fontSize: 14, color: "var(--ink2)", fontWeight: 500 }}>
            Sign in
          </a>
          <a className="btn p sm">Book a demo</a>
        </div>
      </div>

      <div className="hero">
        <div className="wrap in">
          <div className="eyebrow">Built for Indian OPD</div>
          <h1 className="h1">
            Your front desk already knows who&apos;s waiting.{" "}
            <em>Now the rest of the hospital does too.</em>
          </h1>
          <p className="lede">
            Bookings, walk-ins, doctor availability, payments and
            prescriptions — one system, so the desk stops keeping a parallel
            diary on paper.
          </p>
          <div className="cta">
            <a className="btn p">Book a 20-minute demo</a>
            <a className="btn q">See the screens</a>
            <span className="note">
              No card. We set up your doctors and hours with you.
            </span>
          </div>
          <div className="chipsrow">
            <span className="chip">
              Works with <b>walk-ins</b>, not against them
            </span>
            <span className="chip">
              Cash, <b>UPI</b> and prepaid packages
            </span>
            <span className="chip">WhatsApp reminders and receipts</span>
            <span className="chip">
              <b className="ta">தமிழ்</b> for patients
            </span>
          </div>
          <div className="heroshot">
            <QueueBoardMock />
          </div>
        </div>
      </div>

      <div className="band">
        <div className="wrap">
          <div className="eyebrow">Why clinics call us</div>
          <h2 style={{ marginTop: 12, maxWidth: 720 }}>
            Three things go wrong in every OPD, and software usually makes
            two of them worse.
          </h2>
          <div className="probs">
            {PROBLEMS.map((p) => (
              <div className="prob" key={p.q}>
                <div className="q">{p.q}</div>
                <p>{p.body}</p>
                <span className={`tag ${p.cls}`}>{p.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="feat">
          <div className="txt">
            <div className="eyebrow">The queue</div>
            <h2 style={{ marginTop: 12, fontSize: 34 }}>
              One board the desk can read from across the room.
            </h2>
            <p className="lede" style={{ fontSize: 15.5 }}>
              Who&apos;s with the doctor, who&apos;s waiting and for how
              long, who hasn&apos;t turned up. Bookings and walk-ins in one
              queue, called in the order they were actually ready.
            </p>
            <ul className="bul">
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>Wait timers that count from arrival</b>, not from the
                  booked time
                </span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>Running 25 min behind</b> on the doctor&apos;s header —
                  the answer to every question the desk gets asked
                </span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>Unpaid, allergy and package flags</b> on the card,
                  before the patient goes in
                </span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>
                  Session capacity, so the desk knows when a walk-in will
                  push the doctor past closing
                </span>
              </li>
            </ul>
          </div>
          <div className="shot">
            <PatientCardMock />
          </div>
        </div>

        <div className="feat rev">
          <div className="txt">
            <div className="eyebrow">Money</div>
            <h2 style={{ marginTop: 12, fontSize: 34 }}>
              Take the payment while the patient is still at the desk.
            </h2>
            <p className="lede" style={{ fontSize: 15.5 }}>
              The consultation fee fills itself in. Add the injection or
              dressing that was given. Cash, UPI, split, or recorded as a due
              — then the day closes with the drawer counted.
            </p>
            <ul className="bul">
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>Cash change calculated</b>, UPI QR with the amount
                  already in it
                </span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>Refunds need a second person</b> — the desk raises it,
                  an admin approves it
                </span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>Day close</b> compares the drawer against what should
                  be in it
                </span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>
                  Prepaid packages — sell 10 visits, redeem them one at a
                  time, track what you still owe
                </span>
              </li>
            </ul>
          </div>
          <div className="shot">
            <PaymentMock />
          </div>
        </div>

        <div className="feat">
          <div className="txt">
            <div className="eyebrow">For the doctor</div>
            <h2 style={{ marginTop: 12, fontSize: 34 }}>
              Ten seconds of context before you call them in.
            </h2>
            <p className="lede" style={{ fontSize: 15.5 }}>
              Allergies, the last visit&apos;s notes in full, what
              they&apos;re already on. Then notes by dictation, a
              prescription signed and sent on WhatsApp, and the next patient
              — without touching the mouse.
            </p>
            <ul className="bul">
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>Allergy checks that interrupt</b> — amoxicillin against
                  a penicillin allergy is blocked, with alternatives
                </span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>Dosing in taps</b> — 1–0–1, after food, 5 days. The
                  quantity works itself out
                </span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>Patient instructions in Tamil</b>, printed alongside the
                  English
                </span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>Nothing on the doctor&apos;s screen handles cash</span>
              </li>
            </ul>
          </div>
          <div className="shot">
            <DoctorPhonesMock />
          </div>
        </div>
      </div>

      <div className="band soft">
        <div className="wrap">
          <div className="eyebrow">Who uses it</div>
          <h2 style={{ marginTop: 12, maxWidth: 680 }}>
            Four people, four different screens, one set of records.
          </h2>
          <div className="roles">
            {ROLES.map((r) => (
              <div className="role" key={r.title}>
                <div
                  className="ic"
                  style={{ background: r.bg, color: r.fg }}
                >
                  {r.icon}
                </div>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
                <ul>
                  {r.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="band dark">
        <div className="wrap">
          <div className="two">
            <div>
              <div className="eyebrow" style={{ color: "#a99cf5" }}>
                The waiting room
              </div>
              <h2 style={{ marginTop: 12, fontSize: 36 }}>
                Stop the desk being asked &quot;how long?&quot; fifty times a
                day.
              </h2>
              <p className="lede">
                A board on the waiting-room TV shows who&apos;s being seen
                now. A QR on it opens the patient&apos;s own token on their
                phone, with the honest answer: the doctor is running 25
                minutes behind, don&apos;t come before 11:35.
              </p>
              <div className="statline">
                <div>
                  <div className="v mono">—</div>
                  <div className="k">
                    No patient names on the wall by default
                  </div>
                </div>
                <div>
                  <div className="v mono">₹3,000</div>
                  <div className="k">
                    A Fire Stick and any TV you already own
                  </div>
                </div>
              </div>
            </div>
            <div className="tvshot">
              <WaitingRoomTvMock />
            </div>
          </div>
        </div>
      </div>

      <div className="band">
        <div className="wrap">
          <div className="eyebrow">Pricing</div>
          <h2 style={{ marginTop: 12 }}>Priced per doctor, not per screen.</h2>
          <p className="lede">
            Every plan includes the front desk, the queue board, payments and
            the patient app. Add as many desk staff as you need — they&apos;re
            free.
          </p>

          <div className="plans">
            {PLANS.map((plan) => (
              <div className={`plan ${plan.best ? "best" : ""}`} key={plan.name}>
                {plan.best && (
                  <span className="best-tag">MOST CLINICS PICK THIS</span>
                )}
                <div className="nm">{plan.name}</div>
                <div className="who">{plan.who}</div>
                <div className="pr">
                  {plan.price} {plan.unit && <small>{plan.unit}</small>}
                </div>
                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a className={`btn ${plan.best ? "p" : "q"}`}>{plan.cta}</a>
              </div>
            ))}
          </div>
          <p className="pricenote">
            Billed yearly. GST extra. Switching from paper or another system?
            We&apos;ll bring your doctors, patients and open dues across
            before you go live.
          </p>
        </div>
      </div>

      <div className="band soft">
        <div className="wrap">
          <div className="eyebrow">Security</div>
          <h2 style={{ marginTop: 12, maxWidth: 660 }}>
            A hospital system is only as good as the questions you can ask
            it afterwards.
          </h2>
          <div className="trust">
            {TRUST.map((t) => (
              <div className="tcard" key={t.title}>
                <span className="ic">{t.icon}</span>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="band">
        <div className="wrap">
          <div className="eyebrow">Questions</div>
          <h2 style={{ marginTop: 12 }}>The ones we get asked on every demo.</h2>
          <div className="faq">
            {FAQ.map((item) => (
              <div className="qa" key={item.q}>
                <div className="q">{item.q}</div>
                <div className="a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="final">
        <div className="wrap">
          <h2>See it running on your own doctors&apos; hours.</h2>
          <p>
            Twenty minutes, your schedule, your fees. If it doesn&apos;t fit
            how your OPD actually runs, we&apos;ll tell you.
          </p>
          <div className="cta">
            <a className="btn w">Book a demo</a>
            <a className="btn g">Call +91 44 2345 6789</a>
          </div>
        </div>
      </div>

      <div className="foot">
        <div className="wrap">
          <div className="fgrid">
            <div>
              <Logo dark />
              <p className="about">
                Hospital operations software, built in Chennai for the way
                Indian OPD actually runs.{" "}
                <span className="ta">அகம் — உள்ளிருந்து.</span>
              </p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li>Queue &amp; check-in</li>
                <li>Payments</li>
                <li>Prescriptions</li>
                <li>Packages</li>
                <li>Reports</li>
                <li>Waiting-room TV</li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li>About</li>
                <li>Pricing</li>
                <li>Security</li>
                <li>Careers</li>
                <li>Contact</li>
              </ul>
            </div>
            <div>
              <h4>Support</h4>
              <ul>
                <li>Help centre</li>
                <li>Setup guide</li>
                <li>Status</li>
                <li>WhatsApp us</li>
              </ul>
            </div>
          </div>
          <div className="fbot">
            <span>© 2026 Agam Plus Technologies Pvt Ltd</span>
            <span className="sp" />
            <span>Terms</span>
            <span>Privacy</span>
            <span>DPDP compliance</span>
          </div>
        </div>
      </div>
    </div>
  );
}
