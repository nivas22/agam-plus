export function QueueBoardMock() {
  return (
    <div className="mockcard">
      <div className="mq-head">
        <div>
          <div className="mq-title">Today&apos;s queue</div>
          <div className="mq-sub">Friday, 21 August · City Hospital</div>
        </div>
        <span className="mq-live">Live · updated just now</span>
      </div>
      <div className="mq-stats">
        <div className="mq-stat">
          <div className="k">Waiting</div>
          <div className="v">6</div>
        </div>
        <div className="mq-stat">
          <div className="k">In consultation</div>
          <div className="v">2</div>
        </div>
        <div className="mq-stat">
          <div className="k">Done</div>
          <div className="v">9</div>
        </div>
        <div className="mq-stat">
          <div className="k">Yet to arrive</div>
          <div className="v">5</div>
        </div>
        <div className="mq-stat stop">
          <div className="k">Overdue</div>
          <div className="v">1</div>
        </div>
        <div className="mq-stat warn">
          <div className="k">Avg wait</div>
          <div className="v">18m</div>
        </div>
        <div className="mq-stat stop">
          <div className="k">Longest wait</div>
          <div className="v">28m</div>
        </div>
      </div>
      <div className="mq-cols">
        <div className="mq-col">
          <div className="mq-doc">
            <span>Dr. Arun Prakash</span>
            <span className="status">25 min behind</span>
          </div>
          <div className="mq-label">In consultation</div>
          <div className="mq-patient">
            <div className="nm">Fathima Abdul</div>
            <div className="meta">34 F · started 11:12</div>
          </div>
          <div className="mq-label">Waiting · 2</div>
          <div className="mq-patient due">
            <div className="nm">Anand Venkat</div>
            <div className="meta">28m waiting · ₹1,100 due</div>
          </div>
          <div className="mq-patient">
            <div className="nm">Priya Selvam</div>
            <div className="meta">15m waiting · penicillin allergy</div>
          </div>
        </div>
        <div className="mq-col">
          <div className="mq-doc">
            <span>Dr. Kavitha Sundaram</span>
            <span className="status ok">On time</span>
          </div>
          <div className="mq-label">In consultation</div>
          <div className="mq-patient">
            <div className="nm">Divya Menon</div>
            <div className="meta">31 F · started 11:16</div>
          </div>
          <div className="mq-label">Waiting · 1</div>
          <div className="mq-patient">
            <div className="nm">Sangeetha R</div>
            <div className="meta">6m waiting · first visit</div>
          </div>
        </div>
        <div className="mq-col">
          <div className="mq-doc">
            <span>Priya Narayanan</span>
            <span className="status ok">Free now</span>
          </div>
          <div className="mq-label">Nobody waiting</div>
          <div className="mq-patient">
            <div className="nm">Room free for 25 minutes</div>
            <div className="meta">Good slot for a walk-in</div>
          </div>
          <div className="mq-label">Yet to arrive</div>
          <div className="mq-patient">
            <div className="nm">Lakshmi Vasan</div>
            <div className="meta">booked 11:45 · package 3/5</div>
          </div>
        </div>
        <div className="mq-col mq-side">
          <div className="card">
            <div className="t">Needs a decision · 1</div>
            Lakshmi Vasan — 50 min late, two calls, no answer
          </div>
          <div className="card">
            <div className="t">Waiting for any doctor · 1</div>
            Karthik R — fever, no doctor chosen yet
          </div>
          <div className="card">
            <div className="t">Evening session</div>
            Dr. Ramesh Iyer, 6:00 pm · 9 booked
          </div>
        </div>
      </div>
    </div>
  );
}

export function PatientCardMock() {
  return (
    <div className="mockcard mpc">
      <div className="name">
        <span>Anand Venkat</span>
        <span>#12</span>
      </div>
      <div className="waiting-k">Waiting since 10:52</div>
      <div className="waiting">28m</div>
      <span className="due-tag">₹1,100 due from last visit</span>
      <div className="row">
        <span>Dr. Arun Prakash</span>
        <span>Room 2 · General Medicine</span>
      </div>
    </div>
  );
}

export function PaymentMock() {
  return (
    <div className="mockcard mpay">
      <div className="hd">
        <span>Complete visit — Fathima Abdul</span>
        <span>INV-2626</span>
      </div>
      <div className="row">
        <span>Consultation — Dr. Arun Prakash</span>
        <span>₹500</span>
      </div>
      <div className="row">
        <span>Inj. Tetanus toxoid</span>
        <span>₹250</span>
      </div>
      <div className="row">
        <span>Discount</span>
        <span>−₹0</span>
      </div>
      <div className="total">
        <span>Total payable</span>
        <span>₹750</span>
      </div>
      <div className="methods">
        <div className="method active">Cash</div>
        <div className="method">UPI / GPay</div>
        <div className="method">Split</div>
        <div className="method">Pay later</div>
      </div>
      <div className="confirm">Collect ₹750 &amp; complete</div>
    </div>
  );
}

export function DoctorPhonesMock() {
  return (
    <div className="mockcard mphones">
      <div className="mphone">
        <div className="bar">Prescription</div>
        <div className="body">
          <div className="pill">Anand Venkat</div>
          <div className="pill">Etoricoxib 60 mg</div>
          <div className="pill">1–0–1, after food</div>
        </div>
      </div>
      <div className="mphone">
        <div className="bar">Allergy check</div>
        <div className="body">
          <div className="alert">Don&apos;t give this to Anand</div>
          <div className="pill">Amoxicillin blocked</div>
          <div className="pill">Penicillin allergy on file</div>
        </div>
      </div>
      <div className="mphone">
        <div className="bar">Ready to issue</div>
        <div className="body">
          <div className="pill">Etoricoxib 60 mg — 5 days</div>
          <div className="pill">Paracetamol 500 mg</div>
          <div className="pill ta">தமிழில் அறிவுரைகள்</div>
          <div className="go">Sign &amp; send to Anand</div>
        </div>
      </div>
    </div>
  );
}

export function WaitingRoomTvMock() {
  return (
    <div className="mockcard mtv">
      <div className="hd">
        <span>City Hospital</span>
        <span>11:20 am</span>
      </div>
      <div className="cols">
        <div className="col">
          <div className="doc">Dr. Arun Prakash</div>
          <div className="num">11</div>
          <div className="doc">−25 min</div>
        </div>
        <div className="col">
          <div className="doc">Dr. Kavitha S.</div>
          <div className="num">08</div>
          <div className="doc">On time</div>
        </div>
        <div className="col off">
          <div className="doc">Dr. Ramesh Iyer</div>
          <div className="num">Not available today</div>
        </div>
      </div>
    </div>
  );
}
