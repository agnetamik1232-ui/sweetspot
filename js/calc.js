// Sweet Spot — money maths. Pure functions only (no DOM, no storage), so they can be tested in Node.
// Dates are plain "YYYY-MM-DD" strings in the buyer's local calendar.

const DAY = 86400000;
export const pad = n => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const parts = s => s.split("-").map(Number);
export const dayNum = s => { const [y, m, d] = parts(s); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
export const fromDayNum = n => { const t = new Date(n * DAY); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
export const addDays = (s, n) => fromDayNum(dayNum(s) + n);
export const diffDays = (a, b) => dayNum(b) - dayNum(a);
export const weekday = s => new Date(dayNum(s) * DAY).getUTCDay();
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const clampDay = (y, m, d) => iso(y, m, Math.min(d, daysInMonth(y, m)));
export const monthKey = s => s.slice(0, 7);
export const todayISO = (now = new Date()) => iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
export const addMonths = (y, m, n) => { const t = (y * 12 + (m - 1)) + n; return [Math.floor(t / 12), (t % 12) + 1]; };
export const round2 = n => Math.round(n * 100) / 100;
export const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

export const RHYTHMS = {
  weekly: { label: "Every week", step: 7 },
  biweekly: { label: "Every 2 weeks", step: 14 },
  fourweekly: { label: "Every 4 weeks", step: 28 },
  monthly: { label: "Once a month" },
  semimonthly: { label: "Twice a month" },
  irregular: { label: "It changes (shifts, tips, freelance)" },
};

// ---------- Paydays and pay periods ----------
function monthlyPaydays(pay, y, m) {
  if (pay.rhythm === "monthly") return [clampDay(y, m, pay.day || 1)];
  const days = [...(pay.days || [1, 15])].sort((a, b) => a - b);
  return [...new Set(days.map(d => clampDay(y, m, d)))];
}

export function lastPayday(pay, t) {
  const step = RHYTHMS[pay.rhythm]?.step;
  if (step) {
    const k = Math.floor(diffDays(pay.anchor, t) / step);
    return addDays(pay.anchor, k * step);
  }
  if (pay.rhythm === "monthly" || pay.rhythm === "semimonthly") {
    let [y, m] = parts(t);
    for (let i = 0; i < 3; i++) {
      const c = monthlyPaydays(pay, y, m).filter(d => d <= t);
      if (c.length) return c[c.length - 1];
      [y, m] = addMonths(y, m, -1);
    }
  }
  const [y, m] = parts(t);
  return iso(y, m, 1); // irregular: calendar month
}

export function nextPayday(pay, t) {
  const step = RHYTHMS[pay.rhythm]?.step;
  if (step) return addDays(lastPayday(pay, t), step);
  if (pay.rhythm === "monthly" || pay.rhythm === "semimonthly") {
    let [y, m] = parts(t);
    for (let i = 0; i < 3; i++) {
      const c = monthlyPaydays(pay, y, m).filter(d => d > t);
      if (c.length) return c[0];
      [y, m] = addMonths(y, m, 1);
    }
  }
  const [y, m] = parts(t);
  const [ny, nm] = addMonths(y, m, 1);
  return iso(ny, nm, 1);
}

export function periodOf(pay, t) {
  const start = lastPayday(pay, t);
  const next = nextPayday(pay, t);
  const end = addDays(next, -1);
  return { start, end, next, days: diffDays(start, end) + 1, irregular: pay.rhythm === "irregular" };
}

export const nextPeriod = (pay, p) => periodOf(pay, p.next);
export const prevPeriod = (pay, p) => periodOf(pay, addDays(p.start, -1));

// ---------- Bills ----------
export function billDates(bill, from, to, pay) {
  const out = [];
  if (to < from) return out;
  if (bill.freq === "monthly") {
    let [y, m] = parts(from);
    const [ty, tm] = parts(to);
    while (y * 12 + m <= ty * 12 + tm) {
      const d = clampDay(y, m, bill.day || 1);
      if (d >= from && d <= to) out.push(d);
      [y, m] = addMonths(y, m, 1);
    }
  } else if (bill.freq === "yearly") {
    const [mm, dd] = (bill.date || "01-01").split("-").map(Number);
    for (let y = parts(from)[0]; y <= parts(to)[0]; y++) {
      const d = clampDay(y, mm, dd);
      if (d >= from && d <= to) out.push(d);
    }
  } else if (bill.freq === "weekly") {
    let d = addDays(from, ((bill.weekday ?? 1) - weekday(from) + 7) % 7);
    while (d <= to) { out.push(d); d = addDays(d, 7); }
  } else if (bill.freq === "perPeriod") {
    let p = periodOf(pay, from);
    let guard = 0;
    if (p.start < from) p = nextPeriod(pay, p);
    while (p.start <= to && guard++ < 400) { out.push(p.start); p = nextPeriod(pay, p); }
  } else if (bill.freq === "once") {
    if (bill.date >= from && bill.date <= to) out.push(bill.date);
  }
  return out;
}

export const billKey = (bill, date) => `${bill.id}|${date}`;

export function billItems(state, from, to, today) {
  const items = [];
  for (const b of state.bills) {
    for (const date of billDates(b, from, to, state.pay)) {
      const key = billKey(b, date);
      const paid = !!state.billPaid[key] || (b.autopay && date <= today);
      items.push({ bill: b, date, key, amount: Number(b.amount) || 0, paid, overdue: !paid && date < today });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.bill.name.localeCompare(b.bill.name));
}

// ---------- Transactions ----------
export const txIn = (state, from, to, kind) => state.tx.filter(t => t.date >= from && t.date <= to && (!kind || t.kind === kind));
export const spentIn = (state, from, to) => sum(txIn(state, from, to, "spend"), t => t.amount);

export function goalSaved(state, g) { return round2((Number(g.start) || 0) + sum(state.tx.filter(t => t.kind === "save" && t.goalId === g.id), t => t.amount)); }
export function debtLeft(state, d) { return round2(Math.max(0, (Number(d.start) || 0) - sum(state.tx.filter(t => t.kind === "debt" && t.debtId === d.id), t => t.amount))); }

// ---------- The plan for one pay period ----------
export function planFor(state, p, today) {
  const extraIn = sum(txIn(state, p.start, p.end, "income"), t => t.amount);
  const set = state.periodIncome?.[p.start];
  const pay = p.irregular ? 0 : (set ?? (Number(state.pay.amount) || 0));
  const carry = Number(state.periodCarry?.[p.start]) || 0;
  const income = round2(pay + extraIn + carry);
  const bills = billItems(state, p.start, p.end, today);
  const billsTotal = round2(sum(bills, b => b.amount));
  const billsLeft = round2(sum(bills.filter(b => !b.paid), b => b.amount));
  const goals = state.goals.filter(g => goalSaved(state, g) < Number(g.target || 0));
  const debts = state.debts.filter(d => debtLeft(state, d) > 0);
  const saving = round2(sum(goals, g => g.perPeriod) + sum(debts, d => d.perPeriod));
  const everyday = round2(income - billsTotal - saving);
  const potsTotal = round2(sum(state.pots, x => x.budget));
  return { period: p, pay, extraIn, carry, income, bills, billsTotal, billsLeft, saving, everyday, potsTotal, unassigned: round2(everyday - potsTotal), covered: income >= billsTotal + saving };
}

// ---------- Safe to spend today ----------
export function safeToSpend(state, today) {
  const p = periodOf(state.pay, today);
  const plan = planFor(state, p, today);
  const spentBefore = spentIn(state, p.start, addDays(today, -1));
  const spentToday = spentIn(state, today, today);
  const daysLeft = diffDays(today, p.end) + 1;
  const leftAtStart = round2(plan.everyday - spentBefore);
  const safe = leftAtStart / daysLeft;
  const leftNow = round2(leftAtStart - spentToday);
  const dayIndex = diffDays(p.start, today) + 1;
  const planToDate = plan.everyday * dayIndex / p.days;
  const spentToDate = round2(spentBefore + spentToday);
  return {
    period: p, plan, today, daysLeft, dayIndex,
    leftAtStart, safe: Math.max(0, safe), rawSafe: safe, spentToday, leftToday: round2(safe - spentToday),
    leftNow, perDayFromTomorrow: daysLeft > 1 ? leftNow / (daysLeft - 1) : leftNow,
    spentToDate, planToDate: round2(planToDate), vsPlan: round2(spentToDate - planToDate),
  };
}

export function paceNote(s, fmt) {
  if (s.period.irregular && s.plan.income <= 0) return "Log money as it comes in and your number appears.";
  const v = s.vsPlan;
  if (Math.abs(v) < Math.max(5, s.plan.everyday * 0.02)) return "Right on plan so far.";
  if (v < 0) return `You're ${fmt(-v)} under plan so far. Your days ahead get a little more each.`;
  if (s.leftNow > 0) return `About ${fmt(v)} more than planned so far. Nothing to fix, today's number already allows for it.`;
  return "Everyday money for this period is used up. Bills and savings are still safe.";
}

// ---------- Can I afford it? ----------
export function affordCheck(state, today, price) {
  const s = safeToSpend(state, today);
  const now = s.leftNow / s.daysLeft;
  const withIt = (s.leftNow - price) / s.daysLeft;
  const np = nextPeriod(state.pay, s.period);
  const next = planFor(state, np, today);
  let verdict, tone;
  if (price <= Math.max(0, s.leftToday)) { verdict = "Yes, it fits in today."; tone = "yes"; }
  else if (withIt >= now * 0.5 && withIt > 0) { verdict = `Yes, but the next ${s.daysLeft} days get tighter.`; tone = "tight"; }
  else if (withIt > 0) { verdict = `It's a stretch: ${s.daysLeft} days on a lot less.`; tone = "stretch"; }
  else { verdict = "Not before payday without touching bills or savings."; tone = "no"; }
  let after;
  if (s.period.irregular) after = "Or wait until more money comes in.";
  else if (price <= next.everyday * 0.25) after = "easy";
  else if (price <= next.everyday) after = "tight";
  else after = "goal";
  return { s, now, withIt, verdict, tone, nextPayday: np.start, nextEveryday: next.everyday, after };
}

// ---------- Goals and debts ----------
export function goalFinish(state, g, today) {
  const left = Number(g.target || 0) - goalSaved(state, g);
  if (left <= 0) return { done: true };
  const per = Number(g.perPeriod) || 0;
  if (per <= 0) return { done: false, date: null };
  let n = Math.ceil(left / per), p = periodOf(state.pay, today), guard = 0;
  while (n-- > 0 && guard++ < 1000) p = nextPeriod(state.pay, p);
  return { done: false, date: p.start };
}

export function debtFinish(state, d, today) {
  let bal = debtLeft(state, d);
  const per = Number(d.perPeriod) || 0;
  if (bal <= 0) return { done: true };
  if (per <= 0) return { done: false, date: null };
  let p = periodOf(state.pay, today), guard = 0, interest = 0;
  while (bal > 0 && guard++ < 1200) {
    const i = bal * (Number(d.rate) || 0) / 100 * p.days / 365;
    if (per <= i) return { done: false, date: null, never: true };
    interest += i; bal = bal + i - per; p = nextPeriod(state.pay, p);
  }
  return { done: false, date: guard >= 1200 ? null : p.start, interest: round2(interest) };
}

// ---------- Look back ----------
// The first day the buyer's numbers mean anything: their first entry, or the day they set up.
export function trackingStart(state) {
  const dates = state.tx.map(t => t.date).filter(Boolean);
  const created = state.meta?.createdAt ? state.meta.createdAt.slice(0, 10) : null;
  if (created) dates.push(created);
  return dates.length ? dates.reduce((a, b) => (b < a ? b : a)) : null;
}

export function monthSummary(state, ym, today) {
  const [y, m] = ym.split("-").map(Number);
  const from = iso(y, m, 1), to = iso(y, m, daysInMonth(y, m));
  const until = to < today ? to : today;
  const first = trackingStart(state) || today;
  let pay = 0;
  if (state.pay.rhythm !== "irregular" && to >= first) {
    let p = periodOf(state.pay, from), guard = 0;
    if (p.start < from) p = nextPeriod(state.pay, p);
    while (p.start <= until && guard++ < 40) { if (p.end >= first) pay += state.periodIncome?.[p.start] ?? (Number(state.pay.amount) || 0); p = nextPeriod(state.pay, p); }
  }
  const income = round2(pay + sum(txIn(state, from, until, "income"), t => t.amount));
  const spends = txIn(state, from, until, "spend");
  const spent = round2(sum(spends, t => t.amount));
  const bills = round2(sum(billItems(state, from > first ? from : first, until, today), b => b.amount));
  const saved = round2(sum(txIn(state, from, until, "save"), t => t.amount) + sum(txIn(state, from, until, "debt"), t => t.amount));
  const byPot = {};
  for (const t of spends) byPot[t.potId || "other"] = round2((byPot[t.potId || "other"] || 0) + t.amount);
  const byDay = {};
  for (const t of spends) byDay[t.date] = round2((byDay[t.date] || 0) + t.amount);
  return { ym, from, to, income, spent, bills, saved, left: round2(income - spent - bills - saved), byPot, byDay, started: from <= today && to >= first, current: from <= today && today <= to };
}

export function yearSummary(state, year, today) {
  return Array.from({ length: 12 }, (_, i) => monthSummary(state, `${year}-${pad(i + 1)}`, today));
}

// ---------- What to do next ----------
export function nextStep(state, today, fd = d => d) {
  const s = safeToSpend(state, today);
  const snooze = state.meta?.snooze;
  const soon = billItems(state, addDays(today, -31), addDays(today, 3), today).filter(b => !b.paid && !b.bill.autopay && !(snooze && snooze.key === b.key && snooze.date === today));
  if (soon.length) {
    const b = soon[0];
    const when = b.date < today ? `was due ${fd(b.date)}` : b.date === today ? "due today" : b.date === addDays(today, 1) ? `due tomorrow, ${fd(b.date)}` : `due ${fd(b.date)}`;
    return { type: "bill", item: b, title: `Pay ${b.bill.name}`, amount: b.amount, when };
  }
  if (!s.period.irregular && !state.routineDone?.[s.period.start] && s.dayIndex <= 4) return { type: "payday", title: "Your 2-minute payday routine", when: "a new pay period started" };
  const ready = (state.waitlist || []).find(w => w.status === "waiting" && w.remindOn <= today);
  if (ready) return { type: "wait", item: ready, title: `Decide on ${ready.name}`, amount: ready.amount, when: "you asked to be reminded on payday" };
  const last = state.meta?.lastBackup;
  if (!state.meta?.demo && (!last || diffDays(last.slice(0, 10), today) >= 7) && state.tx.length >= 5) return { type: "backup", title: "Back up your money diary", when: last ? `last backup ${diffDays(last.slice(0, 10), today)} days ago` : "no backup yet, takes 10 seconds" };
  return { type: "none", title: "Nothing to do today", when: "just log what you spend" };
}

export function daysSinceLastSpend(state, today) {
  const ds = state.tx.filter(t => t.kind === "spend" && t.date <= today).map(t => t.date).sort();
  if (!ds.length) return null;
  return diffDays(ds[ds.length - 1], today);
}
