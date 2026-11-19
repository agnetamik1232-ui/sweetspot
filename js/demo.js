// Sweet Spot — example data for the free demo (Mia). Always built around today's date,
// so the demo never shows stale numbers.
import { addDays, parts, periodOf, prevPeriod, billItems, sum, round2, weekday } from "./calc.js";
import { blankState, uid } from "./model.js";

function rng(seed) { let x = seed; return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648; }

export function demoState(today) {
  const s = blankState();
  s.profile = { ...s.profile, name: "Mia", currency: "USD", locale: "en-US" };
  s.pay = { rhythm: "biweekly", anchor: addDays(today, -6), day: 25, days: [1, 15], amount: 1900 };
  s.meta = { ...s.meta, setupDone: true, unlocked: true, demo: true, lastBackup: new Date(Date.now() - 3 * 86400000).toISOString(), installHintSeen: true };

  const pot = (name, color, budget) => ({ id: uid(), name, color, budget });
  const P = { g: pot("Groceries", 0, 260), e: pot("Eating out", 1, 90), t: pot("Transport", 2, 120), f: pot("Fun", 3, 80), o: pot("Other", 4, 70) };
  s.pots = Object.values(P);
  s.quick = [
    { id: uid(), label: "Coffee", amount: 4.5, potId: P.e.id },
    { id: uid(), label: "Groceries", amount: null, potId: P.g.id },
    { id: uid(), label: "Lunch out", amount: 12, potId: P.e.id },
    { id: uid(), label: "Bus ticket", amount: 2.4, potId: P.t.id },
    { id: uid(), label: "Something else", amount: null, potId: P.o.id },
  ];

  const dom = n => parts(addDays(today, n))[2];
  const bill = (name, amount, offset, autopay = false) => ({ id: uid(), name, amount, freq: "monthly", day: dom(offset), autopay });
  s.bills = [bill("Rent", 780, -6), bill("Phone plan", 45, 1), bill("Electricity", 68, 4), bill("Streaming", 13, 5, true), bill("Car insurance", 114, 6)];

  const ef = { id: uid(), name: "Emergency fund", target: 3000, perPeriod: 150, start: 0, color: 2 };
  const trip = { id: uid(), name: "Lisbon trip", target: 900, perPeriod: 50, start: 0, color: 1 };
  s.goals = [ef, trip];
  const card = { id: uid(), name: "Credit card", start: 1480, rate: 22.9, perPeriod: 60 };
  s.debts = [card];

  const tx = (date, amount, potId, note, kind = "spend", extra = {}) => s.tx.push({ id: uid(), date, amount: round2(amount), potId, note, kind, ...extra });

  // This pay period, day by day (matches the mockup).
  const d = n => addDays(today, n - 7);
  tx(d(1), 48.2, P.g.id, "Lidl"); tx(d(1), 16, P.t.id, "Bus pass top-up");
  tx(d(2), 23.8, P.e.id, "Lunch with Ella"); tx(d(2), 18, P.f.id, "Cinema");
  tx(d(3), 18, P.g.id, "Farmers market");
  tx(d(5), 72.4, P.g.id, "Big shop"); tx(d(5), 24, P.e.id, "Pizza night");
  tx(d(6), 33.4, P.g.id, "Aldi"); tx(d(6), 30, P.t.id, "Fuel"); tx(d(6), 13, P.f.id, "Book"); tx(d(6), 9, P.o.id, "Pharmacy"); tx(d(6), 5.7, P.e.id, "Bakery");
  tx(today, 4.5, P.e.id, "Coffee");

  // About four months of history before that.
  const r = rng(parts(today).reduce((a, b) => a * 31 + b, 7));
  const cur = periodOf(s.pay, today);
  const shops = { g: ["Lidl", "Aldi", "Tesco", "Farmers market", "Big shop", "Corner shop"], e: ["Coffee", "Lunch out", "Takeaway", "Bakery", "Brunch"], t: ["Fuel", "Bus ticket", "Train"], f: ["Cinema", "Book", "Drinks", "Concert", "Plants"], o: ["Pharmacy", "Gift", "Haircut", "Post office"] };
  const pick = a => a[Math.floor(r() * a.length)];
  for (let day = addDays(cur.start, -120); day < cur.start; day = addDays(day, 1)) {
    const wd = weekday(day);
    if (r() < 0.38) tx(day, 30 + r() * 60, P.g.id, pick(shops.g));
    if (r() < (wd === 5 || wd === 6 ? 0.6 : 0.33)) tx(day, 5 + r() * 25, P.e.id, pick(shops.e));
    if (r() < 0.25) tx(day, 10 + r() * 35, P.t.id, pick(shops.t));
    if (r() < (wd === 6 ? 0.45 : 0.13)) tx(day, 10 + r() * 40, P.f.id, pick(shops.f));
    if (r() < 0.08) tx(day, 8 + r() * 30, P.o.id, pick(shops.o));
  }

  // Past paydays: savings moved, debt paid, routine done, bills paid.
  for (let p = prevPeriod(s.pay, cur), i = 0; i < 9; i++, p = prevPeriod(s.pay, p)) {
    tx(p.start, ef.perPeriod, null, "Payday saving", "save", { goalId: ef.id });
    tx(p.start, trip.perPeriod, null, "Payday saving", "save", { goalId: trip.id });
    tx(p.start, card.perPeriod, null, "Payday payment", "debt", { debtId: card.id });
    s.routineDone[p.start] = true;
  }
  tx(cur.start, ef.perPeriod, null, "Payday saving", "save", { goalId: ef.id });
  tx(cur.start, trip.perPeriod, null, "Payday saving", "save", { goalId: trip.id });
  tx(cur.start, card.perPeriod, null, "Payday payment", "debt", { debtId: card.id });
  s.routineDone[cur.start] = true;
  ef.start = 1450 - sum(s.tx.filter(t => t.goalId === ef.id), t => t.amount);
  trip.start = 380 - sum(s.tx.filter(t => t.goalId === trip.id), t => t.amount);
  for (const b of billItems(s, addDays(today, -200), addDays(today, -1), today)) s.billPaid[b.key] = true;

  s.waitlist = [{ id: uid(), name: "Noise-cancelling headphones", amount: 79, added: addDays(today, -3), remindOn: periodOf(s.pay, today).next, status: "waiting" }];
  s.skipped = [
    { id: uid(), name: "Ankle boots", amount: 129, date: addDays(today, -4) },
    { id: uid(), name: "Lip set", amount: 35, date: addDays(today, -11) },
    { id: uid(), name: "Concert merch", amount: 50, date: addDays(today, -19) },
  ];
  s.rules = { lidl: P.g.id, aldi: P.g.id, tesco: P.g.id, shell: P.t.id, uber: P.t.id, netflix: P.f.id, starbucks: P.e.id, costa: P.e.id };
  s.tx.sort((a, b) => a.date.localeCompare(b.date));
  return s;
}
