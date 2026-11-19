// Sweet Spot — the screens.
import * as C from "./calc.js";
import { app, esc, money, fmt, fmtR, fd, fdLong, fdShort, fMonth, fMonthShort, fMonthYear, potById, potColor, sq, pct, isIOS, isStandalone } from "./core.js";
import { LOOKS, CURRENCIES } from "./model.js";

export const ETSY_URL = "https://dearagneta.etsy.com";
export const APP_VERSION = "1.0.0";

const VIEWS = [["today", "Today"], ["plan", "Plan"], ["bills", "Bills"], ["goals", "Goals & debts"], ["lookback", "Look back"]];
const motif = () => `img/motif-${app.S.profile.look in LOOKS ? app.S.profile.look : "strawberry"}.png`;

export function shell() {
  const v = app.view;
  const cur = k => (v === k || (k === "more" && ["goals", "lookback", "settings", "more"].includes(v)) ? ' aria-current="page"' : "");
  const hide = app.S.profile.hideAmounts;
  return `
  ${app.demo && !app.photo ? `<div class="demo-bar"><span>Free demo with example numbers. Try anything, nothing is saved.</span><a href="${ETSY_URL}" target="_blank" rel="noopener">Get Sweet Spot</a></div>` : ""}
  <header class="top"><div class="top-in">
    <div class="logo fr it">Sweet Spot <img src="${motif()}" alt=""></div>
    <nav class="nav" aria-label="Main">${VIEWS.map(([k, l]) => `<button type="button" data-act="nav" data-view="${k}"${v === k ? ' aria-current="page"' : ""}>${l}</button>`).join("")}</nav>
    <div class="top-right">
      <button type="button" class="toggle" data-act="toggle-hide" aria-pressed="${hide}"><i></i><span class="hide-label">Hide amounts</span><span class="sr">Hide amounts</span></button>
      <button type="button" class="chip" data-act="nav" data-view="settings"${v === "settings" ? ' aria-current="page"' : ""}>Settings</button>
    </div>
  </div></header>
  <main class="main" id="main">${(views[v] || views.today)()}</main>
  <nav class="tabbar" aria-label="Main">
    <button type="button" data-act="nav" data-view="today"${cur("today")}>Today</button>
    <button type="button" data-act="nav" data-view="plan"${cur("plan")}>Plan</button>
    <button type="button" class="add" data-act="add-spend" aria-label="Add a spend">+</button>
    <button type="button" data-act="nav" data-view="bills"${cur("bills")}>Bills</button>
    <button type="button" data-act="nav" data-view="more"${cur("more")}>More</button>
  </nav>`;
}

// ---------------- TODAY ----------------
function hero(s) {
  const p = s.period, plan = s.plan;
  const until = p.irregular ? `until the end of ${fMonthYear(p.end).split(" ")[0]}` : `until payday ${fd(p.next)}`;
  const empty = p.irregular && plan.income <= 0;
  const usedUp = !empty && s.leftAtStart <= 0;
  const big = empty ? "&ndash;" : money(s.safe, "d");
  const status = empty ? `<span class="warnline">Log money as it comes in and your number appears.</span>`
    : !plan.covered ? `<span class="warnline">Your plan is short this period. <button type="button" class="btn text small" data-act="nav" data-view="plan">Open Plan</button></span>`
    : `<span class="good">bills covered</span>`;
  const leftTodayTxt = s.leftToday >= 0 ? `${money(s.leftToday)} left today` : `${money(-s.leftToday)} over today, tomorrow adjusts`;
  return `<section class="card tint hero s5" aria-label="Safe to spend today">
    <img class="motif" src="${motif()}" alt="">
    <div class="caps" style="color:var(--link)">Safe to spend today</div>
    <div class="big fr">${big}</div>
    <div class="line">${usedUp ? "Everyday money is used up until payday. Bills and savings are still safe." : `${until} &middot; ${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"} left`} ${usedUp ? "" : "&middot; " + status}</div>
    ${empty ? "" : `<div class="todayrow"><span>${money(s.spentToday)} spent today</span><span>${leftTodayTxt}</span></div>
    <div class="bar"><i style="width:${pct(s.spentToday, s.safe || 1)}"></i></div>`}
    <button type="button" class="btn text small" style="margin-top:.7rem;padding-left:0" data-act="explain">How is this worked out?</button>
    <div class="mini">
      <div><span class="caps">Everyday left</span><b class="fr">${money(s.leftNow, "r")}</b></div>
      <div><span class="caps">Days left</span><b class="fr num">${s.daysLeft}</b></div>
      <div><span class="caps">Bills still due</span><b class="fr">${money(plan.billsLeft, "r")}</b><small>${plan.billsLeft > 0 ? "already set aside" : "all paid"}</small></div>
    </div>
  </section>`;
}

function nextCard() {
  const n = C.nextStep(app.S, app.today, fd);
  let acts = "";
  if (n.type === "bill") acts = `<button type="button" class="btn primary" data-act="bill-paid" data-key="${esc(n.item.key)}">Mark paid</button><button type="button" class="btn ghost" data-act="snooze" data-key="${esc(n.item.key)}">Later</button>`;
  if (n.type === "payday") acts = `<button type="button" class="btn primary" data-act="payday">Start</button>`;
  if (n.type === "wait") acts = `<button type="button" class="btn primary" data-act="wait-buy" data-id="${n.item.id}">Buy it</button><button type="button" class="btn ghost" data-act="wait-skip" data-id="${n.item.id}">Skip it</button>`;
  if (n.type === "backup") acts = `<button type="button" class="btn primary" data-act="backup">Back up now</button>`;
  if (n.type === "none") acts = `<button type="button" class="btn ghost" data-act="add-spend">Add a spend</button>`;
  const amount = n.amount != null ? ` &middot; ${money(n.amount)}` : "";
  const extra = n.type === "bill" ? " &middot; already set aside" : "";
  return `<section class="card next" aria-label="Your one next step">
    <div class="n">1</div>
    <div class="t"><span class="caps">Your one next step</span><b>${esc(n.title)}${amount}</b><span>${esc(n.when)}${extra}</span></div>
    <div class="acts">${acts}</div>
  </section>`;
}

function quickCard() {
  const tiles = app.S.quick.map(q => {
    const p = potById(q.potId);
    return `<button type="button" class="tile" data-act="quick" data-id="${q.id}"><span class="sq" style="background:${potColor(p)}"></span><b>${esc(q.label)}</b><span>${q.amount ? money(q.amount) : "any amount"}</span></button>`;
  }).join("");
  return `<section class="card">
    <h3>Quick add <small>one tap logs it</small><button type="button" class="act" data-act="edit-quick">Edit tiles</button></h3>
    <div class="quick">${tiles || `<div class="empty">Add tiles for the things you buy most.</div>`}</div>
    <div class="quickfoot"><button type="button" class="btn soft" data-act="afford">Can I afford it?</button><span class="small muted">Type a price and see what it does to your days until payday.</span></div>
  </section>`;
}

function periodCard(s) {
  const p = s.period, plan = s.plan;
  const paidBills = plan.billsTotal - plan.billsLeft;
  const title = p.irregular ? `This month <small>${fdShort(p.start)} &ndash; ${fdShort(p.end)}</small>` : `This pay period <small>${fdShort(p.start)} &ndash; ${fdShort(p.end)}</small>`;
  return `<section class="card s4">
    <h3>${title}</h3>
    <div class="fig"><b>Came in</b><span class="v">${money(plan.income, "r")}</span><div class="bar"><i style="width:100%;background:var(--good)"></i></div>${plan.carry ? `<span class="s">incl. ${money(plan.carry, "r")} carried over</span>` : plan.extraIn ? `<span class="s">incl. ${money(plan.extraIn, "r")} extra</span>` : ""}</div>
    <div class="fig"><b>Bills</b><span class="v">${money(plan.billsTotal, "r")}</span><div class="bar"><i style="width:${pct(paidBills, plan.billsTotal)}"></i></div><span class="s">${money(paidBills, "r")} paid &middot; ${money(plan.billsLeft, "r")} still to pay, set aside</span></div>
    <div class="fig"><b>Saving &amp; debt</b><span class="v">${money(plan.saving, "r")}</span><div class="bar"><i style="width:${plan.saving > 0 ? "100%" : "0"};background:var(--good)"></i></div><span class="s">${app.S.routineDone[p.start] ? "moved on payday" : "move it on payday"}</span></div>
    <div class="fig" style="margin-bottom:0"><b>Everyday</b><span class="v">${money(s.leftNow, "r")} left</span><div class="bar"><i style="width:${pct(s.spentToDate, plan.everyday)}"></i></div><span class="s">${money(s.spentToDate, "r")} of ${money(plan.everyday, "r")} used &middot; day ${s.dayIndex} of ${p.days}</span></div>
  </section>`;
}

function comingUp() {
  const to = C.addDays(app.today, 14);
  const rows = C.billItems(app.S, app.today, to, app.today).filter(b => !b.paid).map(b => ({ date: b.date, html: `<div class="row"><div class="date">${fdParts(b.date)}</div><div class="w">${esc(b.bill.name)}<small>${b.bill.autopay ? "autopay" : "set aside"}</small></div><div class="a">${money(b.amount)}</div></div>` }));
  if (app.S.pay.rhythm !== "irregular") {
    let p = C.periodOf(app.S.pay, app.today), g = 0;
    while (p.next <= to && g++ < 10) { rows.push({ date: p.next, html: `<div class="row pay"><div class="date">${fdParts(p.next)}</div><div class="w">Payday<small>plan the new period in 2 minutes</small></div><div class="a">+${money(app.S.pay.amount, "r")}</div></div>` }); p = C.nextPeriod(app.S.pay, p); }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return `<section class="card s4"><h3>Coming up <small>next 14 days</small><button type="button" class="act" data-act="ics">Add to my calendar</button></h3>
    <div class="list">${rows.slice(0, 6).map(r => r.html).join("") || `<div class="empty">Nothing due in the next two weeks.</div>`}</div></section>`;
}
export const fdParts = d => { const [w, ...rest] = fd(d).replace(",", "").split(" "); const day = C.parts(d)[2]; return `${esc(w)}<b>${day}</b>`; };

function dayChart(s) {
  const p = s.period, days = [];
  for (let d = p.start; d <= p.end; d = C.addDays(d, 1)) days.push(d);
  const W = 420, H = 150, gap = days.length > 20 ? 2 : 5, bw = (W - gap * (days.length - 1)) / days.length;
  const vals = days.map(d => C.spentIn(app.S, d, d));
  const planDay = s.plan.everyday / p.days;
  const max = Math.max(planDay * 1.6, ...vals, 1);
  const y = v => H - (v / max) * (H - 14);
  const bars = days.map((d, i) => {
    const x = i * (bw + gap), future = d > app.today, v = vals[i];
    const h = future ? 4 : Math.max(v > 0 ? 3 : 1.5, H - y(v));
    const fill = future ? "var(--track)" : d === app.today ? "var(--deep)" : "var(--accent)";
    const label = (days.length <= 16 || i % 2 === 0 || d === app.today) ? `<text x="${x + bw / 2}" y="${H + 15}" text-anchor="middle" font-size="10" font-weight="${d === app.today ? 900 : 700}" fill="${d === app.today ? "var(--deep)" : "var(--grey)"}">${C.parts(d)[2]}</text>` : "";
    return `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"><title>${fd(d)}: ${fmt(v)}</title></rect>${label}`;
  }).join("");
  const ly = y(planDay);
  const fmtFn = n => fmtR(n);
  return `<section class="card s4"><h3>Day by day <small>everyday spending</small></h3>
    <div class="chart"><svg viewBox="0 -4 ${W} ${H + 22}" role="img" aria-label="Spending per day this period">
      ${bars}
      ${planDay > 0 ? `<line x1="0" x2="${W}" y1="${ly}" y2="${ly}" stroke="var(--head)" stroke-width="1.5" stroke-dasharray="5 4" opacity=".55"/><text x="${W}" y="${ly - 6}" text-anchor="end" font-size="10.5" font-weight="800" fill="var(--head)">plan ${esc(fmtR(planDay))} a day</text>` : ""}
    </svg></div>
    <div class="note">${esc(C.paceNote(s, fmtFn))}</div></section>`;
}

function potsCard(s) {
  const p = s.period;
  const spends = C.txIn(app.S, p.start, p.end, "spend");
  const by = {};
  for (const t of spends) by[t.potId || "_"] = (by[t.potId || "_"] || 0) + t.amount;
  const rows = app.S.pots.map(pt => {
    const sp = by[pt.id] || 0, left = pt.budget - sp;
    return `<div class="pot">${sq(pt)}<b>${esc(pt.name)}</b><em>${money(sp, "r")} of ${money(pt.budget, "r")} &middot; ${left >= 0 ? `${money(left, "r")} left` : `${money(-left, "r")} over`}</em><div class="bar"><i style="width:${pct(sp, pt.budget)};background:${potColor(pt)}"></i></div></div>`;
  });
  const before = by["_before"] || 0;
  const loose = Object.entries(by).filter(([k]) => k !== "_before" && !app.S.pots.some(pt => pt.id === k)).reduce((a, [, v]) => a + v, 0);
  if (loose > 0) rows.push(`<div class="pot"><span class="sq" style="background:var(--soft)"></span><b>No pot</b><em>${money(loose, "r")}</em></div>`);
  if (before > 0) rows.push(`<p class="small muted" style="margin-top:.4rem">${money(before, "r")} was already spent this period before you started. It's counted in your number, not in the pots.</p>`);
  return `<section class="card s5"><h3>Pots <small>everyday money this period</small><button type="button" class="act" data-act="nav" data-view="plan">Plan</button></h3>${rows.join("") || `<div class="empty">No pots yet. Add some on the Plan page.</div>`}</section>`;
}

function goalsCard() {
  const S = app.S;
  const g = S.goals.map(x => {
    const saved = C.goalSaved(S, x), f = C.goalFinish(S, x, app.today);
    return `<div class="goal"><div class="t"><b>${esc(x.name)}</b><span>${money(saved, "r")} of ${money(x.target, "r")}</span></div><div class="bar"><i style="width:${pct(saved, x.target)};background:var(--good)"></i></div><div class="s">${f.done ? "Reached. Well done." : f.date ? `on track for ${fMonthYear(f.date)} at ${fmtR(x.perPeriod)} a payday` : "add an amount per payday to see a finish date"}</div></div>`;
  });
  const d = S.debts.map(x => {
    const left = C.debtLeft(S, x), f = C.debtFinish(S, x, app.today), paid = (Number(x.start) || 0) - left;
    return `<div class="goal"><div class="t"><b>${esc(x.name)}</b><span>${money(left, "r")} left</span></div><div class="bar"><i style="width:${pct(paid, x.start)};background:var(--p5)"></i></div><div class="s">${f.done ? "Paid off. Well done." : f.never ? "the payment doesn't cover the interest yet" : f.date ? `paid off by ${fMonthYear(f.date)}` : "add a payment per payday to see a date"}</div></div>`;
  });
  return `<section class="card s4"><h3>Saving for <small>${S.goals.length} ${S.goals.length === 1 ? "goal" : "goals"}${S.debts.length ? ` &middot; ${S.debts.length} ${S.debts.length === 1 ? "debt" : "debts"}` : ""}</small><button type="button" class="act" data-act="nav" data-view="goals">All</button></h3>${[...g, ...d].join("") || `<div class="empty">Add a goal or a debt to see when you'll get there.</div>`}</section>`;
}

function skippedCard() {
  const from = C.addDays(app.today, -30);
  const sk = app.S.skipped.filter(x => x.date >= from);
  const total = C.sum(sk, x => x.amount);
  const waiting = app.S.waitlist.filter(w => w.status === "waiting");
  return `<section class="card tint skipped s3"><h3>Skipped, not spent</h3>
    <div class="big fr">${money(total, "r")}</div>
    <p class="small" style="margin-top:.5rem;font-weight:700;color:var(--head)">${sk.length ? `${sk.length} ${sk.length === 1 ? "thing" : "things"} you checked and chose to skip in the last 30 days.` : `Use "Can I afford it?" before buying. Skipped buys add up here.`}</p>
    ${waiting.length ? `<p class="small" style="margin-top:.7rem;font-weight:700;color:var(--head)">Waiting: ${waiting.map(w => `${esc(w.name)} (${esc(fmtR(w.amount))}) until ${esc(fdShort(w.remindOn))}`).join(", ")}</p>` : ""}
  </section>`;
}

function footLine() {
  const lb = app.S.meta.lastBackup;
  const ago = lb ? C.diffDays(lb.slice(0, 10), app.today) : null;
  return `<div class="foot s12">
    <span><span class="dot"></span>Saved on this device &middot; works offline</span>
    <span>Last backup: ${ago == null ? "not yet" : ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`} &middot; <button type="button" data-act="backup">Back up now</button></span>
    <span><button type="button" data-act="move-phone">Move to my phone</button></span>
    <span style="margin-left:auto"><button type="button" data-act="import-bank">Import bank statement</button> &middot; <button type="button" data-act="export-csv">Export to Sheets / Excel</button></span>
  </div>`;
}

function today() {
  const s = C.safeToSpend(app.S, app.today);
  const name = app.S.profile.name ? `Hi ${esc(app.S.profile.name)}, here's your <em class="it">day.</em>` : `Here's your <em class="it">day.</em>`;
  return `<div class="hello"><div><div class="caps">${esc(fdLong(app.today))}</div><h1 class="fr">${name}</h1></div><div class="script">one calm number at a time</div></div>
  <div class="grid">
    ${hero(s)}
    <div class="stack s7">${nextCard()}${quickCard()}</div>
    ${periodCard(s)}${comingUp()}${dayChart(s)}
    ${potsCard(s)}${goalsCard()}${skippedCard()}
    ${footLine()}
  </div>`;
}

// ---------------- PLAN ----------------
function plan() {
  const S = app.S;
  let p = C.periodOf(S.pay, app.today);
  const off = app.planOffset || 0;
  for (let i = 0; i < off; i++) p = C.nextPeriod(S.pay, p);
  for (let i = 0; i > off; i--) p = C.prevPeriod(S.pay, p);
  const pl = C.planFor(S, p, app.today);
  const label = off === 0 ? (p.irregular ? "This month" : "This pay period") : off > 0 ? (off === 1 ? "Next period" : `In ${off} periods`) : (off === -1 ? "Last period" : `${-off} periods ago`);
  const incomeTx = C.txIn(S, p.start, p.end, "income");
  const spends = C.txIn(S, p.start, p.end, "spend");
  const by = {}; for (const t of spends) by[t.potId || "_"] = (by[t.potId || "_"] || 0) + t.amount;
  return `<h1 class="page-title fr">Plan</h1>
  <p class="page-sub">Where each payday's money goes. Bills and saving come off first; what's left is your everyday money, shared out into pots.</p>
  <div class="tabs-in"><button type="button" class="btn ghost small" data-act="plan-off" data-d="-1" aria-label="Earlier period">&larr;</button><span class="chip">${label}: ${esc(fdShort(p.start))} &ndash; ${esc(fdShort(p.end))}</span><button type="button" class="btn ghost small" data-act="plan-off" data-d="1" aria-label="Later period">&rarr;</button>${off ? `<button type="button" class="btn text small" data-act="plan-off" data-d="0">Back to now</button>` : ""}</div>
  <div class="grid">
    <section class="card s7">
      <h2>Money in</h2>
      ${p.irregular ? `<div class="sumline"><span>Money that has come in</span><span class="fr">${money(pl.extraIn)}</span></div>` :
        `<div class="sumline"><span>Pay on ${esc(fd(p.start))}${S.periodIncome[p.start] != null ? ` <span class="pill">changed</span>` : ""}</span><span><span class="fr">${money(pl.pay)}</span> <button type="button" class="btn text small" data-act="edit-period-pay" data-start="${p.start}">Change</button></span></div>`}
      ${pl.carry ? `<div class="sumline"><span>Carried over from last period</span><span class="fr">${money(pl.carry)}</span></div>` : ""}
      ${incomeTx.map(t => `<div class="sumline"><span>${esc(t.note || "Money in")} <span class="muted small">${esc(fdShort(t.date))}</span></span><span><span class="fr">${money(t.amount)}</span> <button type="button" class="btn text small" data-act="edit-income" data-id="${t.id}">Edit</button></span></div>`).join("")}
      <div style="margin:.6rem 0 1.3rem"><button type="button" class="btn soft small" data-act="add-income">+ Money in (gift, refund, side job${p.irregular ? ", shift pay" : ""})</button></div>
      <h2>Bills <small>${pl.bills.length} this period</small><button type="button" class="act" data-act="nav" data-view="bills">All bills</button></h2>
      <table class="tbl hide-sm"><thead><tr><th>Due</th><th>Bill</th><th>Status</th><th class="r">Amount</th></tr></thead><tbody>
      ${pl.bills.map(b => `<tr><td>${esc(fd(b.date))}</td><td>${esc(b.bill.name)}</td><td>${b.paid ? `<span class="pill good">paid</span>` : b.overdue ? `<span class="pill">was due</span>` : `<span class="pill">to pay</span>`}</td><td class="r">${money(b.amount)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No bills due in this period.</td></tr>`}
      </tbody></table>
      <h2 style="margin-top:1.3rem">Saving &amp; debt <small>moved each payday</small><button type="button" class="act" data-act="nav" data-view="goals">Goals &amp; debts</button></h2>
      ${S.goals.filter(g => Number(g.perPeriod) > 0 && C.goalSaved(S, g) < g.target).map(g => `<div class="sumline"><span>${esc(g.name)}</span><span class="fr">${money(g.perPeriod)}</span></div>`).join("")}
      ${S.debts.filter(d => Number(d.perPeriod) > 0 && C.debtLeft(S, d) > 0).map(d => `<div class="sumline"><span>${esc(d.name)} <span class="muted small">payment</span></span><span class="fr">${money(d.perPeriod)}</span></div>`).join("")}
      ${pl.saving === 0 ? `<p class="small muted" style="margin:.3rem 0">Nothing set aside yet. Even a small amount each payday adds up.</p>` : ""}
      <div class="sumline total"><span>Everyday money</span><span class="fr">${money(pl.everyday)}</span></div>
      <p class="small muted" style="margin-top:.4rem">${money(pl.income)} in &minus; ${money(pl.billsTotal)} bills &minus; ${money(pl.saving)} saving &amp; debt</p>
    </section>
    <section class="card s5">
      <h2>Pots <small>share out your everyday money</small><button type="button" class="act" data-act="edit-pots">Edit pots</button></h2>
      ${S.pots.map(pt => { const sp = by[pt.id] || 0; return `<div class="pot">${sq(pt)}<b>${esc(pt.name)}</b><em>${money(pt.budget, "r")}${off <= 0 ? ` &middot; ${money(sp, "r")} used` : ""}</em><div class="bar"><i style="width:${pct(sp, pt.budget)};background:${potColor(pt)}"></i></div></div>`; }).join("") || `<div class="empty">No pots yet.</div>`}
      <div class="sumline total"><span>In pots</span><span class="fr">${money(pl.potsTotal)}</span></div>
      ${Math.abs(pl.unassigned) >= 1 ? `<div class="boxnote" style="margin-top:.8rem">${pl.unassigned > 0 ? `${money(pl.unassigned)} of your everyday money isn't in a pot yet. It still counts in your safe-to-spend number.` : `Your pots add up to ${money(-pl.unassigned)} more than your everyday money. Your safe-to-spend number goes by the real money, so you're safe, but the pots won't all fit.`}<div style="margin-top:.6rem"><button type="button" class="btn soft small" data-act="fit-pots">${pl.unassigned > 0 ? "Share it out over my pots" : "Shrink my pots to fit"}</button></div></div>` : `<p class="small" style="margin-top:.6rem;color:var(--good);font-weight:800">Every bit of everyday money has a pot.</p>`}
      <h2 style="margin-top:1.4rem">Pay <small>${esc(C.RHYTHMS[S.pay.rhythm]?.label || "")}</small><button type="button" class="act" data-act="edit-pay">Change</button></h2>
      <p class="small muted">${S.pay.rhythm === "irregular" ? "Your plan uses money that has actually come in this month. Log pay as it lands." : `Usually ${esc(fmt(S.pay.amount))}. Next payday ${esc(fd(C.periodOf(S.pay, app.today).next))}.`}</p>
    </section>
  </div>`;
}

// ---------------- BILLS ----------------
const howOften = b => b.freq === "monthly" ? `Monthly on the ${ordinal(b.day)}` : b.freq === "weekly" ? `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][b.weekday ?? 1]}` : b.freq === "perPeriod" ? "Every payday" : b.freq === "yearly" ? `Yearly on ${fdShort("2027-" + (b.date || "01-01"))}` : `Once, ${fdShort(b.date)}`;
export const ordinal = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

function bills() {
  const S = app.S;
  const p = C.periodOf(S.pay, app.today);
  const items = C.billItems(S, p.start, C.addDays(app.today, 45) > p.end ? C.addDays(app.today, 45) : p.end, app.today);
  const monthlyTotal = C.sum(S.bills, b => b.freq === "monthly" ? b.amount : b.freq === "weekly" ? b.amount * 52 / 12 : b.freq === "yearly" ? b.amount / 12 : b.freq === "perPeriod" ? b.amount * (365 / 12) / (p.days || 30) : 0);
  return `<h1 class="page-title fr">Bills</h1>
  <p class="page-sub">Everything that leaves on a schedule. Bills come off before your everyday money, so they're always covered first.</p>
  <div class="grid">
    <section class="card s7">
      <h2>Due soon <small>this period and the next few weeks</small><button type="button" class="act" data-act="ics">Add to my phone calendar</button></h2>
      <div class="list">${items.map(b => `<div class="row${b.paid ? " paid" : ""}${b.overdue ? " over" : ""}"><div class="date">${fdParts(b.date)}</div><div class="w">${esc(b.bill.name)}<small>${b.paid ? (b.bill.autopay ? "paid by autopay" : "paid") : b.overdue ? "was due, not marked paid" : b.bill.autopay ? "autopay" : "to pay"}</small></div><div class="a">${money(b.amount)}</div>${b.bill.autopay && b.paid ? "" : `<button type="button" class="btn ${b.paid ? "text" : "soft"} small" data-act="bill-toggle" data-key="${esc(b.key)}">${b.paid ? "Undo" : "Mark paid"}</button>`}</div>`).join("") || `<div class="empty">No bills yet.</div>`}</div>
    </section>
    <section class="card s5">
      <h2>All bills <small>about ${money(monthlyTotal, "r")} a month</small></h2>
      <div class="list">${S.bills.map(b => `<div class="row"><div class="w">${esc(b.name)}<small>${esc(howOften(b))}${b.autopay ? " &middot; autopay" : ""}</small></div><div class="a">${money(b.amount)}</div><button type="button" class="btn text small" data-act="edit-bill" data-id="${b.id}">Edit</button></div>`).join("") || `<div class="empty">Add rent, phone, subscriptions, insurance&hellip;</div>`}</div>
      <div style="margin-top:.9rem;display:flex;gap:.5rem;flex-wrap:wrap"><button type="button" class="btn primary" data-act="edit-bill">+ Add a bill</button></div>
      <p class="small muted" style="margin-top:.9rem">Paying off a card or loan? Add it under Goals &amp; debts instead, so you see the payoff date.</p>
    </section>
  </div>`;
}

// ---------------- GOALS & DEBTS ----------------
function goals() {
  const S = app.S;
  const g = S.goals.map(x => {
    const saved = C.goalSaved(S, x), f = C.goalFinish(S, x, app.today);
    return `<section class="card s4"><h3>${esc(x.name)}<button type="button" class="act" data-act="edit-goal" data-id="${x.id}">Edit</button></h3>
      <div class="fr" style="font-size:2rem;color:var(--head)">${money(saved, "r")} <span class="small muted" style="font-family:Nunito">of ${money(x.target, "r")}</span></div>
      <div class="bar" style="margin:.6rem 0"><i style="width:${pct(saved, x.target)};background:var(--good)"></i></div>
      <p class="small muted">${f.done ? "Reached. Well done." : f.date ? `${money(x.perPeriod)} each payday &middot; there by ${esc(fMonthYear(f.date))}` : "Add an amount per payday to see a finish date."}</p>
      <div style="margin-top:.8rem;display:flex;gap:.5rem;flex-wrap:wrap"><button type="button" class="btn soft small" data-act="goal-add" data-id="${x.id}">+ Add money</button><button type="button" class="btn text small" data-act="goal-take" data-id="${x.id}">Take money out</button></div>
    </section>`;
  });
  const d = S.debts.map(x => {
    const left = C.debtLeft(S, x), f = C.debtFinish(S, x, app.today);
    return `<section class="card s4"><h3>${esc(x.name)} <small>${Number(x.rate) || 0}% a year</small><button type="button" class="act" data-act="edit-debt" data-id="${x.id}">Edit</button></h3>
      <div class="fr" style="font-size:2rem;color:var(--head)">${money(left, "r")} <span class="small muted" style="font-family:Nunito">left</span></div>
      <div class="bar" style="margin:.6rem 0"><i style="width:${pct((Number(x.start) || 0) - left, x.start)};background:var(--p5)"></i></div>
      <p class="small muted">${f.done ? "Paid off. Well done." : f.never ? "The payment doesn't cover the interest yet. Try a bigger payment." : f.date ? `${money(x.perPeriod)} each payday &middot; paid off by ${esc(fMonthYear(f.date))}${f.interest ? `, about ${esc(fmtR(f.interest))} interest on the way` : ""}` : "Add a payment per payday to see a payoff date."}</p>
      <div style="margin-top:.8rem;display:flex;gap:.5rem;flex-wrap:wrap"><button type="button" class="btn soft small" data-act="debt-pay" data-id="${x.id}">+ Log a payment</button></div>
    </section>`;
  });
  const waiting = S.waitlist.filter(w => w.status === "waiting");
  const sk = [...S.skipped].sort((a, b) => b.date.localeCompare(a.date));
  return `<h1 class="page-title fr">Goals &amp; debts</h1>
  <p class="page-sub">Money you set aside on payday, and debts you're paying down. Finish dates update as you go.</p>
  <div class="grid">
    ${g.join("")}
    <section class="card s4" style="display:flex;flex-direction:column;justify-content:center;gap:.6rem;align-items:flex-start"><h3>Add a goal</h3><p class="small muted">Emergency fund, a trip, a new laptop, Christmas&hellip;</p><button type="button" class="btn primary" data-act="edit-goal">+ New goal</button></section>
    ${d.join("")}
    <section class="card s4" style="display:flex;flex-direction:column;justify-content:center;gap:.6rem;align-items:flex-start"><h3>Add a debt</h3><p class="small muted">Credit card, student loan, buy-now-pay-later&hellip;</p><button type="button" class="btn ghost" data-act="edit-debt">+ New debt</button></section>
    <section class="card s6"><h3>Waiting until payday <small>from "Can I afford it?"</small></h3>
      <div class="list">${waiting.map(w => `<div class="row"><div class="w">${esc(w.name)}<small>decide on ${esc(fd(w.remindOn))}</small></div><div class="a">${money(w.amount)}</div><button type="button" class="btn soft small" data-act="wait-buy" data-id="${w.id}">Buy</button><button type="button" class="btn text small" data-act="wait-skip" data-id="${w.id}">Skip</button></div>`).join("") || `<div class="empty">Nothing waiting.</div>`}</div>
    </section>
    <section class="card s6"><h3>Skipped, not spent <small>${money(C.sum(sk, x => x.amount), "r")} so far</small></h3>
      <div class="list">${sk.slice(0, 8).map(x => `<div class="row"><div class="w">${esc(x.name)}<small>${esc(fd(x.date))}</small></div><div class="a">${money(x.amount)}</div></div>`).join("") || `<div class="empty">Things you skip after checking show up here.</div>`}</div>
    </section>
  </div>`;
}

// ---------------- LOOK BACK ----------------
function donut(entries, total) {
  if (total <= 0) return `<div class="empty">No spending this month yet.</div>`;
  let a = -Math.PI / 2; const R = 70, r = 46, cx = 80, cy = 80;
  const arcs = entries.map(([pot, v]) => {
    const ang = (v / total) * Math.PI * 2, a2 = a + ang, large = ang > Math.PI ? 1 : 0;
    const p = (rad, rr) => `${(cx + rr * Math.cos(rad)).toFixed(2)} ${(cy + rr * Math.sin(rad)).toFixed(2)}`;
    const d = ang >= Math.PI * 2 - 1e-6 ? `M ${p(a, R)} A ${R} ${R} 0 1 1 ${p(a + Math.PI, R)} A ${R} ${R} 0 1 1 ${p(a, R)} M ${p(a, r)} A ${r} ${r} 0 1 0 ${p(a + Math.PI, r)} A ${r} ${r} 0 1 0 ${p(a, r)} Z`
      : `M ${p(a, R)} A ${R} ${R} 0 ${large} 1 ${p(a2, R)} L ${p(a2, r)} A ${r} ${r} 0 ${large} 0 ${p(a, r)} Z`;
    a = a2;
    return `<path d="${d}" fill="${potColor(pot)}" fill-rule="evenodd"><title>${esc(pot?.name || (pot === null ? "Before Sweet Spot" : "No pot"))}: ${fmt(v)}</title></path>`;
  }).join("");
  return `<svg viewBox="0 0 160 160" style="width:11rem;max-width:45%;flex:none" role="img" aria-label="Where it went">${arcs}<text x="80" y="78" text-anchor="middle" font-size="17" font-weight="800" font-family="Fraunces, serif" fill="var(--head)">${esc(fmtR(total))}</text><text x="80" y="95" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--grey)">spent</text></svg>`;
}

function lookback() {
  const S = app.S;
  const ym = app.lookMonth || C.monthKey(app.today);
  const m = C.monthSummary(S, ym, app.today);
  const entries = Object.entries(m.byPot).map(([id, v]) => [id === "_before" ? null : potById(id), v]).sort((a, b) => b[1] - a[1]);
  const [y, mo] = ym.split("-").map(Number);
  const first = C.iso(y, mo, 1), dim = C.daysInMonth(y, mo), lead = (C.weekday(first) + 6) % 7;
  const maxDay = Math.max(1, ...Object.values(m.byDay));
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(`<div></div>`);
  for (let d = 1; d <= dim; d++) {
    const date = C.iso(y, mo, d), v = m.byDay[date] || 0, future = date > app.today;
    const mix = future ? 0 : v <= 0 ? 0 : 18 + Math.round((v / maxDay) * 72);
    const bg = future ? "transparent" : v <= 0 ? "color-mix(in srgb, var(--good) 16%, var(--card))" : `color-mix(in srgb, var(--accent) ${mix}%, var(--card))`;
    cells.push(`<div style="background:${bg};${future ? "border:1px dashed var(--hair);" : ""}color:${mix > 60 ? "#fff" : "var(--head)"}" title="${esc(fd(date))}: ${esc(fmt(v))}">${d}</div>`);
  }
  const year = C.yearSummary(S, y, app.today).filter(x => x.started);
  const maxY = Math.max(1, ...year.map(x => Math.max(x.income, x.spent + x.bills + x.saved)));
  const bw = 22, gap = 12, H = 130;
  const ybars = year.map((x, i) => {
    const X = i * (bw * 2 + gap + 4);
    const hi = (x.income / maxY) * H, ho = ((x.spent + x.bills) / maxY) * H, hs = (x.saved / maxY) * H;
    return `<rect x="${X}" y="${H - hi}" width="${bw}" height="${hi}" fill="var(--good)" opacity=".75"><title>${fMonth(x.ym)} in: ${fmt(x.income)}</title></rect>
      <rect x="${X + bw + 2}" y="${H - ho - hs}" width="${bw}" height="${hs}" fill="var(--p2)" opacity=".55"><title>saved: ${fmt(x.saved)}</title></rect>
      <rect x="${X + bw + 2}" y="${H - ho}" width="${bw}" height="${ho}" fill="var(--accent)"><title>${fMonth(x.ym)} out: ${fmt(x.spent + x.bills)}</title></rect>
      <text x="${X + bw + 1}" y="${H + 15}" text-anchor="middle" font-size="10.5" font-weight="${x.ym === ym ? 900 : 700}" fill="${x.ym === ym ? "var(--deep)" : "var(--grey)"}">${esc(fMonthShort(x.ym))}</text>`;
  }).join("");
  const full = year.filter(x => x.ym < C.monthKey(app.today));
  const best = full.length ? full.reduce((a, b) => (b.left > a.left ? b : a)) : null;
  const hard = full.length ? full.reduce((a, b) => (b.left < a.left ? b : a)) : null;
  const txs = C.txIn(S, m.from, m.to).filter(t => t.kind !== "save" && t.kind !== "debt").sort((a, b) => b.date.localeCompare(a.date) || 0);
  return `<h1 class="page-title fr">Look back</h1>
  <p class="page-sub">Where the money went, month by month. No judging, just the picture.</p>
  <div class="tabs-in"><button type="button" class="btn ghost small" data-act="look-month" data-d="-1" aria-label="Earlier month">&larr;</button><span class="chip">${esc(fMonth(ym))}</span><button type="button" class="btn ghost small" data-act="look-month" data-d="1" aria-label="Later month"${ym >= C.monthKey(app.today) ? " disabled" : ""}>&rarr;</button></div>
  <div class="kpis">
    <div class="card kpi"><span class="caps">Came in</span><b>${money(m.income, "r")}</b></div>
    <div class="card kpi"><span class="caps">Everyday spending</span><b>${money(m.spent, "r")}</b></div>
    <div class="card kpi"><span class="caps">Bills</span><b>${money(m.bills, "r")}</b></div>
    <div class="card kpi"><span class="caps">Saved &amp; paid off</span><b>${money(m.saved, "r")}</b><small>${m.left >= 0 ? `${esc(fmtR(m.left))} left over` : `${esc(fmtR(-m.left))} more out than in`}${m.current ? " so far" : ""}</small></div>
  </div>
  <div class="grid">
    <section class="card s5"><h3>Where it went</h3><div style="display:flex;gap:1.2rem;align-items:center;flex-wrap:wrap">${donut(entries, m.spent)}<div class="legend" style="flex-direction:column;flex:1;min-width:9rem">${entries.map(([pt, v]) => `<span>${sq(pt)}<b style="color:var(--head)">${esc(pt?.name || (pt === null ? "Before Sweet Spot" : "No pot"))}</b><span class="muted" style="margin-left:auto">${money(v, "r")} &middot; ${Math.round(v / m.spent * 100)}%</span></span>`).join("")}</div></div></section>
    <section class="card s3"><h3>Money quilt <small>each day</small></h3><div class="quilt">${["M", "T", "W", "T", "F", "S", "S"].map(d => `<div class="wd">${d}</div>`).join("")}${cells.join("")}</div><p class="small muted" style="margin-top:.6rem">Darker = more spent. Green = nothing spent.</p></section>
    <section class="card s4"><h3>${y} so far</h3><div class="chart"><svg viewBox="0 -6 ${Math.max(1, year.length) * (bw * 2 + gap + 4)} ${H + 22}" role="img" aria-label="Money in and out by month">${ybars}</svg></div>
      <div class="legend"><span><span class="sq" style="background:var(--good);opacity:.75"></span>in</span><span><span class="sq" style="background:var(--accent)"></span>spending + bills</span><span><span class="sq" style="background:var(--p2);opacity:.55"></span>saved</span></div>
      ${best && full.length > 1 ? `<p class="small" style="margin-top:.7rem;font-weight:700;color:var(--head)">Best month: ${esc(fMonth(best.ym))} (${esc(fmtR(best.left))} left over). Hardest: ${esc(fMonth(hard.ym))}.</p>` : ""}
    </section>
    <section class="card s12"><h3>Everything in ${esc(fMonth(ym))} <small>${txs.length} ${txs.length === 1 ? "entry" : "entries"}</small><button type="button" class="act" data-act="export-csv">Export</button></h3>
      <table class="tbl hide-sm"><thead><tr><th>Date</th><th>What</th><th>Pot</th><th class="r">Amount</th><th></th></tr></thead><tbody>
      ${txs.slice(0, 120).map(t => { const pt = potById(t.potId); return `<tr><td>${esc(fdShort(t.date))}</td><td>${esc(t.note || (t.kind === "income" ? "Money in" : "Spend"))}</td><td>${t.kind === "income" ? `<span class="pill good">money in</span>` : `${sq(pt)} ${esc(pt?.name || "No pot")}`}</td><td class="r">${t.kind === "income" ? "+" : ""}${money(t.amount)}</td><td class="r"><button type="button" class="btn text small" data-act="${t.kind === "income" ? "edit-income" : "edit-spend"}" data-id="${t.id}">Edit</button></td></tr>`; }).join("") || `<tr><td colspan="5" class="muted">Nothing logged this month.</td></tr>`}
      </tbody></table>${txs.length > 120 ? `<p class="small muted" style="margin-top:.5rem">Showing the latest 120. Export to see everything.</p>` : ""}
    </section>
  </div>`;
}

// ---------------- SETTINGS ----------------
function settings() {
  const P = app.S.profile;
  const seg = (act, val, opts) => `<div class="seg">${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(val) === String(v)}">${l}</button>`).join("")}</div>`;
  return `<h1 class="page-title fr">Settings</h1>
  <p class="page-sub">Your look, your pay, and your data. Everything stays on this device.</p>
  <div class="grid">
    <section class="card s6"><h2>Look</h2>
      <div class="field"><span>Colours</span>${seg("set-look", P.look, Object.entries(LOOKS))}</div>
      <div class="field"><span>Dark mode</span>${seg("set-dark", P.dark, [["auto", "Match my phone"], ["off", "Light"], ["on", "Dark"]])}</div>
      <div class="field"><span>Reading</span>
        <button type="button" class="toggle" data-act="set-big" aria-pressed="${P.bigText}"><i></i>Bigger text</button><br>
        <button type="button" class="toggle" data-act="set-easy" aria-pressed="${P.easyFont}"><i></i>Easy-reading font</button><br>
        <button type="button" class="toggle" data-act="toggle-hide" aria-pressed="${P.hideAmounts}"><i></i>Hide amounts (blur numbers in public)</button>
      </div>
    </section>
    <section class="card s6"><h2>You and your pay</h2>
      <form data-form="profile">
        <label class="field"><span>Your name (optional)</span><input class="input" name="name" value="${esc(P.name)}" autocomplete="given-name"></label>
        <div class="row2">
          <label class="field"><span>Currency</span><select class="input" name="currency">${currencyOptions(P.currency)}</select></label>
          <label class="field"><span>Number and date style</span><select class="input" name="locale">${localeOptions(P.locale)}</select></label>
        </div>
        <button class="btn primary" type="submit">Save</button>
      </form>
      <div class="sumline" style="margin-top:1rem"><span>Pay: ${esc(C.RHYTHMS[app.S.pay.rhythm]?.label || "")}${app.S.pay.rhythm !== "irregular" ? `, ${esc(fmt(app.S.pay.amount))}` : ""}</span><button type="button" class="btn text small" data-act="edit-pay">Change</button></div>
      <div class="sumline"><span>Quick add tiles</span><button type="button" class="btn text small" data-act="edit-quick">Edit</button></div>
      <div class="sumline"><span>Pots</span><button type="button" class="btn text small" data-act="edit-pots">Edit</button></div>
    </section>
    <section class="card s6"><h2>Your data <small>only on this device</small></h2>
      <div class="sumline"><span>Back up<span class="sub muted small" style="display:block;font-weight:600">A small file you can keep in Files, Drive or email. Do it weekly.</span></span><button type="button" class="btn soft small" data-act="backup">Back up now</button></div>
      <div class="sumline"><span>Restore from a backup</span><button type="button" class="btn text small" data-act="restore">Choose file</button></div>
      <div class="sumline"><span>Move to my phone or laptop</span><button type="button" class="btn text small" data-act="move-phone">How</button></div>
      <div class="sumline"><span>Import a bank statement (CSV)</span><button type="button" class="btn text small" data-act="import-bank">Import</button></div>
      <div class="sumline"><span>Export spends for Google Sheets / Excel</span><button type="button" class="btn text small" data-act="export-csv">Export</button></div>
      <div class="sumline"><span>Bills and paydays in my phone calendar</span><button type="button" class="btn text small" data-act="ics">Get file</button></div>
    </section>
    <section class="card s6"><h2>Help</h2>
      <div class="sumline"><span>Put Sweet Spot on my home screen</span><button type="button" class="btn text small" data-act="install-help">Show me</button></div>
      <div class="sumline"><span>How "safe to spend" is worked out</span><button type="button" class="btn text small" data-act="explain">Explain</button></div>
      <div class="sumline"><span>Catch up after a break</span><button type="button" class="btn text small" data-act="welcome-back">Open</button></div>
      <div class="sumline"><span>Questions or ideas</span><a class="btn text small" href="${ETSY_URL}" target="_blank" rel="noopener">Message Dear Agneta</a></div>
      ${app.demo ? "" : `<div class="sumline"><span>Start over (erase everything on this device)</span><button type="button" class="btn danger small" data-act="erase">Erase</button></div>`}
      <p class="small muted" style="margin-top:.8rem">Sweet Spot ${APP_VERSION} &middot; by Dear Agneta &middot; no account, no tracking, works offline.</p>
    </section>
  </div>`;
}

export function currencyOptions(cur) {
  const list = [...CURRENCIES];
  if (!list.some(([c]) => c === cur)) list.unshift([cur, cur]);
  return list.map(([c, l]) => `<option value="${c}"${c === cur ? " selected" : ""}>${esc(l)}</option>`).join("");
}
const LOCALES = [["en-US", "1,234.56 · Nov 20"], ["en-GB", "1,234.56 · 20 Nov"], ["en-IE", "1,234.56 · 20 Nov (Ireland)"], ["en-CA", "1,234.56 · Nov 20 (Canada)"], ["en-AU", "1,234.56 · 20 Nov (Australia)"], ["de-DE", "1.234,56 · 20. Nov."], ["fr-FR", "1 234,56 · 20 nov."], ["nl-NL", "1.234,56 · 20 nov"], ["es-ES", "1234,56 · 20 nov"], ["it-IT", "1.234,56 · 20 nov"], ["lt-LT", "1 234,56 · lapkr. 20"], ["pl-PL", "1 234,56 · 20 lis"], ["sv-SE", "1 234,56 · 20 nov."]];
export function localeOptions(cur) {
  const list = LOCALES.some(([l]) => l === cur) ? LOCALES : [[cur, cur], ...LOCALES];
  return list.map(([l, d]) => `<option value="${l}"${l === cur ? " selected" : ""}>${esc(d)}</option>`).join("");
}

function more() {
  return `<h1 class="page-title fr">More</h1>
  <div class="stack">
    <button type="button" class="opt" data-act="nav" data-view="goals"><div class="t"><b>Goals &amp; debts</b></div><small>Savings goals, payoff dates, things you skipped</small></button>
    <button type="button" class="opt" data-act="nav" data-view="lookback"><div class="t"><b>Look back</b></div><small>Where the money went, month by month</small></button>
    <button type="button" class="opt" data-act="afford"><div class="t"><b>Can I afford it?</b></div><small>Check a price before you buy</small></button>
    <button type="button" class="opt" data-act="nav" data-view="settings"><div class="t"><b>Settings</b></div><small>Look, pay, backup, import, export, help</small></button>
    ${!isStandalone() && isIOS() ? `<button type="button" class="opt" data-act="install-help"><div class="t"><b>Put it on my home screen</b></div><small>So it opens like an app and keeps your data safe</small></button>` : ""}
  </div>`;
}

export const views = { today, plan, bills, goals, lookback, settings, more };
