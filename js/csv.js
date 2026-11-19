// Sweet Spot — reading bank statement CSV files (and Dear Agneta sheet exports).
import { iso } from "./calc.js";

export function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/).find(l => l.trim()) || "";
  const delim = [";", ",", "\t", "|"].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell.trim()); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(x => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some(x => x !== "")) rows.push(row);
  // Some banks put a few info lines above the real header: start at the first row that looks like a header.
  let h = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i].map(x => x.toLowerCase());
    if (r.length >= 3 && r.some(x => /date|datum|data|fecha|booking|posted/.test(x)) && r.some(x => /amount|sum|value|betrag|importe|suma|debit|credit|paid|out|in\b/.test(x))) { h = i; break; }
  }
  const header = rows[h] || [];
  const width = header.length;
  return { delim, header, rows: rows.slice(h + 1).filter(r => r.length >= Math.min(3, width)) };
}

const has = (h, re) => h.findIndex(x => re.test(x.toLowerCase()));
export function guessColumns(header) {
  const g = {
    date: has(header, /^(transaction |booking |posting |value )?date|datum|^data|fecha|completed|started|posted/),
    desc: has(header, /description|details|payee|merchant|narrative|counterparty|beneficiary|reference|name|memo|text|what|gav[eė]jas|pavadinimas|paskirtis/),
    amount: has(header, /^amount|amount$|^sum|value|betrag|importe|suma|^total/),
    out: has(header, /debit|withdrawal|paid out|money out|^out$|outflow|spent/),
    in: has(header, /credit|deposit|paid in|money in|^in$|inflow/),
    pot: has(header, /category|pot|kategorija/),
  };
  if (g.amount >= 0 && (g.amount === g.out || g.amount === g.in)) g.amount = -1;
  if (g.amount < 0 && g.out < 0) g.amount = has(header, /amount|sum/);
  return g;
}

export function toNumber(v) {
  if (v == null) return NaN;
  let s = String(v).trim();
  if (!s) return NaN;
  let neg = /^\(.*\)$/.test(s) || /-\s*$/.test(s) || /^-/.test(s.replace(/[^\d\-().,]/g, ""));
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return NaN;
  const c = s.lastIndexOf(","), d = s.lastIndexOf(".");
  if (c > d) { s = s.replace(/\./g, "").replace(",", "."); }
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return neg ? -n : n;
}

const DATE_FORMATS = ["ymd", "dmy", "mdy"];
function splitDate(v) {
  const m = String(v).trim().match(/^(\d{1,4})[./\- ](\d{1,2})[./\- ](\d{1,4})/);
  return m ? [m[1], m[2], m[3]].map(Number) : null;
}
export function guessDateFormat(values, locale = "en-US") {
  const parts = values.map(splitDate).filter(Boolean);
  if (!parts.length) return "ymd";
  if (parts.every(p => p[0] > 31)) return "ymd";
  if (parts.some(p => p[0] > 12)) return "dmy";
  if (parts.some(p => p[1] > 12)) return "mdy";
  return /^en-US|^en-CA|^en-PH/.test(locale) ? "mdy" : "dmy";
}
export function toISODate(v, fmt) {
  const p = splitDate(v);
  if (!p) {
    const t = Date.parse(v);
    if (isNaN(t)) return null;
    const d = new Date(t); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  let [a, b, c] = p, y, m, d;
  if (fmt === "ymd" || a > 31) [y, m, d] = [a, b, c];
  else if (fmt === "mdy") [m, d, y] = [a, b, c];
  else [d, m, y] = [a, b, c];
  if (y < 100) y += 2000;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  return iso(y, m, d);
}
export { DATE_FORMATS };

// A short, stable key for a shop so we can remember which pot it goes in.
export function shopKey(desc) {
  const words = String(desc || "").toLowerCase()
    .replace(/(card|visa|mastercard|pos|purchase|payment|contactless|debit|transaction|apple pay|google pay|pay)\b/g, " ")
    .replace(/[^a-zà-ž\s]/g, " ").split(/\s+/).filter(w => w.length > 1);
  return words.slice(0, words[0] && words[0].length >= 4 ? 1 : 2).join(" ");
}

export function guessPot(desc, rules) {
  const k = shopKey(desc);
  if (k && rules[k]) return rules[k];
  const low = String(desc || "").toLowerCase();
  for (const [key, pot] of Object.entries(rules)) if (key.length >= 3 && low.includes(key)) return pot;
  return null;
}
