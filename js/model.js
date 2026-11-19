// Sweet Spot — the shape of a buyer's data, and sensible defaults.
export const VERSION = 1;
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const LOOKS = {
  strawberry: "Strawberry",
  blueberry: "Blueberry",
  matcha: "Matcha",
  academia: "Academia",
};

export const CURRENCIES = [
  ["USD", "US dollar ($)"], ["EUR", "Euro (€)"], ["GBP", "Pound (£)"], ["CAD", "Canadian dollar ($)"],
  ["AUD", "Australian dollar ($)"], ["NZD", "New Zealand dollar ($)"], ["CHF", "Swiss franc"], ["SEK", "Swedish krona"],
  ["NOK", "Norwegian krone"], ["DKK", "Danish krone"], ["PLN", "Polish złoty"], ["CZK", "Czech koruna"],
  ["HUF", "Hungarian forint"], ["RON", "Romanian leu"], ["ZAR", "South African rand"], ["INR", "Indian rupee"],
  ["SGD", "Singapore dollar"], ["HKD", "Hong Kong dollar"], ["JPY", "Japanese yen"], ["MXN", "Mexican peso"],
  ["BRL", "Brazilian real"], ["PHP", "Philippine peso"], ["AED", "UAE dirham"], ["ILS", "Israeli shekel"],
];

export const DEFAULT_POTS = [
  ["Groceries", 0.40, 0], ["Eating out", 0.15, 1], ["Transport", 0.20, 2], ["Fun", 0.15, 3], ["Other", 0.10, 4],
];

export const BILL_IDEAS = ["Rent", "Mortgage", "Phone", "Internet", "Electricity", "Water", "Insurance", "Streaming", "Gym", "Childcare", "Car loan", "Student loan"];

export function blankState() {
  return {
    version: VERSION,
    profile: { name: "", currency: "USD", locale: navigatorLocale(), look: "strawberry", dark: "auto", bigText: false, easyFont: false, hideAmounts: false },
    pay: { rhythm: "monthly", anchor: null, day: 25, days: [1, 15], amount: 0 },
    bills: [], pots: [], goals: [], debts: [], tx: [],
    billPaid: {}, periodIncome: {}, periodCarry: {}, routineDone: {},
    waitlist: [], skipped: [], quick: [], rules: {}, csvMaps: {},
    meta: { createdAt: new Date().toISOString(), setupDone: false, lastBackup: null, unlocked: false, demo: false, welcomeBackShown: null, installHintSeen: false },
  };
}

function navigatorLocale() {
  try { return navigator.language || "en-US"; } catch { return "en-US"; }
}

export function defaultPots(everyday) {
  return DEFAULT_POTS.map(([name, share, color]) => ({ id: uid(), name, color, budget: Math.max(0, Math.round(everyday * share)) }));
}

export function defaultQuick(pots) {
  const by = n => pots.find(p => p.name === n)?.id || pots[0]?.id;
  return [
    { id: uid(), label: "Coffee", amount: 4.5, potId: by("Eating out") },
    { id: uid(), label: "Groceries", amount: null, potId: by("Groceries") },
    { id: uid(), label: "Lunch out", amount: 12, potId: by("Eating out") },
    { id: uid(), label: "Bus ticket", amount: 2.4, potId: by("Transport") },
    { id: uid(), label: "Something else", amount: null, potId: by("Other") },
  ];
}

// Bring older or imported data up to the current shape without losing anything.
export function normalise(s) {
  const b = blankState();
  const out = { ...b, ...s };
  out.profile = { ...b.profile, ...(s.profile || {}) };
  out.pay = { ...b.pay, ...(s.pay || {}) };
  out.meta = { ...b.meta, ...(s.meta || {}) };
  for (const k of ["bills", "pots", "goals", "debts", "tx", "waitlist", "skipped", "quick"]) out[k] = Array.isArray(s[k]) ? s[k] : [];
  for (const k of ["billPaid", "periodIncome", "periodCarry", "routineDone", "rules", "csvMaps"]) out[k] = s[k] && typeof s[k] === "object" ? s[k] : {};
  out.version = VERSION;
  return out;
}
