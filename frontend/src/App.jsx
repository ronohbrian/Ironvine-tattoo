import { useState, useEffect, useMemo } from "react";
import {
  Calendar, Clock, User, Users, Check, X, Plus, ChevronRight,
  ChevronLeft, PenTool, Phone, ArrowRight, Circle, Trash2, Loader2,
  Lock, LogOut, DollarSign, Download, KeyRound, AlertTriangle
} from "lucide-react";

/* ---------------------------------------------------------
   LIVE CONFIG
   Paste your deployed backend URL below to go live: real Stripe
   payments, server-side PIN auth, and a shared database instead of
   this preview's local demo storage. Leave blank to keep previewing
   in demo mode (bookings simulate instantly, no real charge).
--------------------------------------------------------- */

// In local Docker Compose this defaults to the backend container.
// When deploying for real, set VITE_API_BASE_URL as a build-time env var
// on your host (Railway, Vercel, etc.) instead of editing this file.
const API_BASE_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) || "http://localhost:8000";
const LIVE = Boolean(API_BASE_URL && API_BASE_URL.trim().length > 0);

async function api(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText || "Request failed";
    try {
      const j = await res.json();
      if (j && j.detail) detail = j.detail;
    } catch {
      // response wasn't JSON — keep the default detail
    }
    throw new Error(detail);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

function normalizeAppointment(a) {
  return {
    id: a.id,
    artistId: a.artist_id,
    clientName: a.client_name,
    clientPhone: a.client_phone,
    style: a.style,
    placement: a.placement,
    size: a.size,
    note: a.note,
    date: a.date,
    time: a.time,
    status: a.status,
    depositAmount: a.deposit_amount,
    depositPaid: a.deposit_paid,
    createdAt: a.created_at,
  };
}

/* ---------------------------------------------------------
   DATA
--------------------------------------------------------- */

const ACCENTS = ["accent-red", "accent-sage", "accent-ink"];

// Placeholder roster — matches the backend's seed data so demo mode and
// a freshly deployed backend look identical until you swap in real names.
const SEED_ARTISTS = [
  { id: "a1", name: "Artist 1", specialty: "Specialty TBD", tagline: "Add a real name, specialty, and tagline any time.", accent: "accent-sage", initials: "A1", pin: "1234" },
  { id: "a2", name: "Artist 2", specialty: "Specialty TBD", tagline: "Add a real name, specialty, and tagline any time.", accent: "accent-red", initials: "A2", pin: "2345" },
  { id: "a3", name: "Artist 3", specialty: "Specialty TBD", tagline: "Add a real name, specialty, and tagline any time.", accent: "accent-ink", initials: "A3", pin: "3456" },
  { id: "a4", name: "Artist 4", specialty: "Specialty TBD", tagline: "Add a real name, specialty, and tagline any time.", accent: "accent-sage", initials: "A4", pin: "4567" },
  { id: "a5", name: "Artist 5", specialty: "Specialty TBD", tagline: "Add a real name, specialty, and tagline any time.", accent: "accent-red", initials: "A5", pin: "5678" },
];

const DEFAULT_OWNER_PIN = "9999";
const DEFAULT_DEPOSIT = 50;
const SLOT_TIMES = ["10:00", "12:00", "14:00", "16:00"];
const SIZES = ["Small (2-3in)", "Medium (4-6in)", "Large (7in+)", "Full sleeve / back piece"];

function pad(n) { return n < 10 ? "0" + n : "" + n; }

function nextDays(n) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      dow: d.toLocaleDateString(undefined, { weekday: "short" }),
      day: d.getDate(),
      mon: d.toLocaleDateString(undefined, { month: "short" }),
    });
  }
  return out;
}

function ticketNumber(id) {
  const n = parseInt(String(id).replace(/\D/g, ""), 10) || 0;
  return "No. " + String(n % 1000).padStart(3, "0");
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function fmtMoney(n) {
  const v = Number(n) || 0;
  return "$" + v.toFixed(0);
}

/* ---------------------------------------------------------
   ICS EXPORT (demo mode only — the live backend generates these
   server-side at GET /appointments/:id/ics instead)
--------------------------------------------------------- */

function icsDate(dateISO, time) {
  const [h, m] = time.split(":");
  return dateISO.replace(/-/g, "") + "T" + pad(parseInt(h, 10)) + pad(parseInt(m, 10)) + "00";
}

function downloadICS(appt, artistName) {
  const [h, m] = appt.time.split(":");
  const endH = pad((parseInt(h, 10) + 2) % 24);
  const start = icsDate(appt.date, appt.time);
  const end = appt.date.replace(/-/g, "") + "T" + endH + pad(parseInt(m, 10)) + "00";
  const uid = appt.id + "@ironvine-tattoo";
  const desc = `Tattoo session with ${artistName}. Piece: ${appt.style}. Placement: ${appt.placement || "TBD"}. Deposit: ${fmtMoney(appt.depositAmount)} (${appt.depositPaid ? "paid" : "unpaid"}).`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ironvine Tattoo//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Tattoo — ${appt.clientName} with ${artistName}`,
    `DESCRIPTION:${desc.replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tattoo-${appt.date}-${appt.time.replace(":", "")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------
   STORAGE (demo mode only)
--------------------------------------------------------- */

async function loadShared(key, fallback) {
  try {
    const res = await window.storage.get(key, true);
    return res ? JSON.parse(res.value) : fallback;
  } catch {
    return fallback;
  }
}
async function saveShared(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
  } catch {
    // best-effort; UI state still updates locally
  }
}

/* ---------------------------------------------------------
   SMALL PIECES
--------------------------------------------------------- */

function Stamp({ text }) {
  return <div className="stamp">{text}</div>;
}

function CalendarBtn({ appt, artistName }) {
  function go() {
    if (LIVE) {
      window.open(`${API_BASE_URL}/appointments/${appt.id}/ics`, "_blank");
    } else {
      downloadICS(appt, artistName);
    }
  }
  return (
    <button className="btn btn-tiny" onClick={go} title="Download calendar file">
      <Download size={12} /> .ics
    </button>
  );
}

function TicketStub({ appt, artist }) {
  return (
    <div className="ticket">
      <div className="ticket-punch left" />
      <div className="ticket-punch right" />
      <div className="ticket-num">{ticketNumber(appt.id)}</div>
      <div className="ticket-body">
        <div className="ticket-row"><span>Artist</span><strong>{artist?.name}</strong></div>
        <div className="ticket-row"><span>Date</span><strong>{fmtDate(appt.date)}</strong></div>
        <div className="ticket-row"><span>Time</span><strong>{appt.time}</strong></div>
        <div className="ticket-row"><span>Piece</span><strong>{appt.style}</strong></div>
        <div className="ticket-row"><span>Deposit</span><strong>{fmtMoney(appt.depositAmount)}{appt.depositPaid ? " · paid" : ""}</strong></div>
      </div>
      <Stamp text={appt.depositPaid ? "paid" : appt.status === "confirmed" ? "confirmed" : "requested"} />
    </div>
  );
}

function DepositBadge({ appt, onToggle, onAmountChange, editable }) {
  return (
    <div className={`deposit-badge ${appt.depositPaid ? "is-paid" : "is-unpaid"}`}>
      <DollarSign size={11} />
      {editable ? (
        <input
          className="deposit-input"
          type="number"
          min="0"
          value={appt.depositAmount}
          onChange={e => onAmountChange(Number(e.target.value))}
        />
      ) : (
        <span>{fmtMoney(appt.depositAmount)}</span>
      )}
      <button className="deposit-toggle" onClick={onToggle}>
        {appt.depositPaid ? "paid" : "unpaid"}
      </button>
    </div>
  );
}

function EmptyState({ label }) {
  return <div className="empty">{label}</div>;
}

/* ---------------------------------------------------------
   AUTH GATE
--------------------------------------------------------- */

function AuthGate({ kind, artists, onCancel, onAttempt }) {
  const [pickedArtistId, setPickedArtistId] = useState(artists[0]?.id || null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const errMsg = await onAttempt(pin, kind === "artist" ? pickedArtistId : null);
    setBusy(false);
    if (errMsg) {
      setError(errMsg);
      setPin("");
    }
  }

  return (
    <div className="stack center">
      <div className="lock-icon"><Lock size={20} /></div>
      <h2 className="h2">{kind === "owner" ? "Owner access" : "Artist access"}</h2>
      <p className="lede">
        {kind === "owner" ? "Enter the shop PIN to see the full book." : "Pick your name and enter your PIN."}
      </p>

      <form className="form lock-form" onSubmit={submit}>
        {kind === "artist" && (
          <div className="artist-switch center">
            {artists.map(a => (
              <button
                type="button"
                key={a.id}
                className={`artist-tab ${a.accent} ${pickedArtistId === a.id ? "is-active" : ""}`}
                onClick={() => { setPickedArtistId(a.id); setError(""); }}
              >
                <span className="artist-avatar sm">{a.initials}</span>
                {a.name}
              </button>
            ))}
          </div>
        )}
        <label>
          PIN
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="••••"
          />
        </label>
        {error && <div className="lock-error">{error}</div>}
        <div className="lock-actions">
          <button className="btn btn-solid" type="submit" disabled={busy}>
            <KeyRound size={14} /> {busy ? "Checking…" : "Unlock"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onCancel}>Back</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------
   PAYMENT RESULT (after Stripe redirects back — live mode only)
--------------------------------------------------------- */

function PaymentResultScreen({ result, artists, onDone }) {
  const [appt, setAppt] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (result.status !== "success") return;
    api(`/appointments/${result.appointmentId}`)
      .then(a => setAppt(normalizeAppointment(a)))
      .catch(() =>
        setError(
          "Couldn't load your booking details here, but your payment likely went through — check your email or bank statement, or contact the shop."
        )
      );
  }, [result]);

  if (result.status === "cancelled") {
    return (
      <div className="stack center">
        <p className="eyebrow">payment cancelled</p>
        <h2 className="h2">No charge was made.</h2>
        <p className="lede">Your slot wasn't held. You're welcome to try booking again.</p>
        <button className="btn btn-solid" onClick={onDone}>Back to booking</button>
      </div>
    );
  }

  const artist = appt ? artists.find(a => a.id === appt.artistId) : null;

  return (
    <div className="stack center">
      <p className="eyebrow">payment received</p>
      <h2 className="h2">You're booked.</h2>
      <p className="lede">Your $50 deposit is confirmed. Save this stub — the artist will be in touch to confirm final details.</p>
      {error && <div className="lock-error">{error}</div>}
      {appt && <TicketStub appt={appt} artist={artist} />}
      {!appt && !error && <Loader2 size={16} className="spin" />}
      <button className="btn btn-ghost" onClick={onDone}>Book another session</button>
    </div>
  );
}

/* ---------------------------------------------------------
   CLIENT VIEW
--------------------------------------------------------- */

function ClientView({ artists, appointments, onSubmit }) {
  const [pickedArtist, setPickedArtist] = useState(null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", style: "", placement: "", size: SIZES[0], note: "" });
  const [lastTicket, setLastTicket] = useState(null);
  const [liveTaken, setLiveTaken] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const days = useMemo(() => nextDays(7), []);

  useEffect(() => {
    if (!LIVE || !pickedArtist) return;
    let cancelled = false;
    api(`/artists/${pickedArtist.id}/availability?days=7`)
      .then(slots => {
        if (cancelled) return;
        const s = new Set();
        slots.forEach(sl => {
          if (!sl.available) s.add(`${pickedArtist.id}|${sl.date}|${sl.time}`);
        });
        setLiveTaken(s);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pickedArtist]);

  const demoTakenSet = useMemo(() => {
    const s = new Set();
    appointments.forEach(a => {
      if (a.status === "requested" || a.status === "confirmed") {
        s.add(`${a.artistId}|${a.date}|${a.time}`);
      }
    });
    return s;
  }, [appointments]);

  const takenSet = LIVE ? liveTaken : demoTakenSet;

  function reset() {
    setPickedArtist(null);
    setDate(null);
    setTime(null);
    setForm({ name: "", phone: "", style: "", placement: "", size: SIZES[0], note: "" });
  }

  async function submit(e) {
    e.preventDefault();
    if (!pickedArtist || !date || !time || !form.name || !form.style) return;

    if (LIVE) {
      setBusy(true);
      setSubmitError("");
      try {
        const created = await api("/appointments", {
          method: "POST",
          body: {
            artist_id: pickedArtist.id,
            client_name: form.name,
            client_phone: form.phone,
            style: form.style,
            placement: form.placement,
            size: form.size,
            note: form.note,
            date, time,
          },
        });
        const { checkout_url } = await api(`/appointments/${created.id}/checkout`, { method: "POST" });
        window.location.href = checkout_url; // hand off to Stripe-hosted checkout
      } catch (err) {
        setSubmitError(err.message || "Something went wrong. Please try again.");
        setBusy(false);
      }
      return;
    }

    // Demo mode — simulate instantly, no real charge.
    const appt = {
      id: "r" + Date.now(),
      artistId: pickedArtist.id,
      clientName: form.name,
      clientPhone: form.phone,
      style: form.style,
      placement: form.placement,
      size: form.size,
      note: form.note,
      date, time,
      status: "requested",
      depositAmount: DEFAULT_DEPOSIT,
      depositPaid: false,
      createdAt: Date.now(),
    };
    onSubmit(appt);
    setLastTicket(appt);
    reset();
  }

  if (lastTicket) {
    const artist = artists.find(a => a.id === lastTicket.artistId);
    return (
      <div className="stack center">
        <p className="eyebrow">request sent · demo mode</p>
        <h2 className="h2">Your seat is on hold.</h2>
        <p className="lede">In demo mode this skips real payment. Once your backend is live, this step redirects to Stripe instead.</p>
        <TicketStub appt={lastTicket} artist={artist} />
        <button className="btn btn-ghost" onClick={() => setLastTicket(null)}>
          Book another session
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="hero">
        <p className="eyebrow">the flash sheet</p>
        <h2 className="h2">Pick an artist, pick a slot.</h2>
        <p className="lede">Every artist keeps their own book. Choose a hand, find an open hour, and hold it with a ${DEFAULT_DEPOSIT} deposit.</p>
      </div>

      <div className="grid-artists">
        {artists.map((a, i) => (
          <button
            key={a.id}
            className={`artist-card ${a.accent} ${pickedArtist?.id === a.id ? "is-active" : ""}`}
            onClick={() => { setPickedArtist(a); setDate(null); setTime(null); }}
          >
            <div className="artist-card-top">
              <span className="artist-num">No. {String(i + 1).padStart(2, "0")}</span>
              <span className="artist-avatar">{a.initials}</span>
            </div>
            <div className="artist-name">{a.name}</div>
            <div className="artist-specialty">{a.specialty}</div>
            <div className="artist-tagline">{a.tagline}</div>
            <div className="artist-cta">Book with {a.name.split(" ")[0]} <ArrowRight size={14} /></div>
          </button>
        ))}
      </div>

      {pickedArtist && (
        <div className={`panel ${pickedArtist.accent}`}>
          <div className="panel-head">
            <PenTool size={16} />
            <span>Booking with {pickedArtist.name}</span>
          </div>

          <div className="field-label"><Calendar size={13} /> Choose a day</div>
          <div className="day-row">
            {days.map(d => (
              <button
                key={d.iso}
                className={`day-chip ${date === d.iso ? "is-active" : ""}`}
                onClick={() => { setDate(d.iso); setTime(null); }}
              >
                <span className="day-dow">{d.dow}</span>
                <span className="day-num">{d.day}</span>
                <span className="day-mon">{d.mon}</span>
              </button>
            ))}
          </div>

          {date && (
            <>
              <div className="field-label"><Clock size={13} /> Choose a time</div>
              <div className="slot-row">
                {SLOT_TIMES.map(t => {
                  const taken = takenSet.has(`${pickedArtist.id}|${date}|${t}`);
                  return (
                    <button
                      key={t}
                      disabled={taken}
                      className={`slot-chip ${time === t ? "is-active" : ""} ${taken ? "is-taken" : ""}`}
                      onClick={() => setTime(t)}
                    >
                      {t}{taken ? " · held" : ""}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {date && time && (
            <form className="form" onSubmit={submit}>
              <div className="form-row two">
                <label>
                  Your name
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                </label>
                <label>
                  Phone
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="For confirmation" />
                </label>
              </div>
              <label>
                What are you getting?
                <input required value={form.style} onChange={e => setForm({ ...form, style: e.target.value })} placeholder="e.g. Fern forearm piece" />
              </label>
              <div className="form-row two">
                <label>
                  Placement
                  <input value={form.placement} onChange={e => setForm({ ...form, placement: e.target.value })} placeholder="e.g. Left forearm" />
                </label>
                <label>
                  Size
                  <select value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}>
                    {SIZES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label>
                Anything the artist should know
                <textarea rows={3} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="References, allergies, prior work in the area..." />
              </label>
              {submitError && <div className="lock-error">{submitError}</div>}
              <button className="btn btn-solid" type="submit" disabled={busy}>
                {busy ? "Redirecting to payment…" : `Pay $${DEFAULT_DEPOSIT} deposit & send request`} <ArrowRight size={14} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   ARTIST VIEW
--------------------------------------------------------- */

function ArtistView({ artists, appointments, activeArtistId, onUpdateStatus, onUpdateDeposit, onLogout }) {
  const artist = artists.find(a => a.id === activeArtistId) || artists[0];
  const mine = appointments.filter(a => a.artistId === artist.id);
  const requests = mine.filter(a => a.status === "requested").sort((a, b) => a.date.localeCompare(b.date));
  const confirmed = mine.filter(a => a.status === "confirmed").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const completed = mine.filter(a => a.status === "completed");
  const depositsOwed = mine.filter(a => a.status !== "cancelled" && !a.depositPaid).reduce((s, a) => s + Number(a.depositAmount || 0), 0);

  return (
    <div className="stack">
      <div className="view-head">
        <div className="hero">
          <p className="eyebrow">artist book · {artist.name}</p>
          <h2 className="h2">Your day sheet.</h2>
          <p className="lede">Confirm what you'll take, and keep the ledger honest.</p>
        </div>
        <button className="btn btn-ghost" onClick={onLogout}><LogOut size={14} /> Log out</button>
      </div>

      <div className="stat-row">
        <div className="stat"><span className="stat-num">{requests.length}</span><span className="stat-label">pending requests</span></div>
        <div className="stat"><span className="stat-num">{confirmed.length}</span><span className="stat-label">confirmed ahead</span></div>
        <div className="stat"><span className="stat-num">{fmtMoney(depositsOwed)}</span><span className="stat-label">deposits owed</span></div>
      </div>

      <section className="section">
        <h3 className="h3">Requests waiting on you</h3>
        {requests.length === 0 && <EmptyState label="No new requests. The book is clear." />}
        <div className="stack-sm">
          {requests.map(r => (
            <div key={r.id} className="ledger-card">
              <div className="ledger-main">
                <div className="ledger-top">
                  <strong>{r.clientName}</strong>
                  <span className="muted">{fmtDate(r.date)} · {r.time}</span>
                </div>
                <div className="ledger-style">{r.style}</div>
                <div className="ledger-meta">{r.placement || "placement TBD"} · {r.size}{r.clientPhone ? ` · ${r.clientPhone}` : ""}</div>
                {r.note && <div className="ledger-note">"{r.note}"</div>}
                <DepositBadge
                  appt={r}
                  editable
                  onToggle={() => onUpdateDeposit(r.id, { depositPaid: !r.depositPaid })}
                  onAmountChange={(amt) => onUpdateDeposit(r.id, { depositAmount: amt })}
                />
              </div>
              <div className="ledger-actions">
                <button className="icon-btn good" onClick={() => onUpdateStatus(r.id, "confirmed")} title="Confirm">
                  <Check size={16} />
                </button>
                <button className="icon-btn bad" onClick={() => onUpdateStatus(r.id, "cancelled")} title="Decline">
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h3 className="h3">Confirmed ahead</h3>
        {confirmed.length === 0 && <EmptyState label="Nothing confirmed yet this week." />}
        <div className="stack-sm">
          {confirmed.map(c => (
            <div key={c.id} className="ledger-row wrap">
              <div className="ledger-row-date">{fmtDate(c.date)}<span>{c.time}</span></div>
              <div className="ledger-row-mid">
                <strong>{c.clientName}</strong>
                <span className="muted">{c.style}</span>
              </div>
              <DepositBadge
                appt={c}
                editable
                onToggle={() => onUpdateDeposit(c.id, { depositPaid: !c.depositPaid })}
                onAmountChange={(amt) => onUpdateDeposit(c.id, { depositAmount: amt })}
              />
              <CalendarBtn appt={c} artistName={artist.name} />
              <button className="btn btn-tiny" onClick={() => onUpdateStatus(c.id, "completed")}>Mark done</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------
   OWNER VIEW
--------------------------------------------------------- */

function OwnerView({ artists, appointments, onAddArtist, onRemoveArtist, onSetPin, onSetOwnerPin, onLogout }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", specialty: "", tagline: "" });
  const [pinEdits, setPinEdits] = useState({});
  const [ownerPinEdit, setOwnerPinEdit] = useState("");
  const [revealPin, setRevealPin] = useState(null);
  const [err, setErr] = useState("");

  const upcoming = appointments
    .filter(a => a.status === "confirmed")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const depositsCollected = appointments.filter(a => a.depositPaid).reduce((s, a) => s + Number(a.depositAmount || 0), 0);
  const depositsOutstanding = appointments
    .filter(a => a.status !== "cancelled" && !a.depositPaid)
    .reduce((s, a) => s + Number(a.depositAmount || 0), 0);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!form.name || !form.specialty) return;
    const accent = ACCENTS[artists.length % ACCENTS.length];
    try {
      const created = await onAddArtist({ name: form.name, specialty: form.specialty, tagline: form.tagline, accent });
      setForm({ name: "", specialty: "", tagline: "" });
      setShowForm(false);
      if (created && created.pin) setRevealPin({ name: created.name, pin: created.pin });
    } catch (e2) {
      setErr(e2.message || "Couldn't add artist.");
    }
  }

  return (
    <div className="stack">
      <div className="view-head">
        <div className="hero">
          <p className="eyebrow">shop overview</p>
          <h2 className="h2">The whole wall, at a glance.</h2>
          <p className="lede">Every hand in the shop, every seat booked this week.</p>
        </div>
        <button className="btn btn-ghost" onClick={onLogout}><LogOut size={14} /> Log out</button>
      </div>

      <div className="stat-row">
        <div className="stat"><span className="stat-num">{fmtMoney(depositsCollected)}</span><span className="stat-label">deposits collected</span></div>
        <div className="stat"><span className="stat-num">{fmtMoney(depositsOutstanding)}</span><span className="stat-label">deposits outstanding</span></div>
        <div className="stat"><span className="stat-num">{upcoming.length}</span><span className="stat-label">confirmed, shop-wide</span></div>
      </div>

      <section className="section">
        <div className="section-head">
          <h3 className="h3">Roster & PINs</h3>
          <button className="btn btn-tiny" onClick={() => setShowForm(s => !s)}>
            <Plus size={14} /> Add artist
          </button>
        </div>

        {revealPin && (
          <div className="reveal-pin">
            <KeyRound size={14} />
            <span><strong>{revealPin.name}</strong> added — PIN <strong>{revealPin.pin}</strong>. Write it down, it won't be shown again.</span>
            <button className="deposit-toggle" onClick={() => setRevealPin(null)}>dismiss</button>
          </div>
        )}

        {showForm && (
          <form className="form panel-inline" onSubmit={submit}>
            <div className="form-row two">
              <label>Name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></label>
              <label>Specialty<input required value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="e.g. Neo-traditional" /></label>
            </div>
            <label>Tagline<input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} placeholder="One line for the flash sheet" /></label>
            {err && <div className="lock-error">{err}</div>}
            <button className="btn btn-solid" type="submit">Add to roster</button>
          </form>
        )}

        <div className="roster-grid">
          {artists.map(a => (
            <div key={a.id} className={`roster-card ${a.accent}`}>
              <div className="roster-top">
                <span className="artist-avatar sm">{a.initials}</span>
                <button className="icon-btn ghost" onClick={() => onRemoveArtist(a.id)} title="Remove artist">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="artist-name">{a.name}</div>
              <div className="artist-specialty">{a.specialty}</div>
              <div className="pin-row">
                <KeyRound size={12} />
                <input
                  className="pin-input"
                  maxLength={6}
                  placeholder={LIVE ? "New PIN" : a.pin}
                  value={pinEdits[a.id] ?? (LIVE ? "" : a.pin)}
                  onChange={e => setPinEdits({ ...pinEdits, [a.id]: e.target.value })}
                />
                <button
                  className="btn btn-tiny"
                  onClick={() => {
                    const val = pinEdits[a.id];
                    if (val) onSetPin(a.id, val);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h3 className="h3">Owner PIN</h3>
        <div className="pin-row standalone">
          <KeyRound size={12} />
          <input className="pin-input" maxLength={6} placeholder="New owner PIN" value={ownerPinEdit} onChange={e => setOwnerPinEdit(e.target.value)} />
          <button
            className="btn btn-tiny"
            onClick={() => { if (ownerPinEdit) { onSetOwnerPin(ownerPinEdit); setOwnerPinEdit(""); } }}
          >
            Save
          </button>
        </div>
      </section>

      <section className="section">
        <h3 className="h3">Confirmed this week, shop-wide</h3>
        {upcoming.length === 0 && <EmptyState label="Nothing on the books yet." />}
        <div className="stack-sm">
          {upcoming.map(u => {
            const artist = artists.find(a => a.id === u.artistId);
            return (
              <div key={u.id} className="ledger-row wrap">
                <div className="ledger-row-date">{fmtDate(u.date)}<span>{u.time}</span></div>
                <div className="ledger-row-mid">
                  <strong>{u.clientName}</strong>
                  <span className="muted">{u.style} · {artist?.name}</span>
                </div>
                <span className={`dot-tag ${artist?.accent}`} />
                <DepositBadge appt={u} />
                <CalendarBtn appt={u} artistName={artist?.name} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------
   APP
--------------------------------------------------------- */

export default function App() {
  const [role, setRole] = useState("client");
  const [pendingGate, setPendingGate] = useState(null); // "artist" | "owner" | null
  const [session, setSession] = useState({ artistId: null, token: null }); // in-memory only
  const [artists, setArtists] = useState(SEED_ARTISTS);
  const [appointments, setAppointments] = useState([]);
  const [ownerPin, setOwnerPin] = useState(DEFAULT_OWNER_PIN); // demo mode only
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [paymentResult, setPaymentResult] = useState(null);

  useEffect(() => {
    (async () => {
      if (LIVE) {
        try {
          const list = await api("/artists");
          setArtists(list);
        } catch (e) {
          setLoadError(
            `Couldn't reach the booking server at ${API_BASE_URL}. Confirm it's deployed, awake, and CORS_ORIGINS allows this site.`
          );
        }
      } else {
        const [a, p, op] = await Promise.all([
          loadShared("artists", SEED_ARTISTS),
          loadShared("appointments", []),
          loadShared("ownerPin", DEFAULT_OWNER_PIN),
        ]);
        setArtists(a);
        setAppointments(p);
        setOwnerPin(op);
      }
      setLoading(false);
    })();
  }, []);

  // Pick up Stripe's redirect back to this page (?payment=success|cancelled&appointment_id=...)
  useEffect(() => {
    if (!LIVE) return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const appointmentId = params.get("appointment_id");
    if (payment && appointmentId) {
      setPaymentResult({ status: payment, appointmentId });
      const url = new URL(window.location.href);
      ["payment", "appointment_id", "session_id"].forEach(k => url.searchParams.delete(k));
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function refreshAppointments(token) {
    try {
      const list = await api("/appointments", { token });
      setAppointments(list.map(normalizeAppointment));
    } catch (e) {
      console.error(e);
    }
  }

  function addAppointment(appt) {
    // Demo mode only — live mode books + redirects to Stripe directly inside ClientView.
    setAppointments(prev => {
      const next = [...prev, appt];
      saveShared("appointments", next);
      return next;
    });
  }

  async function updateStatus(id, status) {
    if (LIVE) {
      try {
        const updated = await api(`/appointments/${id}`, { method: "PATCH", token: session.token, body: { status } });
        setAppointments(prev => prev.map(a => a.id === id ? normalizeAppointment(updated) : a));
      } catch (e) { alert(e.message); }
    } else {
      setAppointments(prev => {
        const next = prev.map(a => a.id === id ? { ...a, status } : a);
        saveShared("appointments", next);
        return next;
      });
    }
  }

  async function updateDeposit(id, patch) {
    if (LIVE) {
      try {
        const body = {};
        if (patch.depositAmount !== undefined) body.deposit_amount = patch.depositAmount;
        if (patch.depositPaid !== undefined) body.deposit_paid = patch.depositPaid;
        const updated = await api(`/appointments/${id}`, { method: "PATCH", token: session.token, body });
        setAppointments(prev => prev.map(a => a.id === id ? normalizeAppointment(updated) : a));
      } catch (e) { alert(e.message); }
    } else {
      setAppointments(prev => {
        const next = prev.map(a => a.id === id ? { ...a, ...patch } : a);
        saveShared("appointments", next);
        return next;
      });
    }
  }

  async function addArtist(payload) {
    if (LIVE) {
      const created = await api("/artists", { method: "POST", token: session.token, body: payload });
      setArtists(prev => [...prev, created]);
      return created; // includes plaintext pin, once
    }
    const artist = {
      id: "a" + Date.now(),
      name: payload.name,
      specialty: payload.specialty,
      tagline: payload.tagline || "New to the book.",
      accent: payload.accent,
      initials: payload.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      pin: String(Math.floor(1000 + Math.random() * 9000)),
    };
    setArtists(prev => {
      const next = [...prev, artist];
      saveShared("artists", next);
      return next;
    });
    return artist;
  }

  async function removeArtist(id) {
    if (LIVE) {
      try {
        await api(`/artists/${id}`, { method: "DELETE", token: session.token });
        setArtists(prev => prev.filter(a => a.id !== id));
      } catch (e) { alert(e.message); }
    } else {
      setArtists(prev => {
        const next = prev.filter(a => a.id !== id);
        saveShared("artists", next);
        return next;
      });
    }
  }

  async function setArtistPin(id, pin) {
    if (LIVE) {
      try {
        const updated = await api(`/artists/${id}/pin`, { method: "PATCH", token: session.token, body: { pin } });
        setArtists(prev => prev.map(a => a.id === id ? updated : a));
      } catch (e) { alert(e.message); }
    } else {
      setArtists(prev => {
        const next = prev.map(a => a.id === id ? { ...a, pin } : a);
        saveShared("artists", next);
        return next;
      });
    }
  }

  async function saveOwnerPin(pin) {
    if (LIVE) {
      try {
        await api("/owner/pin", { method: "PATCH", token: session.token, body: { pin } });
      } catch (e) { alert(e.message); }
    } else {
      setOwnerPin(pin);
      saveShared("ownerPin", pin);
    }
  }

  function requestRole(r) {
    if (r === "client") { setRole("client"); return; }
    setPendingGate(r);
  }

  async function attemptLogin(pin, artistId) {
    if (pendingGate === "artist") {
      if (LIVE) {
        try {
          const res = await api("/auth/artist", { method: "POST", body: { artist_id: artistId, pin } });
          setSession({ artistId: res.artist_id, token: res.access_token });
          setRole("artist");
          setPendingGate(null);
          refreshAppointments(res.access_token);
          return null;
        } catch (e) {
          return e.message || "Wrong PIN. Try again.";
        }
      }
      const artist = artists.find(a => a.id === artistId);
      if (artist && artist.pin === pin) {
        setSession({ artistId, token: null });
        setRole("artist");
        setPendingGate(null);
        return null;
      }
      return "Wrong PIN. Try again.";
    }

    // owner
    if (LIVE) {
      try {
        const res = await api("/auth/owner", { method: "POST", body: { pin } });
        setSession({ artistId: null, token: res.access_token });
        setRole("owner");
        setPendingGate(null);
        refreshAppointments(res.access_token);
        return null;
      } catch (e) {
        return e.message || "Wrong PIN. Try again.";
      }
    }
    if (pin === ownerPin) {
      setSession({ artistId: null, token: null });
      setRole("owner");
      setPendingGate(null);
      return null;
    }
    return "Wrong PIN. Try again.";
  }

  function logout() {
    setRole("client");
    if (LIVE) setAppointments([]);
    setSession({ artistId: null, token: null });
  }

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Work+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

        .app {
          --bg: #17140f;
          --bg-raised: #1e1a14;
          --paper: #efe7d8;
          --paper-dim: #e4dac6;
          --ink: #211c14;
          --muted: #948a76;
          --muted-on-dark: #a89f8c;
          --line: rgba(239,231,216,0.14);
          --line-on-paper: rgba(33,28,20,0.14);
          --red: #b23a2e;
          --sage: #5c7a63;
          --ink-accent: #211c14;

          background: var(--bg);
          color: var(--paper);
          font-family: 'Work Sans', sans-serif;
          min-height: 100vh;
          padding: 28px 18px 60px;
          background-image:
            radial-gradient(circle at 1px 1px, rgba(239,231,216,0.05) 1px, transparent 0);
          background-size: 22px 22px;
        }
        .app * { box-sizing: border-box; }

        .accent-red { --acc: var(--red); }
        .accent-sage { --acc: var(--sage); }
        .accent-ink { --acc: #d8cdb3; }

        .shell { max-width: 880px; margin: 0 auto; }

        .topbar {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 14px; margin-bottom: 20px;
        }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand-mark {
          width: 34px; height: 34px; border: 1.5px solid var(--paper);
          border-radius: 999px; display: flex; align-items: center; justify-content: center;
          transform: rotate(-6deg); flex-shrink: 0;
        }
        .brand-name {
          font-family: 'Anton', sans-serif; letter-spacing: 0.03em;
          font-size: 22px; text-transform: uppercase;
        }
        .brand-sub-row { display: flex; align-items: center; gap: 8px; }
        .brand-sub { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted-on-dark); letter-spacing: 0.08em; text-transform: uppercase; }
        .mode-pill {
          font-family: 'Space Mono', monospace; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em;
          padding: 2px 7px; border-radius: 999px; border: 1px solid var(--line);
        }
        .mode-pill.live { color: #9fc2a8; border-color: var(--sage); }
        .mode-pill.demo { color: #d8cdb3; border-color: var(--line); }

        .mode-banner {
          display: flex; align-items: flex-start; gap: 8px; background: var(--bg-raised); border: 1px solid var(--line);
          border-left: 3px solid var(--paper); border-radius: 3px; padding: 10px 14px; font-size: 12.5px;
          color: var(--muted-on-dark); margin-bottom: 18px; line-height: 1.5;
        }
        .mode-banner.error { border-left-color: var(--red); color: #e0928a; }

        .role-switch { display: flex; gap: 6px; background: var(--bg-raised); padding: 5px; border-radius: 999px; border: 1px solid var(--line); }
        .role-btn {
          font-family: 'Space Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
          background: transparent; border: none; color: var(--muted-on-dark); padding: 8px 14px; border-radius: 999px;
          cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.15s ease;
        }
        .role-btn.is-active { background: var(--paper); color: var(--ink); }
        .role-btn:focus-visible { outline: 2px solid var(--paper); outline-offset: 2px; }

        .stack { display: flex; flex-direction: column; gap: 26px; }
        .stack-sm { display: flex; flex-direction: column; gap: 10px; }
        .stack.center { align-items: center; text-align: center; }

        .view-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }

        .hero { max-width: 520px; }
        .eyebrow {
          font-family: 'Space Mono', monospace; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.14em; color: var(--muted-on-dark); margin: 0 0 8px;
        }
        .h2 { font-family: 'Anton', sans-serif; font-size: 30px; line-height: 1.1; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.01em; }
        .h3 { font-family: 'Anton', sans-serif; font-size: 17px; text-transform: uppercase; letter-spacing: 0.02em; margin: 0; }
        .lede { color: var(--muted-on-dark); font-size: 14.5px; line-height: 1.5; margin: 0; }

        .lock-icon {
          width: 46px; height: 46px; border-radius: 999px; border: 1.5px solid var(--paper);
          display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
        }
        .lock-form { width: 100%; max-width: 340px; align-items: stretch; }
        .lock-error { color: var(--red); font-size: 12.5px; text-align: center; }
        .lock-actions { display: flex; gap: 8px; justify-content: center; }
        .artist-switch.center { justify-content: center; }

        .grid-artists { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
        @media (max-width: 640px) { .grid-artists { grid-template-columns: 1fr; } }

        .artist-card {
          background: var(--bg-raised); border: 1px solid var(--line); border-radius: 4px;
          padding: 18px; text-align: left; cursor: pointer; color: var(--paper);
          border-top: 3px solid var(--acc); transition: transform 0.15s ease, border-color 0.15s ease;
          display: flex; flex-direction: column; gap: 6px;
        }
        .artist-card:hover { transform: translateY(-2px); }
        .artist-card.is-active { border-color: var(--acc); box-shadow: 0 0 0 1px var(--acc); }
        .artist-card:focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }
        .artist-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .artist-num { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted-on-dark); }
        .artist-avatar {
          width: 30px; height: 30px; border-radius: 999px; background: var(--acc); color: var(--ink);
          font-family: 'Space Mono', monospace; font-weight: 700; font-size: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .artist-avatar.sm { width: 24px; height: 24px; font-size: 10.5px; }
        .artist-name { font-family: 'Anton', sans-serif; font-size: 17px; text-transform: uppercase; }
        .artist-specialty { font-size: 12.5px; color: var(--acc); font-weight: 600; }
        .artist-tagline { font-size: 13px; color: var(--muted-on-dark); line-height: 1.4; flex-grow: 1; }
        .artist-cta { font-family: 'Space Mono', monospace; font-size: 11.5px; display: flex; align-items: center; gap: 5px; margin-top: 6px; color: var(--paper); }

        .panel {
          background: var(--paper); color: var(--ink); border-radius: 4px; padding: 22px;
          border-top: 4px solid var(--acc);
        }
        .panel-inline { background: var(--bg-raised); color: var(--paper); border: 1px solid var(--line); border-radius: 4px; padding: 16px; }
        .panel-head { display: flex; align-items: center; gap: 8px; font-family: 'Space Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 16px; color: var(--acc); }

        .field-label { display: flex; align-items: center; gap: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 14px 0 8px; font-weight: 600; }
        .field-label:first-of-type { margin-top: 0; }

        .day-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
        .day-chip {
          flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 2px;
          background: transparent; border: 1px solid var(--line-on-paper); border-radius: 4px;
          padding: 8px 10px; cursor: pointer; min-width: 52px; color: var(--ink);
        }
        .day-chip.is-active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .day-dow { font-size: 10px; text-transform: uppercase; opacity: 0.7; }
        .day-num { font-family: 'Anton', sans-serif; font-size: 16px; }
        .day-mon { font-size: 9px; text-transform: uppercase; opacity: 0.7; }

        .slot-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .slot-chip {
          font-family: 'Space Mono', monospace; font-size: 12.5px; padding: 8px 14px;
          border: 1px solid var(--line-on-paper); border-radius: 999px; background: transparent; color: var(--ink); cursor: pointer;
        }
        .slot-chip.is-active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .slot-chip.is-taken { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; }

        .form { display: flex; flex-direction: column; gap: 12px; margin-top: 18px; }
        .form-row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 520px) { .form-row.two { grid-template-columns: 1fr; } }
        .form label { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--muted); }
        .panel .form label { color: #5c5545; }
        .form input, .form select, .form textarea {
          font-family: 'Work Sans', sans-serif; font-size: 14px; padding: 10px 11px;
          border-radius: 3px; border: 1px solid var(--line-on-paper); background: rgba(255,255,255,0.5); color: var(--ink);
        }
        .panel-inline input, .panel-inline select, .panel-inline textarea { background: var(--bg); color: var(--paper); border-color: var(--line); }
        .form input:focus, .form select:focus, .form textarea:focus { outline: 2px solid var(--acc); outline-offset: 1px; }
        .form textarea { resize: vertical; }

        .btn {
          font-family: 'Space Mono', monospace; font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.05em;
          border-radius: 3px; padding: 11px 18px; cursor: pointer; border: none;
          display: inline-flex; align-items: center; justify-content: center; gap: 7px; width: fit-content;
        }
        .btn:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-solid { background: var(--ink); color: var(--paper); }
        .panel-inline .btn-solid { background: var(--paper); color: var(--ink); }
        .btn-ghost { background: transparent; border: 1px solid var(--line); color: var(--paper); }
        .btn-tiny { background: var(--bg-raised); border: 1px solid var(--line); color: var(--paper); padding: 7px 12px; font-size: 11px; }

        .ticket {
          position: relative; background: var(--paper); color: var(--ink); border-radius: 4px;
          padding: 22px 20px; width: 100%; max-width: 320px; border: 1.5px dashed var(--line-on-paper);
        }
        .ticket-punch { position: absolute; width: 16px; height: 16px; background: var(--bg); border-radius: 999px; top: 50%; transform: translateY(-50%); }
        .ticket-punch.left { left: -8px; } .ticket-punch.right { right: -8px; }
        .ticket-num { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .ticket-body { display: flex; flex-direction: column; gap: 7px; }
        .ticket-row { display: flex; justify-content: space-between; font-size: 13px; border-bottom: 1px dotted var(--line-on-paper); padding-bottom: 6px; }
        .ticket-row span { color: var(--muted); }

        .stamp {
          margin-top: 16px; align-self: center; width: fit-content; border: 2px solid var(--red); color: var(--red);
          font-family: 'Anton', sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em;
          padding: 5px 14px; border-radius: 999px; transform: rotate(-7deg); opacity: 0.85;
        }

        .artist-switch { display: flex; gap: 8px; flex-wrap: wrap; }
        .artist-tab {
          display: flex; align-items: center; gap: 8px; background: var(--bg-raised); border: 1px solid var(--line);
          border-radius: 999px; padding: 6px 14px 6px 6px; color: var(--muted-on-dark); font-size: 13px; cursor: pointer;
        }
        .artist-tab.is-active { border-color: var(--acc); color: var(--paper); }

        .stat-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .stat { background: var(--bg-raised); border: 1px solid var(--line); border-radius: 4px; padding: 14px 18px; flex: 1; min-width: 120px; }
        .stat-num { font-family: 'Anton', sans-serif; font-size: 26px; display: block; }
        .stat-label { font-size: 11.5px; color: var(--muted-on-dark); text-transform: uppercase; letter-spacing: 0.04em; }

        .section { display: flex; flex-direction: column; gap: 12px; }
        .section-head { display: flex; align-items: center; justify-content: space-between; }

        .ledger-card {
          background: var(--bg-raised); border: 1px solid var(--line); border-left: 3px solid var(--acc, var(--paper));
          border-radius: 3px; padding: 14px 16px; display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap;
        }
        .ledger-main { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 200px; }
        .ledger-top { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .ledger-style { font-size: 13.5px; }
        .ledger-meta { font-size: 12px; color: var(--muted-on-dark); }
        .ledger-note { font-size: 12px; color: var(--muted-on-dark); font-style: italic; margin-top: 3px; }
        .ledger-actions { display: flex; gap: 8px; align-items: flex-start; }

        .icon-btn {
          width: 32px; height: 32px; border-radius: 999px; border: 1px solid var(--line); background: var(--bg);
          color: var(--paper); display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .icon-btn.good { color: var(--sage); border-color: var(--sage); }
        .icon-btn.bad { color: var(--red); border-color: var(--red); }
        .icon-btn.ghost { background: transparent; }

        .ledger-row {
          display: flex; align-items: center; gap: 14px; background: var(--bg-raised); border: 1px solid var(--line);
          border-radius: 3px; padding: 10px 14px; flex-wrap: wrap;
        }
        .ledger-row.wrap { row-gap: 8px; }
        .ledger-row-date { font-family: 'Space Mono', monospace; font-size: 12px; display: flex; flex-direction: column; color: var(--muted-on-dark); min-width: 90px; }
        .ledger-row-date span { color: var(--paper); font-size: 13px; }
        .ledger-row-mid { display: flex; flex-direction: column; flex: 1; min-width: 140px; gap: 1px; }
        .muted { color: var(--muted-on-dark); font-size: 12.5px; }

        .pill { font-family: 'Space Mono', monospace; font-size: 10.5px; text-transform: uppercase; padding: 4px 9px; border-radius: 999px; letter-spacing: 0.04em; }
        .pill-confirmed { background: rgba(92,122,99,0.25); color: #9fc2a8; }
        .pill-requested { background: rgba(178,58,46,0.2); color: #e0928a; }
        .pill-completed { background: rgba(216,205,179,0.2); color: #d8cdb3; }

        .dot-tag { width: 9px; height: 9px; border-radius: 999px; background: var(--acc); flex-shrink: 0; }

        .deposit-badge {
          display: flex; align-items: center; gap: 5px; font-family: 'Space Mono', monospace; font-size: 11.5px;
          border: 1px solid var(--line); border-radius: 999px; padding: 4px 8px 4px 10px; width: fit-content;
        }
        .deposit-badge.is-paid { border-color: var(--sage); color: #9fc2a8; }
        .deposit-badge.is-unpaid { border-color: var(--red); color: #e0928a; }
        .deposit-input {
          width: 46px; background: transparent; border: none; border-bottom: 1px dotted currentColor; color: inherit;
          font-family: 'Space Mono', monospace; font-size: 11.5px; padding: 0;
        }
        .deposit-toggle {
          background: transparent; border: none; color: inherit; text-transform: uppercase; cursor: pointer;
          font-family: 'Space Mono', monospace; font-size: 10px; text-decoration: underline; padding: 0;
        }

        .reveal-pin {
          display: flex; align-items: center; gap: 8px; background: rgba(92,122,99,0.15); border: 1px solid var(--sage);
          border-radius: 4px; padding: 10px 14px; font-size: 12.5px; color: #cfe3d4;
        }

        .roster-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
        .roster-card { background: var(--bg-raised); border: 1px solid var(--line); border-top: 3px solid var(--acc); border-radius: 4px; padding: 14px; display: flex; flex-direction: column; gap: 5px; }
        .roster-top { display: flex; justify-content: space-between; align-items: center; }

        .pin-row { display: flex; align-items: center; gap: 6px; margin-top: 8px; color: var(--muted-on-dark); }
        .pin-row.standalone { background: var(--bg-raised); border: 1px solid var(--line); border-radius: 4px; padding: 10px 12px; margin-top: 0; }
        .pin-input {
          font-family: 'Space Mono', monospace; font-size: 12.5px; padding: 6px 8px; border-radius: 3px;
          border: 1px solid var(--line); background: var(--bg); color: var(--paper); width: 80px;
        }

        .empty { border: 1px dashed var(--line); border-radius: 4px; padding: 18px; text-align: center; color: var(--muted-on-dark); font-size: 13px; }

        .loading-wrap { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 60vh; color: var(--muted-on-dark); font-family: 'Space Mono', monospace; font-size: 13px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="shell">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark"><PenTool size={15} /></div>
            <div>
              <div className="brand-name">Ironvine Tattoo</div>
              <div className="brand-sub-row">
                <span className="brand-sub">Atlanta, GA</span>
                <span className={`mode-pill ${LIVE ? "live" : "demo"}`}>{LIVE ? "live" : "demo mode"}</span>
              </div>
            </div>
          </div>
          <div className="role-switch">
            <button className={`role-btn ${role === "client" ? "is-active" : ""}`} onClick={() => requestRole("client")}>
              <User size={13} /> Client
            </button>
            <button className={`role-btn ${role === "artist" ? "is-active" : ""}`} onClick={() => requestRole("artist")}>
              <PenTool size={13} /> Artist
            </button>
            <button className={`role-btn ${role === "owner" ? "is-active" : ""}`} onClick={() => requestRole("owner")}>
              <Users size={13} /> Owner
            </button>
          </div>
        </div>

        {!LIVE && (
          <div className="mode-banner">
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Demo mode — bookings simulate locally and no real card is charged.
              Deploy the backend, then paste its URL into <code>API_BASE_URL</code> at
              the top of this file to enable real Stripe payments and shared data.
            </span>
          </div>
        )}
        {loadError && (
          <div className="mode-banner error">
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{loadError}</span>
          </div>
        )}

        {loading ? (
          <div className="loading-wrap"><Loader2 size={16} className="spin" /> Opening the book…</div>
        ) : paymentResult ? (
          <PaymentResultScreen result={paymentResult} artists={artists} onDone={() => setPaymentResult(null)} />
        ) : pendingGate ? (
          <AuthGate
            kind={pendingGate}
            artists={artists}
            onCancel={() => setPendingGate(null)}
            onAttempt={attemptLogin}
          />
        ) : role === "client" ? (
          <ClientView artists={artists} appointments={appointments} onSubmit={addAppointment} />
        ) : role === "artist" ? (
          <ArtistView
            artists={artists}
            appointments={appointments}
            activeArtistId={session.artistId}
            onUpdateStatus={updateStatus}
            onUpdateDeposit={updateDeposit}
            onLogout={logout}
          />
        ) : (
          <OwnerView
            artists={artists}
            appointments={appointments}
            onAddArtist={addArtist}
            onRemoveArtist={removeArtist}
            onSetPin={setArtistPin}
            onSetOwnerPin={saveOwnerPin}
            onLogout={logout}
          />
        )}
      </div>
    </div>
  );
}
