// Sweet Spot — everything that opens in a sheet, plus unlock and the 60-second setup.
import * as C from "./calc.js";
import { app, actions, forms, live, esc, money, fmt, fmtR, fmtDown, fd, fdShort, fMonthYear, potById, potColor, sq, parseMoney, symbol,
  commit, render, toast, openSheet, updateSheet, closeSheet, sheetHead, shareOrDownload, pickFile, isIOS, isStandalone } from "./core.js";
import { uid, blankState, defaultPots, defaultQuick, normalise, LOOKS, BILL_IDEAS, CURRENCIES } from "./model.js";
import { currencyOptions, localeOptions, ordinal, ETSY_URL } from "./views.js";
import { parseCSV, guessColumns, guessDateFormat, toISODate, toNumber, shopKey, guessPot } from "./csv.js";
import { buildICS } from "./ics.js";
import * as store from "./store.js";

const S = () => app.S;
const num = v => { const n = parseMoney(v); return isFinite(n) ? C.round2(n) : NaN; };
const val = (form, name) => form.elements[name]?.value ?? "";
const amountInput = (name, value, extra = "") => `<div style="display:flex;align-items:baseline;justify-content:center;gap:.2rem"><span class="fr" style="font-size:2.2rem;color:var(--head)">${esc(symbol())}</span><input name="${name}" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${value ?? ""}" style="width:6.5ch" aria-label="Amount" ${extra}></div>`;
const potOptions = (sel, extra = "") => S().pots.map(p => `<option value="${p.id}"${p.id === sel ? " selected" : ""}>${esc(p.name)}</option>`).join("") + extra;
const nextPaydayOrWeek = () => S().pay.rhythm === "irregular" ? C.addDays(app.today, 7) : C.periodOf(S().pay, app.today).next;

// ============ Navigation and toggles ============
actions["nav"] = el => { app.view = el.dataset.view; if (app.view !== "plan") app.planOffset = 0; render(); scrollTo({ top: 0 }); };
actions["close-sheet"] = () => closeSheet();
actions["toggle-hide"] = () => commit(s => { s.profile.hideAmounts = !s.profile.hideAmounts; applyLook(); });
actions["set-look"] = el => commit(s => { s.profile.look = el.dataset.v; applyLook(); });
actions["set-dark"] = el => commit(s => { s.profile.dark = el.dataset.v; applyLook(); });
actions["set-big"] = () => commit(s => { s.profile.bigText = !s.profile.bigText; applyLook(); });
actions["set-easy"] = () => commit(s => { s.profile.easyFont = !s.profile.easyFont; applyLook(); });
actions["plan-off"] = el => { const d = Number(el.dataset.d); app.planOffset = d === 0 ? 0 : (app.planOffset || 0) + d; render(); };
actions["look-month"] = el => {
  const [y, m] = (app.lookMonth || C.monthKey(app.today)).split("-").map(Number);
  const [ny, nm] = C.addMonths(y, m, Number(el.dataset.d));
  const k = `${ny}-${C.pad(nm)}`;
  if (k <= C.monthKey(app.today)) { app.lookMonth = k; render(); }
};

export function applyLook() {
  const P = S()?.profile || {}, h = document.documentElement;
  h.dataset.look = P.look in LOOKS ? P.look : "strawberry";
  const dark = P.dark === "on" || (P.dark === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  dark ? h.setAttribute("data-dark", "") : h.removeAttribute("data-dark");
  P.bigText ? h.setAttribute("data-big", "") : h.removeAttribute("data-big");
  P.easyFont ? h.setAttribute("data-easy", "") : h.removeAttribute("data-easy");
  P.hideAmounts ? h.setAttribute("data-hide", "") : h.removeAttribute("data-hide");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(h).getPropertyValue("--card").trim() || "#FFFFFF";
}

// ============ Add a spend ============
let spendPot = null;
export function addSpendSheet({ tx = null, potId = null, amount = "", note = "", date = null } = {}) {
  spendPot = tx?.potId ?? potId ?? S().pots[0]?.id ?? null;
  const s = C.safeToSpend(S(), app.today);
  const p = s.period, by = {};
  for (const t of C.txIn(S(), p.start, p.end, "spend")) if (t.id !== tx?.id) by[t.potId] = (by[t.potId] || 0) + t.amount;
  const pots = S().pots.map(pt => `<button type="button" class="potbtn" data-act="pick-pot" data-id="${pt.id}" aria-pressed="${pt.id === spendPot}"><span class="sq" style="background:${potColor(pt)}"></span>${esc(pt.name)}<small>${esc(fmtR(pt.budget - (by[pt.id] || 0)))} left</small></button>`).join("");
  openSheet(`${sheetHead(tx ? "Edit spend" : "Add a spend", "Cancel")}
    <form data-form="spend" data-id="${tx?.id || ""}">
      <div class="amount">${amountInput("amount", tx ? tx.amount : amount, 'data-live="spend-amt" autofocus')}<small id="spend-left"></small></div>
      <div class="pots" role="group" aria-label="Pot">${pots}<button type="button" class="potbtn" data-act="new-pot-inline" style="color:var(--link)"><span class="sq" style="background:var(--soft)"></span>+ New pot<small>any time</small></button></div>
      <label class="field"><span>What was it? <span class="muted">(optional)</span></span><input class="input" name="note" value="${esc(tx?.note ?? note)}" autocomplete="off"></label>
      <label class="field"><span>When</span><input class="input" type="date" name="date" value="${tx?.date || date || app.today}" max="${C.addDays(app.today, 366)}"></label>
      <button class="btn primary full" type="submit">Save</button>
      ${tx ? `<div style="text-align:center;margin-top:.6rem"><button type="button" class="btn text" data-act="delete-tx" data-id="${tx.id}">Delete this spend</button></div>` : ""}
    </form>`, { label: "Add a spend" });
  live["spend-amt"](document.querySelector('[data-live="spend-amt"]'));
}
actions["add-spend"] = () => addSpendSheet();
actions["edit-spend"] = el => { const t = S().tx.find(x => x.id === el.dataset.id); if (t) addSpendSheet({ tx: t }); };
actions["pick-pot"] = el => { spendPot = el.dataset.id; document.querySelectorAll(".potbtn[data-id]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === spendPot))); };
actions["new-pot-inline"] = () => {
  const name = prompt("Name for the new pot (for example Pets, Gifts, Beauty):");
  if (!name || !name.trim()) return;
  const form = document.querySelector('form[data-form="spend"]');
  const keep = { amount: form?.elements.amount.value, note: form?.elements.note.value, date: form?.elements.date.value };
  const pot = { id: uid(), name: name.trim().slice(0, 30), color: S().pots.length % 8, budget: 0 };
  commit(s => s.pots.push(pot), { render: false });
  addSpendSheet({ potId: pot.id, ...keep });
};
live["spend-amt"] = el => {
  if (!el) return;
  const out = document.getElementById("spend-left"); if (!out) return;
  const a = num(el.value), s = C.safeToSpend(S(), app.today);
  out.textContent = isFinite(a) && a > 0 ? (s.leftToday - a >= 0 ? `leaves ${fmt(s.leftToday - a)} for today` : `${fmt(a - s.leftToday)} over today's number, the next days adjust`) : `${fmt(Math.max(0, s.leftToday))} left today`;
};
forms["spend"] = (form) => {
  const amount = num(val(form, "amount"));
  if (!isFinite(amount) || amount === 0) { toast("Type an amount first."); return; }
  const id = form.dataset.id, note = val(form, "note").trim().slice(0, 80), date = val(form, "date") || app.today;
  commit(s => {
    if (id) Object.assign(s.tx.find(t => t.id === id), { amount, note, date, potId: spendPot });
    else s.tx.push({ id: uid(), date, amount, potId: spendPot, note, kind: "spend" });
    if (note && spendPot) { const k = shopKey(note); if (k) s.rules[k] = spendPot; }
  });
  closeSheet();
  toast(id ? "Saved." : `Logged ${note || "a spend"}: ${fmt(amount)}`);
};
actions["delete-tx"] = el => {
  const t = S().tx.find(x => x.id === el.dataset.id); if (!t) return;
  commit(s => { s.tx = s.tx.filter(x => x.id !== t.id); });
  closeSheet();
  toast("Deleted.", () => commit(s => s.tx.push(t)));
};
actions["quick"] = el => {
  const q = S().quick.find(x => x.id === el.dataset.id); if (!q) return;
  if (!q.amount) return addSpendSheet({ potId: q.potId, note: /something else/i.test(q.label) ? "" : q.label });
  const t = { id: uid(), date: app.today, amount: q.amount, potId: q.potId, note: q.label, kind: "spend" };
  commit(s => s.tx.push(t));
  toast(`Logged ${q.label}: ${fmt(q.amount)}`, () => commit(s => { s.tx = s.tx.filter(x => x.id !== t.id); }));
};

// ============ Can I afford it? ============
actions["afford"] = () => {
  openSheet(`${sheetHead("Can I afford it?")}
    <form data-form="afford">
      <span class="caps">What is it, and how much</span>
      <div class="row2" style="grid-template-columns:1fr 8rem;margin:.4rem 0 .9rem">
        <input class="input" name="name" placeholder="Wireless headphones" data-live="afford" autocomplete="off" aria-label="What is it">
        <input class="input" name="price" inputmode="decimal" placeholder="${esc(symbol())}0.00" data-live="afford" autofocus autocomplete="off" aria-label="Price">
      </div>
      <div id="afford-out"><p class="small muted">Your bills and savings stay safe either way. This only looks at your everyday money.</p></div>
    </form>`, { label: "Can I afford it?" });
};
live["afford"] = () => {
  const f = document.querySelector('form[data-form="afford"]'); if (!f) return;
  const price = num(val(f, "price")), name = val(f, "name").trim() || "it";
  const out = document.getElementById("afford-out");
  if (!isFinite(price) || price <= 0) { out.innerHTML = `<p class="small muted">Your bills and savings stay safe either way. This only looks at your everyday money.</p>`; return; }
  const a = C.affordCheck(S(), app.today, price), s = a.s;
  const w1 = Math.max(0, a.now), w2 = Math.max(0, a.withIt), mx = Math.max(w1, 1);
  const after = a.after === "easy" ? `Or wait until payday on <b>${esc(fd(a.nextPayday))}</b>: then it's an easy yes and your days stay at ${esc(fmtDown(a.now))}.`
    : a.after === "tight" ? `After payday on <b>${esc(fd(a.nextPayday))}</b> it fits, but it would take a big bite of that period's everyday money.`
    : a.after === "goal" ? `This is bigger than a whole period's everyday money. Make it a goal and it gets a finish date.` : esc(a.after);
  out.innerHTML = `<div class="verdict"><div class="fr">${esc(a.verdict)}</div>
      <p>Your bills and savings stay safe either way. Only your everyday money changes.</p>
      <div class="cmp"><span>Without it</span><div class="bar"><i style="width:${(w1 / mx * 100).toFixed(1)}%;background:var(--good)"></i></div><span class="num">${esc(fmtDown(a.now))} a day</span>
      <span>With it</span><div class="bar"><i style="width:${(w2 / mx * 100).toFixed(1)}%"></i></div><span class="num">${a.withIt > 0 ? esc(fmtDown(a.withIt)) + " a day" : "nothing left"}</span></div></div>
    <div class="boxnote">${after}</div>
    <div style="display:grid;gap:.5rem">
      <button type="button" class="btn primary full" data-act="afford-buy">Buy it and log it</button>
      ${a.after === "goal" ? `<button type="button" class="btn ghost full" data-act="afford-goal">Make it a goal</button>` : `<button type="button" class="btn ghost full" data-act="afford-wait">Wait until ${S().pay.rhythm === "irregular" ? "next week" : "payday"}, remind me</button>`}
      <button type="button" class="btn text" data-act="afford-skip">Skip it, add ${esc(fmt(price))} to "Skipped, not spent"</button>
    </div>`;
  out.dataset.name = name; out.dataset.price = price;
};
const affordData = () => { const o = document.getElementById("afford-out"); return { name: o.dataset.name === "it" ? "" : o.dataset.name, price: Number(o.dataset.price) }; };
actions["afford-buy"] = () => { const d = affordData(); closeSheet(true); addSpendSheet({ amount: d.price, note: d.name, potId: S().pots.find(p => /fun|other/i.test(p.name))?.id }); };
actions["afford-wait"] = () => { const d = affordData(); commit(s => s.waitlist.push({ id: uid(), name: d.name || "Something", amount: d.price, added: app.today, remindOn: nextPaydayOrWeek(), status: "waiting" })); closeSheet(); toast(`Okay. I'll ask you again on ${fd(nextPaydayOrWeek())}.`); };
actions["afford-skip"] = () => { const d = affordData(); commit(s => s.skipped.push({ id: uid(), name: d.name || "Something", amount: d.price, date: app.today })); closeSheet(); toast(`Nice. ${fmt(d.price)} stays with you.`); };
actions["afford-goal"] = () => { const d = affordData(); closeSheet(true); goalSheet({ name: d.name, target: d.price }); };
actions["wait-buy"] = el => { const w = S().waitlist.find(x => x.id === el.dataset.id); if (!w) return; commit(s => { s.waitlist.find(x => x.id === w.id).status = "bought"; }, { render: false }); addSpendSheet({ amount: w.amount, note: w.name }); };
actions["wait-skip"] = el => { const w = S().waitlist.find(x => x.id === el.dataset.id); if (!w) return; commit(s => { s.waitlist.find(x => x.id === w.id).status = "skipped"; s.skipped.push({ id: uid(), name: w.name, amount: w.amount, date: app.today }); }); toast(`Skipped. ${fmt(w.amount)} stays with you.`); };

// ============ Explain the number ============
actions["explain"] = () => {
  const s = C.safeToSpend(S(), app.today), pl = s.plan, p = s.period;
  const line = (a, b, cls = "") => `<div class="sumline ${cls}"><span>${a}</span><span class="fr">${b}</span></div>`;
  openSheet(`${sheetHead("How your number is worked out")}
    <p class="small muted" style="margin-bottom:.8rem">${p.irregular ? `This month, ${esc(fdShort(p.start))} to ${esc(fdShort(p.end))}` : `This pay period, ${esc(fdShort(p.start))} to ${esc(fdShort(p.end))}`}. No bank balance needed, so it can't go wrong if you forget to check your bank.</p>
    ${p.irregular ? line("Money that came in", money(pl.extraIn)) : line(`Pay on ${esc(fd(p.start))}`, money(pl.pay))}
    ${!p.irregular && pl.extraIn ? line("Extra money in", "+ " + money(pl.extraIn)) : ""}
    ${pl.carry ? line("Carried over", "+ " + money(pl.carry)) : ""}
    ${line(`Bills due this period (${pl.bills.length})`, "&minus; " + money(pl.billsTotal))}
    ${line("Saving and debt payments", "&minus; " + money(pl.saving))}
    ${line("Everyday money for the period", money(pl.everyday), "total")}
    ${line("Spent before today", "&minus; " + money(s.spentToDate - s.spentToday))}
    ${line("Left at the start of today", money(s.leftAtStart), "total")}
    ${line(`Shared over ${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"} (today to ${esc(fd(p.end))})`, "&divide; " + s.daysLeft)}
    ${line("Safe to spend today", money(s.safe), "total")}
    <p class="small muted" style="margin-top:.8rem">Today's number stays put all day. Spend less and tomorrow's number grows a little; spend more and it shrinks a little. Bills and savings never move.</p>`, { label: "How your number is worked out" });
};

// ============ Bills ============
actions["bill-paid"] = el => { const k = el.dataset.key; commit(s => { s.billPaid[k] = true; }); toast("Marked paid.", () => commit(s => { delete s.billPaid[k]; })); };
actions["bill-toggle"] = el => { const k = el.dataset.key; commit(s => { s.billPaid[k] ? delete s.billPaid[k] : (s.billPaid[k] = true); }); };
actions["snooze"] = el => { commit(s => { s.meta.snooze = { key: el.dataset.key, date: app.today }; }); toast("Okay, it stays on the Bills page."); };

let billFreq = "monthly";
function billSheet(b = null) {
  billFreq = b?.freq || billFreq || "monthly";
  const wd = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const when = billFreq === "monthly" ? `<label class="field"><span>Day of the month</span><input class="input" name="day" type="number" min="1" max="31" inputmode="numeric" value="${b?.day || ""}" required><small>Use 31 for "last day of the month".</small></label>`
    : billFreq === "weekly" ? `<label class="field"><span>Day of the week</span><select class="input" name="weekday">${wd.map((d, i) => `<option value="${i}"${(b?.weekday ?? 1) === i ? " selected" : ""}>${d}</option>`).join("")}</select></label>`
    : billFreq === "yearly" ? `<label class="field"><span>Next due date</span><input class="input" name="date" type="date" value="${b?.date ? nextYearly(b.date) : ""}" required></label>`
    : billFreq === "once" ? `<label class="field"><span>Due date</span><input class="input" name="date" type="date" value="${b?.date || ""}" required></label>`
    : `<p class="small muted" style="margin-bottom:.9rem">Comes off on each payday.</p>`;
  openSheet(`${sheetHead(b ? "Edit bill" : "Add a bill", "Cancel")}
    <form data-form="bill" data-id="${b?.id || ""}">
      ${b ? "" : `<div class="ideas">${BILL_IDEAS.map(n => `<button type="button" data-act="bill-idea" data-n="${esc(n)}">${esc(n)}</button>`).join("")}</div>`}
      <div class="row2"><label class="field"><span>Name</span><input class="input" name="name" value="${esc(b?.name || "")}" required autocomplete="off"></label>
      <label class="field"><span>Amount</span><input class="input" name="amount" inputmode="decimal" value="${b?.amount ?? ""}" required autocomplete="off"></label></div>
      <label class="field"><span>How often</span><select class="input" name="freq" data-live="bill-freq">${[["monthly", "Every month"], ["weekly", "Every week"], ["perPeriod", "Every payday"], ["yearly", "Once a year"], ["once", "Just once"]].map(([v, l]) => `<option value="${v}"${v === billFreq ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      ${when}
      <label class="check"><input type="checkbox" name="autopay"${b?.autopay ? " checked" : ""}> It pays itself (autopay / direct debit)</label>
      <button class="btn primary full" type="submit" style="margin-top:.6rem">Save bill</button>
      ${b ? `<div style="text-align:center;margin-top:.6rem"><button type="button" class="btn text" data-act="delete-bill" data-id="${b.id}">Delete this bill</button></div>` : ""}
    </form>`, { label: "Bill" });
}
const nextYearly = mmdd => { const y = Number(app.today.slice(0, 4)); const t = `${y}-${mmdd}`; return t >= app.today ? t : `${y + 1}-${mmdd}`; };
actions["edit-bill"] = el => billSheet(S().bills.find(b => b.id === el.dataset.id) || null);
actions["bill-idea"] = el => { const f = document.querySelector('form[data-form="bill"]'); f.elements.name.value = el.dataset.n; f.elements.amount.focus(); };
live["bill-freq"] = el => {
  const f = el.form, keep = { name: f.elements.name.value, amount: f.elements.amount.value, autopay: f.elements.autopay.checked };
  billFreq = el.value;
  const b = S().bills.find(x => x.id === f.dataset.id);
  billSheet(b ? { ...b, ...keep, amount: keep.amount, freq: billFreq } : null);
  const nf = document.querySelector('form[data-form="bill"]');
  nf.elements.name.value = keep.name; nf.elements.amount.value = keep.amount; nf.elements.autopay.checked = keep.autopay;
};
forms["bill"] = form => {
  const name = val(form, "name").trim(), amount = num(val(form, "amount"));
  if (!name || !isFinite(amount)) { toast("Add a name and an amount."); return; }
  const b = { name: name.slice(0, 40), amount, freq: billFreq, autopay: form.elements.autopay.checked };
  if (billFreq === "monthly") b.day = Math.min(31, Math.max(1, Number(val(form, "day")) || 1));
  if (billFreq === "weekly") b.weekday = Number(val(form, "weekday"));
  if (billFreq === "yearly") { const d = val(form, "date"); if (!d) return toast("Pick a date."); b.date = d.slice(5); }
  if (billFreq === "once") { const d = val(form, "date"); if (!d) return toast("Pick a date."); b.date = d; }
  const id = form.dataset.id;
  commit(s => { if (id) Object.assign(s.bills.find(x => x.id === id), b, { day: b.day, weekday: b.weekday, date: b.date }); else s.bills.push({ id: uid(), ...b }); });
  closeSheet(); toast(id ? "Bill saved." : `${name} added.`);
};
actions["delete-bill"] = el => {
  const b = S().bills.find(x => x.id === el.dataset.id); if (!b) return;
  commit(s => { s.bills = s.bills.filter(x => x.id !== b.id); });
  closeSheet(); toast(`${b.name} deleted.`, () => commit(s => s.bills.push(b)));
};

// ============ Pots and quick tiles ============
let potDraft = [];
function potsSheet() {
  const pl = C.planFor(S(), C.periodOf(S().pay, app.today), app.today);
  const total = C.sum(potDraft, p => p.budget);
  openSheet(`${sheetHead("Your pots", "Cancel")}
    <p class="small muted" style="margin-bottom:.9rem">Pots share out your everyday money (${esc(fmt(pl.everyday))} this period). Add as many as you like.</p>
    <form data-form="pots"><div class="edit-list">
      ${potDraft.map((p, i) => `<div class="er" style="grid-template-columns:2.6rem 1fr 6.5rem 2.6rem"><button type="button" class="btn" style="min-height:2.75rem;padding:0;background:${potColor(p)}" data-act="pot-color" data-i="${i}" aria-label="Change colour"></button><input class="input" name="n${i}" value="${esc(p.name)}" aria-label="Pot name" data-live="pot-edit" data-i="${i}"><input class="input" name="b${i}" inputmode="decimal" value="${p.budget}" aria-label="Amount per period" data-live="pot-edit" data-i="${i}"><button type="button" class="x" data-act="pot-remove" data-i="${i}" aria-label="Remove ${esc(p.name)}">&times;</button></div>`).join("")}
    </div>
    <button type="button" class="btn soft small" data-act="pot-add">+ Add a pot</button>
    <div class="sumline total" style="margin-top:1rem"><span>In pots</span><span class="fr" id="pot-total">${esc(fmt(total))}</span></div>
    <p class="small muted" id="pot-diff">${diffText(pl.everyday - total)}</p>
    <button class="btn primary full" type="submit" style="margin-top:.8rem">Save pots</button></form>`, { label: "Pots" });
}
const diffText = d => Math.abs(d) < 1 ? "Every bit of everyday money has a pot." : d > 0 ? `${fmt(d)} not in a pot yet (it still counts in your number).` : `${fmt(-d)} more than your everyday money.`;
actions["edit-pots"] = () => { potDraft = S().pots.map(p => ({ ...p })); potsSheet(); };
actions["pot-add"] = () => { syncPotDraft(); potDraft.push({ id: uid(), name: "", color: potDraft.length % 8, budget: 0 }); potsSheet(); setTimeout(() => document.querySelector(`[name="n${potDraft.length - 1}"]`)?.focus(), 40); };
actions["pot-remove"] = el => { syncPotDraft(); potDraft.splice(Number(el.dataset.i), 1); potsSheet(); };
actions["pot-color"] = el => { syncPotDraft(); const p = potDraft[Number(el.dataset.i)]; p.color = ((p.color ?? 0) + 1) % 8; potsSheet(); };
function syncPotDraft() { const f = document.querySelector('form[data-form="pots"]'); if (!f) return; potDraft.forEach((p, i) => { p.name = f.elements["n" + i]?.value ?? p.name; const b = num(f.elements["b" + i]?.value); p.budget = isFinite(b) ? b : 0; }); }
live["pot-edit"] = () => { syncPotDraft(); const pl = C.planFor(S(), C.periodOf(S().pay, app.today), app.today); const t = C.sum(potDraft, p => p.budget); document.getElementById("pot-total").textContent = fmt(t); document.getElementById("pot-diff").textContent = diffText(pl.everyday - t); };
forms["pots"] = () => { syncPotDraft(); const pots = potDraft.filter(p => p.name.trim()).map(p => ({ ...p, name: p.name.trim().slice(0, 30) })); commit(s => { s.pots = pots; }); closeSheet(); toast("Pots saved."); };
actions["fit-pots"] = () => {
  const pl = C.planFor(S(), C.periodOf(S().pay, app.today), app.today);
  if (!S().pots.length) return;
  commit(s => {
    const total = C.sum(s.pots, p => p.budget) || s.pots.length;
    let used = 0;
    s.pots.forEach((p, i) => { const share = i === s.pots.length - 1 ? C.round2(pl.everyday - used) : Math.round(pl.everyday * ((p.budget || 1) / total)); p.budget = Math.max(0, share); used += p.budget; });
  });
  toast("Pots now match your everyday money.");
};

let quickDraft = [];
function quickSheet() {
  openSheet(`${sheetHead("Quick add tiles", "Cancel")}
    <p class="small muted" style="margin-bottom:.9rem">One tap logs these. Leave the amount empty for things that change (you'll type it).</p>
    <form data-form="quick"><div class="edit-list">
    ${quickDraft.map((q, i) => `<div class="er" style="grid-template-columns:1fr 5.5rem 7rem 2.4rem"><input class="input" name="l${i}" value="${esc(q.label)}" aria-label="Tile name"><input class="input" name="a${i}" inputmode="decimal" value="${q.amount ?? ""}" placeholder="any" aria-label="Amount"><select class="input" name="p${i}" aria-label="Pot">${potOptions(q.potId)}</select><button type="button" class="x" data-act="quick-remove" data-i="${i}" aria-label="Remove">&times;</button></div>`).join("")}
    </div><button type="button" class="btn soft small" data-act="quick-add">+ Add a tile</button>
    <button class="btn primary full" type="submit" style="margin-top:1rem">Save tiles</button></form>`, { label: "Quick add tiles" });
}
function syncQuick() { const f = document.querySelector('form[data-form="quick"]'); if (!f) return; quickDraft.forEach((q, i) => { q.label = f.elements["l" + i]?.value ?? q.label; const a = num(f.elements["a" + i]?.value); q.amount = isFinite(a) && a > 0 ? a : null; q.potId = f.elements["p" + i]?.value ?? q.potId; }); }
actions["edit-quick"] = () => { quickDraft = S().quick.map(q => ({ ...q })); quickSheet(); };
actions["quick-add"] = () => { syncQuick(); quickDraft.push({ id: uid(), label: "", amount: null, potId: S().pots[0]?.id }); quickSheet(); };
actions["quick-remove"] = el => { syncQuick(); quickDraft.splice(Number(el.dataset.i), 1); quickSheet(); };
forms["quick"] = () => { syncQuick(); commit(s => { s.quick = quickDraft.filter(q => q.label.trim()).map(q => ({ ...q, label: q.label.trim().slice(0, 24) })); }); closeSheet(); toast("Tiles saved."); };

// ============ Money in, pay ============
function incomeSheet(t = null) {
  openSheet(`${sheetHead(t ? "Edit money in" : "Money in", "Cancel")}
    <form data-form="income" data-id="${t?.id || ""}">
      <div class="amount">${amountInput("amount", t?.amount ?? "", "autofocus")}</div>
      <label class="field"><span>What was it?</span><input class="input" name="note" value="${esc(t?.note || "")}" placeholder="${S().pay.rhythm === "irregular" ? "Shift pay, tips, client payment" : "Gift, refund, side job"}"></label>
      <label class="field"><span>When</span><input class="input" type="date" name="date" value="${t?.date || app.today}"></label>
      <button class="btn primary full" type="submit">Save</button>
      ${t ? `<div style="text-align:center;margin-top:.6rem"><button type="button" class="btn text" data-act="delete-tx" data-id="${t.id}">Delete</button></div>` : ""}
    </form>`, { label: "Money in" });
}
actions["add-income"] = () => incomeSheet();
actions["edit-income"] = el => incomeSheet(S().tx.find(x => x.id === el.dataset.id));
forms["income"] = form => {
  const amount = num(val(form, "amount")); if (!isFinite(amount) || amount <= 0) return toast("Type an amount first.");
  const id = form.dataset.id, note = val(form, "note").trim().slice(0, 60), date = val(form, "date") || app.today;
  commit(s => { if (id) Object.assign(s.tx.find(t => t.id === id), { amount, note, date }); else s.tx.push({ id: uid(), date, amount, note, kind: "income" }); });
  closeSheet(); toast(`${fmt(amount)} added.`);
};
actions["edit-period-pay"] = el => {
  const start = el.dataset.start, curr = S().periodIncome[start] ?? S().pay.amount;
  openSheet(`${sheetHead("Pay for this period", "Cancel")}
    <form data-form="period-pay" data-start="${start}"><p class="small muted" style="margin-bottom:.6rem">Payday ${esc(fd(start))}. Change it if this pay was different (overtime, fewer hours, a bonus).</p>
    <div class="amount">${amountInput("amount", curr, "autofocus")}</div>
    <button class="btn primary full" type="submit">Save</button>
    <div style="text-align:center;margin-top:.6rem"><button type="button" class="btn text" data-act="period-pay-reset" data-start="${start}">Use my usual ${esc(fmt(S().pay.amount))}</button></div></form>`, { label: "Pay for this period" });
};
forms["period-pay"] = form => { const a = num(val(form, "amount")); if (!isFinite(a)) return; commit(s => { s.periodIncome[form.dataset.start] = a; }); closeSheet(); toast("Pay updated."); };
actions["period-pay-reset"] = el => { commit(s => { delete s.periodIncome[el.dataset.start]; }); closeSheet(); };

let payDraft = null;
function payFields(p, nextVal = "") {
  const r = p.rhythm;
  const seg = `<div class="seg" style="margin-bottom:1rem">${Object.entries(C.RHYTHMS).map(([k, v]) => `<button type="button" data-act="pay-rhythm" data-v="${k}" aria-pressed="${k === r}">${esc(v.label)}</button>`).join("")}</div>`;
  if (r === "irregular") return seg + `<div class="boxnote">Your plan uses the money that has actually come in this month, so you never spend money that hasn't arrived. Log pay with "Money in" as it lands.</div>`;
  const when = r === "semimonthly" ? `<div class="row2"><label class="field"><span>First payday of the month</span><input class="input" name="d1" type="number" min="1" max="31" value="${p.days?.[0] ?? 1}"></label><label class="field"><span>Second payday</span><input class="input" name="d2" type="number" min="1" max="31" value="${p.days?.[1] ?? 15}"><small>31 = last day of the month</small></label></div>`
    : `<label class="field"><span>Your next payday</span><input class="input" name="next" type="date" value="${nextVal}" min="${app.today}" required>${r === "monthly" ? "<small>We'll use the same day every month.</small>" : ""}</label>`;
  return seg + when + `<label class="field"><span>How much usually comes in (after tax)</span><input class="input" name="amount" inputmode="decimal" value="${p.amount || ""}" required></label>`;
}
const currentNext = () => (S().pay.rhythm === "irregular" || (!S().pay.anchor && S().pay.rhythm !== "monthly" && S().pay.rhythm !== "semimonthly")) ? "" : C.periodOf(S().pay, app.today).next;
actions["edit-pay"] = () => { payDraft = { ...S().pay }; openSheet(`${sheetHead("Your pay", "Cancel")}<form data-form="pay">${payFields(payDraft, currentNext())}<button class="btn primary full" type="submit">Save</button></form>`, { label: "Your pay" }); };
actions["pay-rhythm"] = el => {
  const form = el.closest("form");
  if (form?.dataset.form === "setup") { syncWizard(); wz.pay.rhythm = el.dataset.v; return renderSetup(); }
  payDraft.rhythm = el.dataset.v;
  updateSheet(`${sheetHead("Your pay", "Cancel")}<form data-form="pay">${payFields(payDraft, currentNext())}<button class="btn primary full" type="submit">Save</button></form>`);
};
function readPay(form, base) {
  const p = { ...base };
  if (p.rhythm === "irregular") return p;
  const amount = num(val(form, "amount"));
  if (!isFinite(amount) || amount <= 0) { toast("Add how much comes in."); return null; }
  p.amount = amount;
  if (p.rhythm === "semimonthly") { p.days = [Number(val(form, "d1")) || 1, Number(val(form, "d2")) || 15].map(d => Math.min(31, Math.max(1, d))).sort((a, b) => a - b); if (p.days[0] === p.days[1]) { toast("Pick two different days."); return null; } }
  else {
    const next = val(form, "next");
    if (!next) { toast("Pick your next payday."); return null; }
    p.anchor = next;
    if (p.rhythm === "monthly") p.day = C.parts(next)[2];
  }
  return p;
}
forms["pay"] = form => {
  const p = readPay(form, payDraft); if (!p) return;
  commit(s => { s.pay = p; s.routineDone[C.periodOf(p, app.today).start] = true; });
  closeSheet(); toast("Pay saved. Your number is updated.");
};

// ============ Goals and debts ============
function goalSheet(g = {}) {
  const saved = g.id ? C.goalSaved(S(), g) : (g.saved ?? 0);
  openSheet(`${sheetHead(g.id ? "Edit goal" : "New goal", "Cancel")}
    <form data-form="goal" data-id="${g.id || ""}">
      <label class="field"><span>What are you saving for?</span><input class="input" name="name" value="${esc(g.name || "")}" required autocomplete="off" placeholder="Emergency fund"></label>
      <div class="row2"><label class="field"><span>Target</span><input class="input" name="target" inputmode="decimal" value="${g.target ?? ""}" required></label>
      <label class="field"><span>Saved so far</span><input class="input" name="saved" inputmode="decimal" value="${saved || ""}" placeholder="0"></label></div>
      <label class="field"><span>Set aside each payday</span><input class="input" name="per" inputmode="decimal" value="${g.perPeriod ?? ""}" placeholder="0"><small>This comes off before your everyday money, so it's always kept safe.</small></label>
      <button class="btn primary full" type="submit">Save goal</button>
      ${g.id ? `<div style="text-align:center;margin-top:.6rem"><button type="button" class="btn text" data-act="delete-goal" data-id="${g.id}">Delete this goal</button></div>` : ""}
    </form>`, { label: "Goal" });
}
actions["edit-goal"] = el => goalSheet(S().goals.find(g => g.id === el.dataset.id) || {});
forms["goal"] = form => {
  const name = val(form, "name").trim(), target = num(val(form, "target")), saved = num(val(form, "saved")) || 0, per = num(val(form, "per")) || 0;
  if (!name || !isFinite(target) || target <= 0) return toast("Add a name and a target.");
  const id = form.dataset.id;
  commit(s => {
    if (id) { const g = s.goals.find(x => x.id === id); const fromTx = C.goalSaved(s, g) - (Number(g.start) || 0); Object.assign(g, { name, target, perPeriod: per, start: C.round2(saved - fromTx) }); }
    else s.goals.push({ id: uid(), name: name.slice(0, 40), target, perPeriod: per, start: saved, color: s.goals.length % 8 });
  });
  closeSheet(); toast(id ? "Goal saved." : `${name} added.`);
};
actions["delete-goal"] = el => { const g = S().goals.find(x => x.id === el.dataset.id); commit(s => { s.goals = s.goals.filter(x => x.id !== g.id); }); closeSheet(); toast("Goal deleted.", () => commit(s => s.goals.push(g))); };
function moveSheet(title, form, id, hint) {
  openSheet(`${sheetHead(title, "Cancel")}<form data-form="${form}" data-id="${id}"><div class="amount">${amountInput("amount", "", "autofocus")}${hint ? `<small>${esc(hint)}</small>` : ""}</div><button class="btn primary full" type="submit">Save</button></form>`, { label: title });
}
actions["goal-add"] = el => moveSheet("Add money to this goal", "goal-add", el.dataset.id, "Money you've moved into savings.");
actions["goal-take"] = el => moveSheet("Take money out", "goal-take", el.dataset.id, "That's what savings are for. No guilt.");
forms["goal-add"] = form => { const a = num(val(form, "amount")); if (!(a > 0)) return; commit(s => s.tx.push({ id: uid(), date: app.today, amount: a, kind: "save", goalId: form.dataset.id, note: "Added" })); closeSheet(); toast(`${fmt(a)} added.`); };
forms["goal-take"] = form => { const a = num(val(form, "amount")); if (!(a > 0)) return; commit(s => s.tx.push({ id: uid(), date: app.today, amount: -a, kind: "save", goalId: form.dataset.id, note: "Taken out" })); closeSheet(); toast(`${fmt(a)} taken out.`); };

function debtSheet(d = {}) {
  const left = d.id ? C.debtLeft(S(), d) : "";
  openSheet(`${sheetHead(d.id ? "Edit debt" : "New debt", "Cancel")}
    <form data-form="debt" data-id="${d.id || ""}">
      <label class="field"><span>Name</span><input class="input" name="name" value="${esc(d.name || "")}" required placeholder="Credit card" autocomplete="off"></label>
      <div class="row2"><label class="field"><span>Balance now</span><input class="input" name="balance" inputmode="decimal" value="${left}" required></label>
      <label class="field"><span>Interest a year (%)</span><input class="input" name="rate" inputmode="decimal" value="${d.rate ?? ""}" placeholder="0"></label></div>
      <label class="field"><span>Pay each payday</span><input class="input" name="per" inputmode="decimal" value="${d.perPeriod ?? ""}" placeholder="0"><small>Don't also add this payment as a bill, so it isn't counted twice.</small></label>
      <button class="btn primary full" type="submit">Save debt</button>
      ${d.id ? `<div style="text-align:center;margin-top:.6rem"><button type="button" class="btn text" data-act="delete-debt" data-id="${d.id}">Delete this debt</button></div>` : ""}
    </form>`, { label: "Debt" });
}
actions["edit-debt"] = el => debtSheet(S().debts.find(d => d.id === el.dataset.id) || {});
forms["debt"] = form => {
  const name = val(form, "name").trim(), bal = num(val(form, "balance")), rate = num(val(form, "rate")) || 0, per = num(val(form, "per")) || 0;
  if (!name || !isFinite(bal)) return toast("Add a name and the balance.");
  const id = form.dataset.id;
  commit(s => {
    if (id) { const d = s.debts.find(x => x.id === id); const paid = (Number(d.start) || 0) - C.debtLeft(s, d); Object.assign(d, { name, rate, perPeriod: per, start: C.round2(bal + paid) }); }
    else s.debts.push({ id: uid(), name: name.slice(0, 40), start: bal, rate, perPeriod: per });
  });
  closeSheet(); toast("Debt saved.");
};
actions["delete-debt"] = el => { const d = S().debts.find(x => x.id === el.dataset.id); commit(s => { s.debts = s.debts.filter(x => x.id !== d.id); }); closeSheet(); toast("Debt deleted.", () => commit(s => s.debts.push(d))); };
actions["debt-pay"] = el => moveSheet("Log a payment", "debt-pay", el.dataset.id, "Extra payments bring the payoff date closer.");
forms["debt-pay"] = form => { const a = num(val(form, "amount")); if (!(a > 0)) return; commit(s => s.tx.push({ id: uid(), date: app.today, amount: a, kind: "debt", debtId: form.dataset.id, note: "Payment" })); closeSheet(); toast(`${fmt(a)} paid off.`); };

// ============ Payday routine ============
actions["payday"] = () => {
  const s = C.safeToSpend(S(), app.today), p = s.period;
  const prev = C.prevPeriod(S().pay, p), prevPlan = C.planFor(S(), prev, app.today);
  const prevLeft = C.round2(prevPlan.everyday - C.spentIn(S(), prev.start, prev.end));
  const started = S().meta.createdAt && S().meta.createdAt.slice(0, 10) <= prev.start;
  const goals = S().goals.filter(g => Number(g.perPeriod) > 0 && C.goalSaved(S(), g) < g.target);
  const debts = S().debts.filter(d => Number(d.perPeriod) > 0 && C.debtLeft(S(), d) > 0);
  openSheet(`${sheetHead("Payday routine", "Later")}
    <form data-form="payday" data-start="${p.start}">
    <p class="small muted" style="margin-bottom:1rem">Two minutes, once per payday. Then the app does the rest.</p>
    <ol class="steps">
      <li>What came in on ${esc(fd(p.start))}?<div style="max-width:12rem;margin-top:.4rem"><input class="input" name="pay" inputmode="decimal" value="${S().periodIncome[p.start] ?? S().pay.amount}"></div></li>
      ${started && prevLeft > 1 ? `<li>Last period you had ${money(prevLeft)} left over. Nice.
        <div class="seg" style="margin-top:.5rem">
          <label class="check"><input type="radio" name="left" value="carry" checked> Add it to this period</label>
          ${S().goals.length ? `<label class="check"><input type="radio" name="left" value="goal"> Put it in <select class="input" name="leftGoal" style="width:auto;min-height:2.2rem;margin-left:.3rem">${S().goals.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select></label>` : ""}
          <label class="check"><input type="radio" name="left" value="keep"> Leave it where it is</label>
        </div><input type="hidden" name="prevLeft" value="${prevLeft}"></li>` : ""}
      ${goals.length || debts.length ? `<li>Move your savings and payments<small>${[...goals.map(g => `${esc(g.name)} ${esc(fmt(g.perPeriod))}`), ...debts.map(d => `${esc(d.name)} ${esc(fmt(d.perPeriod))}`)].join(" &middot; ")}</small><label class="check"><input type="checkbox" name="moved" checked> I've moved it (or it moves by itself)</label></li>` : ""}
      <li>Your bills this period: ${s.plan.bills.length} for ${money(s.plan.billsTotal)}<small>They're already kept aside. Tick them off on the Bills page as they go.</small></li>
    </ol>
    <button class="btn primary full" type="submit">Finish payday</button></form>`, { label: "Payday routine" });
};
forms["payday"] = form => {
  const start = form.dataset.start, pay = num(val(form, "pay"));
  const left = form.elements.left?.value || null;
  const prevLeft = num(val(form, "prevLeft")) || 0;
  commit(s => {
    if (isFinite(pay) && pay !== s.pay.amount) s.periodIncome[start] = pay; else delete s.periodIncome[start];
    if (left === "carry" && prevLeft > 0) s.periodCarry[start] = prevLeft;
    if (left === "goal" && prevLeft > 0) s.tx.push({ id: uid(), date: start, amount: prevLeft, kind: "save", goalId: val(form, "leftGoal"), note: "Leftover" });
    if (form.elements.moved?.checked) {
      for (const g of s.goals.filter(g => Number(g.perPeriod) > 0 && C.goalSaved(s, g) < g.target)) s.tx.push({ id: uid(), date: start, amount: Math.min(g.perPeriod, C.round2(g.target - C.goalSaved(s, g))), kind: "save", goalId: g.id, note: "Payday saving" });
      for (const d of s.debts.filter(d => Number(d.perPeriod) > 0 && C.debtLeft(s, d) > 0)) s.tx.push({ id: uid(), date: start, amount: Math.min(d.perPeriod, C.debtLeft(s, d)), kind: "debt", debtId: d.id, note: "Payday payment" });
    }
    s.routineDone[start] = true;
  });
  closeSheet(); toast("Payday done. Enjoy your new number.");
};

// ============ Welcome back (catch-up) ============
export function welcomeBack(days) {
  const pots = S().pots;
  const last = app.demo ? C.addDays(app.today, -(days || 6)) : S().tx.filter(t => t.kind === "spend" && t.date <= app.today).map(t => t.date).sort().pop();
  openSheet(`<div class="sheet-head"><div class="logo fr it" style="font-size:1.3rem;color:var(--head)">Sweet Spot <img src="img/motif-${S().profile.look}.png" alt="" style="height:1.2rem"></div><button type="button" class="x" data-act="close-sheet">Close</button></div>
    <h2 class="fr" style="font-size:2rem;color:var(--head);line-height:1.1;margin-bottom:.5rem">Welcome back${S().profile.name ? `, <em class="it" style="color:var(--deep)">${esc(S().profile.name)}.</em>` : "."}</h2>
    <p style="font-weight:600;color:var(--head);margin-bottom:1rem">${last ? `Your last spend was ${esc(fd(last))}.` : `It's been ${days || "a few"} days.`} Life happens. Let's catch up in a minute, no need to find every receipt.</p>
    <button type="button" class="opt" data-act="import-bank"><div class="t"><b>Import my bank statement</b><span class="mm">2 MIN</span></div><small>Download it from your bank, drop it here. Shops you've used before sort themselves.</small></button>
    <form data-form="catchup" class="opt open"><div class="t"><b>One total per pot</b><span class="mm">1 MIN</span></div><small>A rough number is fine.</small>
      ${pots.map(p => `<div style="display:grid;grid-template-columns:1rem 1fr 7rem;gap:.5rem;align-items:center;margin-top:.5rem">${sq(p)}<span style="font-weight:700;color:var(--head)">${esc(p.name)}</span><input class="input" name="c_${p.id}" inputmode="decimal" placeholder="${esc(symbol())}0" data-live="catchup" style="min-height:2.4rem;text-align:right"></div>`).join("")}
      <div class="note" style="display:flex;justify-content:space-between;background:var(--petal)"><span>Safe to spend today, updated</span><b class="num" id="cu-safe">${esc(fmtDown(C.safeToSpend(S(), app.today).safe))}</b></div>
      <button class="btn primary full" type="submit" style="margin-top:.7rem">Save and catch up</button>
    </form>
    <button type="button" class="opt" data-act="close-sheet"><div class="t"><b>Start fresh from today</b><span class="mm">0 MIN</span></div><small>Your plan stays. The missed days are left out.</small></button>`, { label: "Welcome back" });
}
actions["welcome-back"] = () => welcomeBack();
live["catchup"] = () => {
  const f = document.querySelector('form[data-form="catchup"]'); if (!f) return;
  const total = C.sum(S().pots, p => num(f.elements["c_" + p.id]?.value) || 0);
  const s = C.safeToSpend(S(), app.today);
  document.getElementById("cu-safe").textContent = fmtDown(Math.max(0, (s.leftAtStart - total) / s.daysLeft));
};
forms["catchup"] = f => {
  const day = C.addDays(app.today, -1) >= C.periodOf(S().pay, app.today).start ? C.addDays(app.today, -1) : app.today;
  const adds = S().pots.map(p => ({ p, a: num(f.elements["c_" + p.id]?.value) })).filter(x => x.a > 0);
  commit(s => { for (const { p, a } of adds) s.tx.push({ id: uid(), date: day, amount: a, potId: p.id, note: "Catch-up", kind: "spend" }); });
  closeSheet(); toast(adds.length ? "All caught up. Your number is updated." : "Okay, starting fresh from today.");
};

// ============ Backup, restore, move ============
actions["backup"] = async () => {
  const data = JSON.stringify({ app: "sweetspot", version: 1, exportedAt: new Date().toISOString(), state: S() }, null, 1);
  const r = await shareOrDownload(`sweetspot-backup-${app.today}.json`, data, "application/json");
  if (r === "cancelled") return;
  commit(s => { s.meta.lastBackup = new Date().toISOString(); });
  toast(r === "shared" ? "Backup ready. Save it to Files, Drive or email." : "Backup saved to your downloads.");
};
actions["restore"] = async () => {
  const f = await pickFile(".json,application/json");
  if (!f) return;
  let data;
  try { data = JSON.parse(f.text); } catch { return toast("That file isn't a Sweet Spot backup."); }
  if (data?.app !== "sweetspot" || !data.state) return toast("That file isn't a Sweet Spot backup.");
  const n = (data.state.tx || []).length;
  openSheet(`${sheetHead("Restore this backup?", "Cancel")}
    <p style="font-weight:600;color:var(--head);margin-bottom:1rem">Backup from ${esc(fd(String(data.exportedAt || "").slice(0, 10) || app.today))} with ${n} entries. It replaces what's on this device now.</p>
    <button type="button" class="btn primary full" data-act="restore-go">Yes, restore it</button>`, { label: "Restore" });
  actions["restore-go"] = () => {
    const st = normalise(data.state);
    st.meta.unlocked = true; st.meta.setupDone = true; st.meta.demo = app.demo;
    app.S = st; commit(null); applyLook(); closeSheet(); app.view = "today"; render(); toast("Restored. Welcome back.");
  };
};
actions["move-phone"] = () => {
  const link = location.origin + location.pathname.replace(/index\.html$/, "");
  openSheet(`${sheetHead("Move to my phone (or laptop)")}
    <p class="small muted" style="margin-bottom:1rem">Your money diary lives on this device only, for privacy. Moving it takes a minute.</p>
    <ol class="steps">
      <li>Make a backup here<small>It's a small file.</small><div style="margin-top:.4rem"><button type="button" class="btn soft small" data-act="backup">Back up now</button></div></li>
      <li>Send the file to yourself<small>AirDrop, WhatsApp to yourself, email, Google Drive or iCloud Drive all work.</small></li>
      <li>On the other device, open Sweet Spot<small><span class="num" style="word-break:break-all">${esc(link)}</span></small><div style="margin-top:.4rem"><button type="button" class="btn text small" data-act="copy-link" data-link="${esc(link)}">Copy link</button></div></li>
      <li>Unlock, then Settings &rarr; Restore from a backup<small>Pick the file. Everything appears, same as here.</small></li>
    </ol>
    <button type="button" class="btn ghost full" data-act="install-help">How to put it on my home screen</button>`, { label: "Move to my phone" });
};
actions["copy-link"] = async el => { try { await navigator.clipboard.writeText(el.dataset.link); toast("Link copied."); } catch { toast(el.dataset.link); } };

actions["export-csv"] = async () => {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["Date", "What", "Pot", "Amount", "Type"].join(",")];
  for (const t of [...S().tx].sort((a, b) => a.date.localeCompare(b.date))) {
    const type = { spend: "Spend", income: "Money in", save: "Saving", debt: "Debt payment" }[t.kind] || t.kind;
    const where = t.kind === "save" ? S().goals.find(g => g.id === t.goalId)?.name : t.kind === "debt" ? S().debts.find(d => d.id === t.debtId)?.name : potById(t.potId)?.name;
    lines.push([t.date, q(t.note), q(where || ""), t.amount.toFixed(2), type].join(","));
  }
  await shareOrDownload(`sweetspot-spends-${app.today}.csv`, "﻿" + lines.join("\r\n"), "text/csv");
  toast("Exported. Open it in Google Sheets (File, Import) or Excel.");
};
actions["ics"] = async () => {
  if (!S().bills.length && S().pay.rhythm === "irregular") return toast("Add a bill first.");
  await shareOrDownload("sweetspot-bills.ics", buildICS(S(), app.today, fmt), "text/calendar");
  toast("Open the file to add your bills and paydays to your calendar.");
};

// ============ Install help ============
let deferredPrompt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; });
actions["install-help"] = () => {
  openSheet(`${sheetHead("Put Sweet Spot on your home screen")}
    <p class="small muted" style="margin-bottom:1rem">Then it opens like an app, works offline, and your phone keeps your data safe.</p>
    ${deferredPrompt ? `<button type="button" class="btn primary full" data-act="install-now" style="margin-bottom:1rem">Install now</button>` : ""}
    <h3 class="fr it" style="color:var(--head);margin-bottom:.5rem">iPhone or iPad</h3>
    <ol class="steps"><li>Open this page in Safari</li><li>Tap the Share button<small>The square with an arrow, at the bottom (or top on iPad).</small></li><li>Tap "Add to Home Screen", then "Add"</li><li>Open Sweet Spot from your home screen from now on</li></ol>
    <h3 class="fr it" style="color:var(--head);margin:.4rem 0 .5rem">Android</h3>
    <ol class="steps"><li>Open this page in Chrome</li><li>Tap the three dots, top right</li><li>Tap "Install app" or "Add to Home screen"</li></ol>
    <h3 class="fr it" style="color:var(--head);margin:.4rem 0 .5rem">Laptop</h3>
    <ol class="steps"><li>Chrome or Edge: click the install icon at the right end of the address bar</li><li>Safari on Mac: File, then "Add to Dock"</li></ol>`, { label: "Install" });
};
actions["install-now"] = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; closeSheet(); };

// ============ Erase ============
actions["erase"] = () => {
  openSheet(`${sheetHead("Erase everything?", "Cancel")}
    <p style="font-weight:600;color:var(--head);margin-bottom:1rem">This deletes every bill, pot, goal and spend on this device. It can't be undone. Make a backup first if you might want it back.</p>
    <button type="button" class="btn soft full" data-act="backup" style="margin-bottom:.6rem">Back up first</button>
    <button type="button" class="btn danger full" data-act="erase-go">Yes, erase everything</button>`, { label: "Erase" });
};
actions["erase-go"] = async () => { await store.wipe(); location.reload(); };

// ============ Bank statement import ============
let imp = null;
// In the demo there's no real statement to pick, so a sample one shows how importing works.
function sampleStatement() {
  const d = n => C.addDays(app.today, -n);
  const rows = [[1, "LIDL 4432", -27.35], [1, "COSTA COFFEE 118", -4.2], [2, "SHELL FUEL 22", -38.5], [2, "BLOOM FLOWER STUDIO", -18], [3, "TESCO STORES 2231", -41.9], [3, "NETFLIX.COM", -10.99], [4, "UBER TRIP", -9.4], [4, "REFUND ONLINE ORDER", 24], [5, "CITY PARKING 4", -6], [5, "STARBUCKS 52", -5.1], [6, "ALDI 113", -33.6], [6, "PET SHOP CORNER", -21.75]];
  return { name: "sample-statement.csv", text: "Date,Description,Amount\n" + rows.map(([n, desc, a]) => `${d(n)},${desc},${a.toFixed(2)}`).join("\n") };
}
actions["import-bank"] = async () => {
  const f = app.demo ? sampleStatement() : await pickFile(".csv,text/csv,text/plain");
  if (!f) return;
  const parsed = parseCSV(f.text);
  if (!parsed.rows.length || parsed.header.length < 2) return toast("I couldn't read that file. Try the CSV download from your bank.");
  const sig = parsed.header.join("|").toLowerCase();
  const g = S().csvMaps[sig] || guessColumns(parsed.header);
  imp = { name: f.name, ...parsed, sig, map: { ...g }, dateFmt: g.dateFmt || guessDateFormat(parsed.rows.map(r => r[g.date]).filter(Boolean).slice(0, 40), S().profile.locale), outNegative: g.outNegative ?? null, step: 1, income: S().pay.rhythm === "irregular" };
  if (imp.outNegative == null) { const amts = parsed.rows.map(r => toNumber(r[imp.map.amount])).filter(isFinite); imp.outNegative = amts.some(a => a < 0) ? true : false; }
  importStep();
};
function rowMoney(r) {
  const m = imp.map;
  if (m.out >= 0 || m.in >= 0) {
    const o = Math.abs(toNumber(r[m.out])), i = Math.abs(toNumber(r[m.in]));
    if (isFinite(o) && o > 0) return -o;
    if (isFinite(i) && i > 0) return i;
    const a = toNumber(r[m.amount]); return isFinite(a) ? a : NaN;
  }
  const a = toNumber(r[m.amount]);
  return imp.outNegative ? a : -a;
}
function importRows() {
  const out = [];
  imp.rows.forEach((r, i) => {
    const date = toISODate(r[imp.map.date], imp.dateFmt), m = rowMoney(r), desc = (r[imp.map.desc] || "").replace(/\s+/g, " ").trim();
    if (!date || !isFinite(m) || m === 0) return;
    const isOut = m < 0, amount = C.round2(Math.abs(m));
    const dup = S().tx.some(t => t.date === date && Math.abs(t.amount - amount) < 0.005 && (t.kind === (isOut ? "spend" : "income")) && (t.note || "").toLowerCase() === desc.toLowerCase().slice(0, 80));
    let pot = isOut ? guessPot(desc, S().rules) : null;
    if (isOut && !pot && imp.map.pot >= 0) { const cat = (r[imp.map.pot] || "").toLowerCase(); pot = S().pots.find(p => p.name.toLowerCase() === cat)?.id || null; }
    out.push({ i, date, desc, amount, isOut, pot: isOut ? (pot || "") : (imp.income ? "income" : "skip"), auto: !!pot, dup, on: !dup && (isOut || imp.income) });
  });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
function colSelect(key, label, allowNone = true) {
  return `<label class="field"><span>${label}</span><select class="input" data-live="imp-map" data-k="${key}">${allowNone ? `<option value="-1">(none)</option>` : ""}${imp.header.map((h, i) => `<option value="${i}"${imp.map[key] === i ? " selected" : ""}>${esc(h || `Column ${i + 1}`)}</option>`).join("")}</select></label>`;
}
function importStep() {
  if (imp.step === 1) {
    const sample = imp.rows.slice(0, 4);
    const split = imp.map.out >= 0 || imp.map.in >= 0;
    openSheet(`${sheetHead("Import a bank statement", "Cancel")}
      <p class="small muted" style="margin-bottom:.9rem">${esc(imp.name)} &middot; ${imp.rows.length} rows. Check that I found the right columns.</p>
      <div class="row2">${colSelect("date", "Date", false)}${colSelect("desc", "Description / shop", false)}</div>
      <div class="row2">${colSelect("amount", "Amount")}${colSelect("pot", "Category (optional)")}</div>
      <div class="row2">${colSelect("out", "Money out (if separate)")}${colSelect("in", "Money in (if separate)")}</div>
      <div class="row2"><label class="field"><span>Dates look like</span><select class="input" data-live="imp-datefmt">${[["dmy", "31/12/2026 (day first)"], ["mdy", "12/31/2026 (month first)"], ["ymd", "2026-12-31"]].map(([v, l]) => `<option value="${v}"${imp.dateFmt === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      ${split ? "" : `<label class="field"><span>Money out shows as</span><select class="input" data-live="imp-sign"><option value="neg"${imp.outNegative ? " selected" : ""}>Negative numbers (-12.40)</option><option value="pos"${!imp.outNegative ? " selected" : ""}>Positive numbers (12.40)</option></select></label>`}</div>
      <label class="check"><input type="checkbox" data-live="imp-income"${imp.income ? " checked" : ""}> Also add money that came in (pay, refunds)</label>
      <div class="imp-table" style="margin:.8rem 0"><table class="tbl"><thead><tr><th>Date</th><th>Description</th><th class="r">Amount</th></tr></thead><tbody>
      ${sample.map(r => { const d = toISODate(r[imp.map.date], imp.dateFmt), m = rowMoney(r); return `<tr><td>${d ? esc(fdShort(d)) : `<span class="pill">?</span>`}</td><td>${esc((r[imp.map.desc] || "").slice(0, 40))}</td><td class="r">${isFinite(m) ? (m < 0 ? "out " : "in ") + esc(fmt(Math.abs(m))) : "?"}</td></tr>`; }).join("")}
      </tbody></table></div>
      <button type="button" class="btn primary full" data-act="imp-next">Next</button>`, { wide: true, label: "Import" });
    return;
  }
  const rows = imp.list;
  const outs = rows.filter(r => r.isOut && !r.dup), auto = outs.filter(r => r.auto).length;
  openSheet(`${sheetHead("Sort and import", "Cancel")}
    <p style="font-weight:700;color:var(--head);margin-bottom:.4rem">${rows.length} found &middot; ${auto} sorted for you &middot; ${outs.length - auto} need a pot${rows.some(r => r.dup) ? ` &middot; ${rows.filter(r => r.dup).length} already in` : ""}</p>
    <p class="small muted" style="margin-bottom:.8rem">Pick a pot for the rest. I'll remember each shop for next time.</p>
    <div class="imp-table"><table class="tbl"><thead><tr><th></th><th>Date</th><th>Description</th><th class="r">Amount</th><th>Pot</th></tr></thead><tbody>
    ${rows.map((r, k) => `<tr${r.dup ? ' style="opacity:.5"' : ""}><td><input type="checkbox" data-live="imp-on" data-k="${k}"${r.on ? " checked" : ""} aria-label="Include"></td><td>${esc(fdShort(r.date))}</td><td>${esc(r.desc.slice(0, 38))}${r.dup ? ` <span class="pill">already in</span>` : ""}</td><td class="r">${r.isOut ? "" : "+"}${esc(fmt(r.amount))}</td><td><select class="input" data-live="imp-pot" data-k="${k}">${r.isOut ? `<option value=""${!r.pot ? " selected" : ""}>Choose&hellip;</option>${potOptions(r.pot)}<option value="skip"${r.pot === "skip" ? " selected" : ""}>Not a spend (skip)</option>` : `<option value="income"${r.pot === "income" ? " selected" : ""}>Money in</option><option value="skip"${r.pot === "skip" ? " selected" : ""}>Skip</option>`}</select></td></tr>`).join("")}
    </tbody></table></div>
    <div style="display:flex;gap:.6rem;margin-top:1rem;flex-wrap:wrap"><button type="button" class="btn ghost" data-act="imp-back">Back</button><button type="button" class="btn primary" style="flex:1" data-act="imp-go">Import ${rows.filter(r => r.on && r.pot && r.pot !== "skip").length} entries</button></div>`, { wide: true, label: "Import" });
}
live["imp-map"] = el => { imp.map[el.dataset.k] = Number(el.value); if (el.dataset.k === "date") imp.dateFmt = guessDateFormat(imp.rows.map(r => r[imp.map.date]).filter(Boolean).slice(0, 40), S().profile.locale); importStep(); };
live["imp-datefmt"] = el => { imp.dateFmt = el.value; importStep(); };
live["imp-sign"] = el => { imp.outNegative = el.value === "neg"; importStep(); };
live["imp-income"] = el => { imp.income = el.checked; };
actions["imp-next"] = () => { imp.list = importRows(); if (!imp.list.length) return toast("No rows with a date and an amount. Check the columns."); imp.step = 2; importStep(); };
actions["imp-back"] = () => { imp.step = 1; importStep(); };
live["imp-on"] = el => { imp.list[Number(el.dataset.k)].on = el.checked; refreshImportButton(); };
live["imp-pot"] = el => { const r = imp.list[Number(el.dataset.k)]; r.pot = el.value; r.on = el.value !== "skip" && !!el.value; const cb = document.querySelector(`[data-live="imp-on"][data-k="${el.dataset.k}"]`); if (cb) cb.checked = r.on; refreshImportButton(); };
function refreshImportButton() { const b = document.querySelector('[data-act="imp-go"]'); if (b) b.textContent = `Import ${imp.list.filter(r => r.on && r.pot && r.pot !== "skip").length} entries`; }
actions["imp-go"] = () => {
  const take = imp.list.filter(r => r.on && r.pot && r.pot !== "skip");
  if (!take.length) return toast("Pick a pot for at least one row.");
  commit(s => {
    for (const r of take) {
      if (r.pot === "income") s.tx.push({ id: uid(), date: r.date, amount: r.amount, note: r.desc.slice(0, 80), kind: "income", src: "bank" });
      else { s.tx.push({ id: uid(), date: r.date, amount: r.amount, potId: r.pot, note: r.desc.slice(0, 80), kind: "spend", src: "bank" }); const k = shopKey(r.desc); if (k) s.rules[k] = r.pot; }
    }
    s.csvMaps[imp.sig] = { ...imp.map, dateFmt: imp.dateFmt, outNegative: imp.outNegative };
  });
  closeSheet(); toast(`Imported ${take.length} entries. Your number is updated.`); imp = null;
};

// ============ Unlock ============
const CODE_HASH = "f6072ad94a100f820e88c350760f744fe68a2d3727c23f2eb07972e4baf226ff";
const norm = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
async function codeOK(code) {
  const n = norm(code);
  try {
    const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(n));
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("") === CODE_HASH;
  } catch { return false; } // needs https (or localhost); the hosted app always has it
}
export function renderUnlock(msg = "") {
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card card">
    <div class="logo fr it">Sweet Spot <img src="img/motif-strawberry.png" alt=""></div>
    <h1 class="fr" style="font-size:1.7rem;color:var(--head);margin-bottom:.4rem">Welcome. Let's find your <em class="it" style="color:var(--deep)">sweet spot.</em></h1>
    <p style="font-weight:600;margin-bottom:1.2rem">Type the unlock code from your Etsy download (the PDF). You only do this once on each device.</p>
    <form data-form="unlock"><label class="field"><span>Unlock code</span><input class="input" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXX-XXXX-XXXX" autofocus></label>
    ${msg ? `<p style="color:var(--link);font-weight:800;margin:-.3rem 0 .8rem">${esc(msg)}</p>` : ""}
    <button class="btn primary full" type="submit">Unlock</button></form>
    <p class="small muted" style="margin-top:1rem">Haven't bought it yet? <a href="?demo">Try the free demo</a>, or <a href="${ETSY_URL}" target="_blank" rel="noopener">find it on Etsy</a>.</p>
  </div></div>`;
}
forms["unlock"] = async form => {
  if (!(await codeOK(val(form, "code")))) return renderUnlock("That code doesn't match. Check the PDF, or message the shop and we'll help.");
  app.S = blankState(); app.S.meta.unlocked = true; store.save(app.S); await store.flush();
  wz = null; renderSetup();
};

// ============ 60-second setup ============
let wz = null;
export function renderSetup() {
  if (!wz) wz = { step: 1, name: "", currency: guessCurrency(), locale: S().profile.locale, pay: { rhythm: "monthly", amount: "", next: "", days: [1, 15] }, bills: [{ name: "Rent", amount: "", day: "" }, { name: "Phone", amount: "", day: "" }], left: "" };
  const prog = `<div class="progress">${[1, 2, 3, 4].map(i => `<i class="${i <= wz.step ? "on" : ""}"></i>`).join("")}</div>`;
  let body = "";
  if (wz.step === 1) body = `<h1 class="fr" style="font-size:1.8rem;color:var(--head)">Hi! Three quick questions and your number is ready.</h1>
      <p class="muted" style="margin:.4rem 0 1.2rem;font-weight:600">About a minute. You can change everything later.</p>
      <label class="field"><span>What should I call you? <span class="muted">(optional)</span></span><input class="input" name="name" value="${esc(wz.name)}" autocomplete="given-name"></label>
      <div class="row2"><label class="field"><span>Currency</span><select class="input" name="currency">${currencyOptions(wz.currency)}</select></label>
      <label class="field"><span>Number and date style</span><select class="input" name="locale">${localeOptions(wz.locale)}</select></label></div>`;
  if (wz.step === 2) body = `<h1 class="fr" style="font-size:1.8rem;color:var(--head)">When do you get paid?</h1>
      <p class="muted" style="margin:.4rem 0 1.2rem;font-weight:600">Your plan runs from one payday to the next.</p>${payFields(wz.pay, wz.pay.next || "")}`;
  if (wz.step === 3) body = `<h1 class="fr" style="font-size:1.8rem;color:var(--head)">Your big bills</h1>
      <p class="muted" style="margin:.4rem 0 1rem;font-weight:600">The ones that leave every month. Add the rest any time.</p>
      <div class="ideas">${BILL_IDEAS.map(n => `<button type="button" data-act="wz-idea" data-n="${esc(n)}">+ ${esc(n)}</button>`).join("")}</div>
      <div class="edit-list"><div class="er" style="grid-template-columns:1fr 6rem 4.5rem 2.4rem"><span class="caps">Bill</span><span class="caps">Amount</span><span class="caps">Day</span><span></span></div>
      ${wz.bills.map((b, i) => `<div class="er" style="grid-template-columns:1fr 6rem 4.5rem 2.4rem"><input class="input" name="bn${i}" value="${esc(b.name)}" aria-label="Bill name"><input class="input" name="ba${i}" inputmode="decimal" value="${esc(b.amount)}" placeholder="0" aria-label="Amount"><input class="input" name="bd${i}" type="number" min="1" max="31" inputmode="numeric" value="${esc(b.day)}" placeholder="1" aria-label="Day of month"><button type="button" class="x" data-act="wz-remove" data-i="${i}" aria-label="Remove">&times;</button></div>`).join("")}</div>
      <button type="button" class="btn soft small" data-act="wz-add">+ Another bill</button>`;
  if (wz.step === 4) {
    const irr = wz.pay.rhythm === "irregular";
    body = `<h1 class="fr" style="font-size:1.8rem;color:var(--head)">${irr ? "Money so far this month" : "Since your last payday"}</h1>
      <p class="muted" style="margin:.4rem 0 1.2rem;font-weight:600">${irr ? "How much has come in so far this month? I'll plan from that." : "Roughly how much everyday money do you have left until payday? Not counting bills that haven't left yet."}</p>
      <label class="field"><span>${irr ? "Came in so far" : "Everyday money left"}</span><input class="input" name="left" inputmode="decimal" value="${esc(wz.left)}" placeholder="${esc(symbol())}0"><small>${irr ? "Leave empty if nothing yet." : "Not sure? Leave it empty and I'll start from the full amount."}</small></label>`;
  }
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card card" style="max-width:34rem">
    <div class="logo fr it">Sweet Spot <img src="img/motif-strawberry.png" alt=""></div>${prog}
    <form data-form="setup">${body}
      <div style="display:flex;gap:.6rem;margin-top:1.2rem">${wz.step > 1 ? `<button type="button" class="btn ghost" data-act="wz-back">Back</button>` : ""}<button class="btn primary" type="submit" style="flex:1">${wz.step === 4 ? "Show me my number" : "Next"}</button></div>
      ${wz.step === 3 ? `<div style="text-align:center;margin-top:.5rem"><button type="button" class="btn text small" data-act="wz-skip">Skip, I'll add bills later</button></div>` : ""}
    </form></div></div>`;
  document.querySelector('#app input[name]')?.focus();
}
function guessCurrency() {
  const l = (navigator.language || "en-US").toUpperCase();
  const map = { US: "USD", GB: "GBP", IE: "EUR", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", LT: "EUR", LV: "EUR", EE: "EUR", FI: "EUR", AT: "EUR", BE: "EUR", PT: "EUR", CA: "CAD", AU: "AUD", NZ: "NZD", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CH: "CHF", IN: "INR", ZA: "ZAR" };
  const c = map[l.split("-")[1]] || "USD";
  return CURRENCIES.some(([x]) => x === c) ? c : "USD";
}
function syncWizard() {
  const f = document.querySelector('form[data-form="setup"]'); if (!f) return;
  const v = n => f.elements[n]?.value;
  if (wz.step === 1) Object.assign(wz, { name: v("name") ?? wz.name, currency: v("currency") ?? wz.currency, locale: v("locale") ?? wz.locale });
  if (wz.step === 2) { if (f.elements.amount) wz.pay.amount = v("amount"); if (f.elements.next) wz.pay.next = v("next"); if (f.elements.d1) wz.pay.days = [Number(v("d1")) || 1, Number(v("d2")) || 15]; }
  if (wz.step === 3) wz.bills = wz.bills.map((b, i) => ({ name: v("bn" + i) ?? b.name, amount: v("ba" + i) ?? b.amount, day: v("bd" + i) ?? b.day }));
  if (wz.step === 4) wz.left = v("left");
}
actions["wz-back"] = () => { syncWizard(); wz.step--; renderSetup(); };
actions["wz-add"] = () => { syncWizard(); wz.bills.push({ name: "", amount: "", day: "" }); renderSetup(); };
actions["wz-remove"] = el => { syncWizard(); wz.bills.splice(Number(el.dataset.i), 1); renderSetup(); };
actions["wz-idea"] = el => { syncWizard(); const empty = wz.bills.find(b => !b.name); empty ? (empty.name = el.dataset.n) : wz.bills.push({ name: el.dataset.n, amount: "", day: "" }); renderSetup(); };
actions["wz-skip"] = () => { wz.bills = []; wz.step = 4; renderSetup(); };
forms["setup"] = form => {
  syncWizard();
  if (wz.step === 2) {
    const p = readPay(form, { rhythm: wz.pay.rhythm, days: wz.pay.days }); if (!p) return;
    wz.payFinal = p;
  }
  if (wz.step === 3) {
    const bad = wz.bills.find(b => b.name.trim() && !(num(b.amount) > 0));
    if (bad) return toast(`Add an amount for ${bad.name}, or remove it.`);
  }
  if (wz.step < 4) { wz.step++; return renderSetup(); }
  finishSetup();
};
function finishSetup() {
  const s = S();
  s.profile = { ...s.profile, name: wz.name.trim().slice(0, 30), currency: wz.currency, locale: wz.locale };
  s.pay = { ...s.pay, ...(wz.payFinal || { rhythm: "irregular" }) };
  s.bills = wz.bills.filter(b => b.name.trim() && num(b.amount) > 0).map(b => ({ id: uid(), name: b.name.trim().slice(0, 40), amount: num(b.amount), freq: "monthly", day: Math.min(31, Math.max(1, Number(b.day) || 1)), autopay: false }));
  const p = C.periodOf(s.pay, app.today);
  const left = num(wz.left);
  if (s.pay.rhythm === "irregular") {
    if (left > 0) s.tx.push({ id: uid(), date: app.today, amount: left, note: "Money in so far", kind: "income" });
  }
  const plan = C.planFor(s, p, app.today);
  s.pots = defaultPots(Math.max(0, plan.everyday));
  const diff = C.round2(plan.everyday - C.sum(s.pots, x => x.budget));
  if (s.pots.length && diff) s.pots[s.pots.length - 1].budget = Math.max(0, C.round2(s.pots[s.pots.length - 1].budget + diff));
  s.quick = defaultQuick(s.pots);
  if (s.pay.rhythm !== "irregular" && left >= 0 && isFinite(left) && left < plan.everyday && p.start < app.today) {
    s.tx.push({ id: uid(), date: C.addDays(app.today, -1), amount: C.round2(plan.everyday - left), potId: "_before", note: "Spent before Sweet Spot", kind: "spend" });
  }
  s.routineDone[p.start] = true;
  s.meta.setupDone = true;
  s.meta.createdAt = new Date().toISOString();
  commit(null, { render: false });
  store.askToPersist();
  wz = null;
  app.view = "today";
  app.start();
  if (isIOS() && !isStandalone()) setTimeout(() => actions["install-help"](), 600);
}
