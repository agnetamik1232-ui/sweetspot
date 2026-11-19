// Sweet Spot — start-up, and one listener for every click, form and input.
import * as C from "./calc.js";
import { app, actions, forms, live, render, commit, closeSheet, isSheetOpen, toast } from "./core.js";
import { shell } from "./views.js";
import { applyLook, renderUnlock, renderSetup, welcomeBack } from "./flows.js";
import { blankState } from "./model.js";
import { demoState } from "./demo.js";
import * as store from "./store.js";

const params = new URLSearchParams(location.search);
app.demo = params.has("demo");
app.photo = app.demo && params.has("photo");

function renderApp() {
  const y = scrollY;
  document.getElementById("app").innerHTML = shell();
  if (y) scrollTo(0, y);
}

app.start = () => {
  app.renderFn = renderApp;
  applyLook();
  renderApp();
  if (app.demo) { demoExtras(); return; }
  const d = C.daysSinceLastSpend(app.S, app.today);
  if (d != null && d >= 4 && app.S.meta.welcomeBackShown !== app.today) {
    commit(s => { s.meta.welcomeBackShown = app.today; }, { render: false });
    welcomeBack(d);
  }
};

// Demo only: open a given screen straight away (used for listing photos and videos).
//   ?demo&photo            hide the demo banner
//   &look=matcha&dark=on   another look
//   &view=plan             another page
//   &open=afford&item=Headphones&price=79 | add&amount=12.40&note=Lunch | welcome | explain | payday | import
function demoExtras() {
  const look = params.get("look"), dark = params.get("dark"), view = params.get("view"), open = params.get("open");
  if (look || dark) { if (look) app.S.profile.look = look; if (dark) app.S.profile.dark = dark; applyLook(); }
  if (view) app.view = view;
  if (look || dark || view) render();
  const fire = (act, el = document.createElement("button")) => actions[act]?.(el);
  if (params.has("welcome") || open === "welcome") welcomeBack(6);
  if (open === "explain" || open === "payday" || open === "import") fire(open === "import" ? "import-bank" : open);
  if (open === "import" && params.get("step") === "2") setTimeout(() => fire("imp-next"), 0);
  if (open === "add") {
    fire("add-spend");
    const pot = params.get("pot") && [...document.querySelectorAll(".potbtn[data-id]")].find(b => b.textContent.toLowerCase().startsWith(params.get("pot").toLowerCase()));
    if (pot) pot.click();
    const f = document.querySelector('form[data-form="spend"]');
    if (f) { f.elements.amount.value = params.get("amount") || ""; f.elements.note.value = params.get("note") || ""; live["spend-amt"](f.elements.amount); f.elements.amount.blur(); }
  }
  if (open === "afford") {
    fire("afford");
    const f = document.querySelector('form[data-form="afford"]');
    if (f) { f.elements.name.value = params.get("item") || ""; f.elements.price.value = params.get("price") || ""; live["afford"](); document.activeElement?.blur(); }
  }
}

forms["profile"] = f => {
  commit(s => { s.profile.name = f.elements.name.value.trim().slice(0, 30); s.profile.currency = f.elements.currency.value; s.profile.locale = f.elements.locale.value; });
  toast("Saved.");
};

document.addEventListener("click", e => {
  const scrim = e.target.closest("[data-scrim]");
  if (scrim && e.target === scrim) { closeSheet(); return; }
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form]");
  if (!f) return;
  e.preventDefault();
  forms[f.dataset.form]?.(f, e);
});
const isChoice = el => el.type === "checkbox" || el.type === "radio" || el.tagName === "SELECT";
document.addEventListener("input", e => { const el = e.target.closest("[data-live]"); if (el && !isChoice(el)) live[el.dataset.live]?.(el, e); });
document.addEventListener("change", e => { const el = e.target.closest("[data-live]"); if (el && isChoice(el)) live[el.dataset.live]?.(el, e); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && isSheetOpen()) closeSheet(); });

function checkDay() { const t = C.todayISO(); if (t !== app.today) { app.today = t; if (app.renderFn && !isSheetOpen()) render(); } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkDay(); });
setInterval(checkDay, 60000);
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => app.S && applyLook()); } catch { /* old Safari */ }

async function boot() {
  if (app.demo) { app.S = demoState(app.today); app.start(); return; }
  const s = await store.load();
  app.S = s || blankState();
  applyLook();
  if (!s || !s.meta.unlocked) return renderUnlock();
  if (!s.meta.setupDone) return renderSetup();
  app.start();
}
boot().catch(err => {
  console.error(err);
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card card"><h1 class="fr" style="color:var(--head)">Something went wrong</h1><p style="margin:.6rem 0 1rem">Your data is safe on this device. Try reloading. If it keeps happening, message the shop with this: ${String(err && err.message || err).replace(/[<>&]/g, "")}</p><button class="btn primary" onclick="location.reload()">Reload</button></div></div>`;
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
