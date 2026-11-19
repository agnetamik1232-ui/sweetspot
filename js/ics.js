// Sweet Spot — a calendar file with every bill and payday, so the phone reminds you even when the app is closed.
import { billDates, periodOf, addDays, parts } from "./calc.js";

const D = s => s.replace(/-/g, "");
const esc = s => String(s).replace(/[\\;,]/g, m => "\\" + m).replace(/\n/g, "\\n");
const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function event(uid, date, summary, rrule, desc) {
  return [
    "BEGIN:VEVENT", `UID:${uid}@sweetspot`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${D(date)}`, `DTEND;VALUE=DATE:${D(addDays(date, 1))}`, `SUMMARY:${esc(summary)}`,
    rrule ? `RRULE:${rrule}` : null, desc ? `DESCRIPTION:${esc(desc)}` : null,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(summary)}`, "TRIGGER:-PT15H", "END:VALARM",
    "END:VEVENT",
  ].filter(Boolean).join("\r\n");
}

export function buildICS(state, today, fmt) {
  const ev = [];
  const pay = state.pay;
  const firstPay = periodOf(pay, today).next;
  for (const b of state.bills) {
    const first = billDates(b, today, addDays(today, 400), pay)[0];
    if (!first) continue;
    let rule = null;
    if (b.freq === "monthly") rule = b.day >= 29 ? (b.day >= 31 ? "FREQ=MONTHLY;BYMONTHDAY=-1" : `FREQ=MONTHLY;BYMONTHDAY=${b.day},-1;BYSETPOS=1`) : `FREQ=MONTHLY;BYMONTHDAY=${b.day}`;
    else if (b.freq === "weekly") rule = `FREQ=WEEKLY;BYDAY=${DAYS[b.weekday ?? 1]}`;
    else if (b.freq === "yearly") rule = "FREQ=YEARLY";
    else if (b.freq === "perPeriod") rule = payRule(pay, first);
    ev.push(event(`bill-${b.id}`, first, `Pay ${b.name} (${fmt(b.amount)})${b.autopay ? " - autopay" : ""}`, rule, "From Sweet Spot. Mark it paid in the app."));
  }
  if (pay.rhythm !== "irregular") {
    if (pay.rhythm === "semimonthly") {
      (pay.days || [1, 15]).forEach((d, i) => ev.push(event(`payday-${i}`, nextOnDay(today, d), "Payday: 2-minute routine in Sweet Spot", d >= 31 ? "FREQ=MONTHLY;BYMONTHDAY=-1" : `FREQ=MONTHLY;BYMONTHDAY=${d}`)));
    } else ev.push(event("payday", firstPay, "Payday: 2-minute routine in Sweet Spot", payRule(pay, firstPay)));
  }
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dear Agneta//Sweet Spot//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Sweet Spot bills", ...ev, "END:VCALENDAR", ""].join("\r\n");
}

function payRule(pay, first) {
  if (pay.rhythm === "weekly") return "FREQ=WEEKLY";
  if (pay.rhythm === "biweekly") return "FREQ=WEEKLY;INTERVAL=2";
  if (pay.rhythm === "fourweekly") return "FREQ=WEEKLY;INTERVAL=4";
  if (pay.rhythm === "monthly") return (pay.day || 1) >= 31 ? "FREQ=MONTHLY;BYMONTHDAY=-1" : `FREQ=MONTHLY;BYMONTHDAY=${pay.day || parts(first)[2]}`;
  return "FREQ=MONTHLY";
}

function nextOnDay(today, d) {
  let [y, m] = parts(today);
  for (let i = 0; i < 3; i++) {
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const s = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d, dim)).padStart(2, "0")}`;
    if (s >= today) return s;
    m++; if (m > 12) { m = 1; y++; }
  }
  return today;
}
