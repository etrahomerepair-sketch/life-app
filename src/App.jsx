import React, { useState, useEffect, useMemo, useRef } from "react";

/* =====================================================================
   LIFE LEDGER  v3  —  AI-run life tracker (RPG character sheet)
   ---------------------------------------------------------------------
   THE TWO AI ROLES (swap these two functions for your Mimo endpoint):
     • processEntry()  — fires on EVERY saved entry. Cleans messy input
                          into structured stats, extracts things from free
                          text (e.g. gambling losses), tags them, and can
                          mint new quests. This is what writes to the charts.
     • askOracle()     — manual "give me a reading" on the Oracle tab.
   Both send a system prompt (MIMO_SYSTEM_PROMPT / ORACLE_SYSTEM_PROMPT)
   that defines the job + exact JSON contract, so the model isn't guessing.
   Deterministic math still runs as a fallback so the app never blocks if
   the AI is offline.
   ===================================================================== */

const CONFIG = {
  baseLifespan: { male: 79.5, female: 84, other: 81.5 },
  recentWindow: 6,
  recencyWeighting: true,
  idealHabits: { workoutsWk: 5, drinksWk: 1, sleep: 8, diet: 4, mood: 4, gambleLostWk: 0, has: true },
  ranks: [
    { at: 0, name: "Wanderer" }, { at: 3, name: "Squire" }, { at: 8, name: "Chronicler" },
    { at: 16, name: "Knight" }, { at: 28, name: "Warden" }, { at: 45, name: "Sage" }, { at: 70, name: "Legend" },
  ],
  // The only quest types the AI may invent. Keeps dynamic quests evaluable.
  questMetrics: ["avoid_tag", "hit_workouts", "limit_drinks", "save_amount", "log_streak"],
};

const MEAL_PTS = { healthy: 5, mixed: 3, junk: 1, skipped: 2.5 };
const MEAL_OPTS = [["healthy", "Healthy"], ["mixed", "Mixed"], ["junk", "Junk"], ["skipped", "Skipped"]];

/* =====================================================================
   MIMO SPEC — the Ledger Scribe. Fires on every entry.
   ===================================================================== */
const MIMO_SYSTEM_PROMPT =
`You are the LEDGER SCRIBE for an app called Life Ledger — a real-life tracker styled as an RPG.
You receive a player's profile and ONE new journal entry: structured fields plus a free-text note.

YOUR JOB
1. Turn messy input into clean structured data the app's deterministic engine can use.
2. Read the free-text note and EXTRACT anything notable not already in the fields
   (money won/lost gambling, junk food, skipped workouts, illness, overtime, big purchases, etc).
3. Optionally propose ONE new quest tailored to what the player did or should do next.

RULES
- Never invent facts the entry doesn't support. If a field isn't implied, return null for it.
- Only fill a structured field if the note implies a value the form missed. Don't overwrite given values.
- Money: "earned"/"spent" are normal income/expenses. Gambling is SEPARATE — put it in "gambling".
- No medical diagnosis. Keep any guidance gentle, specific, non-extreme, encouraging.
- "insight" is ONE short sentence in a warm scribe voice.
- tags: short lowercase kebab labels for themes, e.g. ["gambling","junk-food","overtime"].
- newQuest is null OR an object whose "metric" is EXACTLY one of:
  ${CONFIG.questMetrics.join(", ")}.
    avoid_tag   → also give "tag" (string) and "target" (number of entries to avoid it).
    hit_workouts→ "target" = weekly workouts to reach.
    limit_drinks→ "target" = max drinks/week.
    save_amount → "target" = dollars to bank.
    log_streak  → "target" = entries in a row.
  Quest "title" <= 4 words, "desc" <= 10 words. Don't repeat a quest title already active.

OUTPUT: respond with ONLY valid JSON, no markdown, no preamble, EXACTLY this shape:
{
  "summary": "one short plain-language line summarizing this entry",
  "insight": "one warm coaching sentence",
  "extracted": {
    "workouts": number|null, "drinks": number|null, "sleep": number|null,
    "dietScore": number|null, "mood": number|null,
    "earned": number|null, "spent": number|null,
    "gambling": { "won": number, "lost": number }
  },
  "tags": ["..."],
  "newQuest": null | { "title":"", "desc":"", "metric":"", "tag":"", "target":0 }
}`;

const ORACLE_SYSTEM_PROMPT =
`You are THE ORACLE inside Life Ledger — a wise, encouraging life-coach voice.
Read the player's profile + recent ledger and give grounded, general wellbeing guidance.
No medical diagnosis, no extreme regimens, never alarmist. Reward good habits; suggest small steps.
Respond with ONLY valid JSON, no markdown, exactly:
{
  "reading": "2-3 sentence narrative of where they stand, warm oracle voice",
  "observations": ["3 short specific evidence-based notes about their habits/trends"],
  "quests": [{"title":"short name","why":"one line on the payoff"}],
  "forecastNote": "one line: the single habit that would move their forecast most, and why"
}`;

/* ----------------------------- helpers ----------------------------- */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round1 = (n) => Math.round(n * 10) / 10;
const fmtMoney = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-CA");
const wk = (e, f) => (Number(e[f]) || 0) * (e.period === "day" ? 7 : 1);
const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));

function dietFromMeals(meals) {
  const vals = ["breakfast", "lunch", "dinner"].map((m) => MEAL_PTS[meals?.[m]]).filter((v) => v != null);
  if (!vals.length) return 3;
  return round1(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function recentAverages(entries) {
  const recent = entries.slice(0, CONFIG.recentWindow);
  if (!recent.length) return { workoutsWk: 0, drinksWk: 0, sleep: 7, diet: 3, mood: 3, gambleLostWk: 0, has: false };
  const w = (i) => (CONFIG.recencyWeighting ? recent.length - i : 1);
  const tot = recent.reduce((s, _, i) => s + w(i), 0);
  const a = (fn) => recent.reduce((s, e, i) => s + fn(e) * w(i), 0) / tot;
  return {
    workoutsWk: a((e) => wk(e, "workouts")), drinksWk: a((e) => wk(e, "drinks")),
    sleep: a((e) => Number(e.sleep) || 7), diet: a((e) => Number(e.diet) || 3),
    mood: a((e) => Number(e.mood) || 3), gambleLostWk: a((e) => wk(e, "gambleLost")), has: true,
  };
}

function computeForecast(profile, hab) {
  const base = CONFIG.baseLifespan[profile.sex] ?? CONFIG.baseLifespan.other;
  const mods = [];
  if (hab.has) {
    mods.push(hab.workoutsWk >= 1 ? { label: "Training", value: round1((Math.min(hab.workoutsWk, 5) / 5) * 3) } : { label: "Sedentary", value: -1 });
    const d = hab.drinksWk;
    mods.push({ label: "Drink", value: d > 21 ? -5 : d > 14 ? -3 : d > 7 ? -1.5 : d > 2 ? 0 : 0.3 });
    mods.push({ label: "Rest", value: hab.sleep >= 7 && hab.sleep <= 9 ? 1 : hab.sleep < 6 || hab.sleep > 10 ? -1.5 : -0.3 });
    mods.push({ label: "Diet", value: round1(((hab.diet - 3) / 2) * 2) });
    mods.push({ label: "Spirit", value: round1(((hab.mood - 3) / 2) * 1.5) });
  }
  if (profile.smoker) mods.push({ label: "Tobacco", value: -7 });
  const sum = mods.reduce((s, m) => s + m.value, 0);
  const est = clamp(base + sum, profile.age + 0.5, 112);
  const rem = Math.max(0, est - profile.age);
  return { base, estLifespan: round1(est), remainingYears: round1(rem), remainingDays: Math.round(rem * 365.25), mods: mods.filter((m) => m.value !== 0) };
}
const computePotential = (p) => computeForecast({ ...p, smoker: false }, CONFIG.idealHabits).remainingYears;

function computeAttributes(p, hab, gold, savingsRate, deeds, streak) {
  const vitality = clamp(40 + (hab.sleep >= 7 && hab.sleep <= 9 ? 18 : -10) + (hab.diet - 3) * 9 + (hab.mood - 3) * 6 + (p.smoker ? -20 : 8), 0, 100);
  const might = clamp((Math.min(hab.workoutsWk, 6) / 6) * 100, 0, 100);
  const goldScore = gold > 0 ? Math.log10(gold + 10) / 6 : 0;
  const fortune = clamp(goldScore * 70 + clamp(savingsRate, 0, 0.5) * 60, 0, 100);
  const temperance = clamp(50 + (10 - Math.min(hab.drinksWk, 20)) * 2.5 + Math.min(streak, 10) * 3 - clamp(hab.gambleLostWk / 40, 0, 18), 0, 100);
  const spirit = clamp(35 + (hab.mood - 3) * 14 + Math.min(deeds, 20) * 1.5, 0, 100);
  return { Vitality: Math.round(vitality), Might: Math.round(might), Fortune: Math.round(fortune), Temperance: Math.round(temperance), Spirit: Math.round(spirit) };
}

function computeStreak(entries) {
  if (!entries.length) return 0;
  const dates = entries.map((e) => new Date(e.date)).sort((a, b) => b - a);
  let s = 1;
  for (let i = 1; i < dates.length; i++) { if ((dates[i - 1] - dates[i]) / 86400000 <= 8) s++; else break; }
  return s;
}
function rankFor(deeds) {
  let cur = CONFIG.ranks[0], next = null;
  CONFIG.ranks.forEach((r, i) => { if (deeds >= r.at) { cur = r; next = CONFIG.ranks[i + 1] || null; } });
  return { current: cur, next };
}

// Built-in quests + AI-created dynamic quests, all evaluated to progress 0..1.
function entryTags(e) {
  const t = new Set((e.tags || []).map((x) => String(x).toLowerCase()));
  if ((Number(e.gambleLost) || 0) > 0 || (Number(e.gambleWon) || 0) > 0) t.add("gambling");
  return t;
}
function avoidStreak(entries, tag) {
  let n = 0;
  for (const e of entries) { if (entryTags(e).has(tag)) break; n++; }
  return n;
}
function evalDynamic(q, d) {
  const { entries, hab, gold, startGold, streak } = d;
  switch (q.metric) {
    case "avoid_tag": return clamp(avoidStreak(entries, (q.tag || "").toLowerCase()) / (q.target || 7), 0, 1);
    case "hit_workouts": return clamp(hab.workoutsWk / (q.target || 5), 0, 1);
    case "limit_drinks": return hab.drinksWk <= (q.target || 7) ? 1 : clamp((q.target || 7) / Math.max(hab.drinksWk, 1), 0, 1);
    case "save_amount": return clamp((gold - startGold) / (q.target || 1000), 0, 1);
    case "log_streak": return clamp(streak / (q.target || 7), 0, 1);
    default: return 0;
  }
}
function computeQuests(d, dynamic) {
  const { entries, gold, startGold, streak, hab, deeds } = d;
  const dryWeek = entries.some((e) => e.period === "week" && Number(e.drinks) === 0);
  const ironWeek = entries.some((e) => wk(e, "workouts") >= 5);
  const wellRested = hab.has && hab.sleep >= 7 && hab.sleep <= 9;
  const earned = gold - startGold;
  const base = [
    { id: "first", title: "First Blood", desc: "Record your first deed", p: deeds >= 1 ? 1 : 0 },
    { id: "streak7", title: "Unbroken", desc: "7-entry streak", p: clamp(streak / 7, 0, 1) },
    { id: "iron", title: "Iron Body", desc: "5 workouts in one week", p: ironWeek ? 1 : clamp(hab.workoutsWk / 5, 0, 1) },
    { id: "dry", title: "Clear Head", desc: "Log a week with 0 drinks", p: dryWeek ? 1 : 0 },
    { id: "rest", title: "Well-Rested", desc: "Hold 7-9h sleep", p: wellRested ? 1 : clamp(hab.sleep / 7, 0, 1) },
    { id: "treasure", title: "Treasurer", desc: "Bank $1,000", p: clamp(earned / 1000, 0, 1) },
  ];
  const dyn = (dynamic || []).map((q) => ({ id: q.id, title: q.title, desc: q.desc, ai: true, p: evalDynamic(q, d) }));
  return [...dyn, ...base];
}

/* ----------------------- AI calls (swap for Mimo) -----------------------
   TEST build: uses the keyless endpoint the artifact runtime provides.
   REAL build: flip AI.useMimo = true and point mimoProxyUrl at YOUR OWN
   backend route. That server holds the Xiaomi MiMo key and forwards the
   call. The key must NEVER live in this client file. The proxy should
   return either a raw JSON string or { text: "...json..." }.
------------------------------------------------------------------------ */
const AI = {
  useMimo: true,                             // LIVE — routing through the Netlify function
  mimoProxyUrl: "/.netlify/functions/mimo",  // same-site relative path (no CORS needed)
  anthropicModel: "claude-sonnet-4-6",       // only used as a keyless fallback if useMimo=false
};

function extractJSON(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("model returned no JSON");
  return JSON.parse(text.slice(a, b + 1));
}

async function callModel(system, userObj) {
  if (AI.useMimo) {
    const r = await fetch(AI.mimoProxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, input: userObj }),
    });
    if (!r.ok) throw new Error("proxy HTTP " + r.status);
    const j = await r.json();
    return extractJSON(typeof j === "string" ? j : j.text || JSON.stringify(j));
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: AI.anthropicModel, max_tokens: 1000, system, messages: [{ role: "user", content: JSON.stringify(userObj) }] }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (!text) throw new Error("empty model reply");
  return extractJSON(text);
}

// Fires on EVERY entry.
async function processEntry(profile, entry, ctx) {
  return callModel(MIMO_SYSTEM_PROMPT, {
    profile: { name: profile.name, age: profile.age, sex: profile.sex, place: [profile.city, profile.country].filter(Boolean).join(", "), smoker: !!profile.smoker },
    entry, recentTags: ctx.recentTags, activeQuestTitles: ctx.activeQuestTitles,
  });
}

// Manual reading.
async function askOracle(profile, entries, d) {
  const ledger = entries.slice(0, 8).map((e) => ({ date: e.date, period: e.period, workouts: e.workouts, drinks: e.drinks, sleep: e.sleep, diet: e.diet, mood: e.mood, gambleLost: e.gambleLost, saved: (Number(e.earned) || 0) - (Number(e.spent) || 0), tags: e.tags }));
  return callModel(ORACLE_SYSTEM_PROMPT, {
    profile: { name: profile.name, age: profile.age, sex: profile.sex, smoker: !!profile.smoker },
    stats: { forecastYearsRemaining: d.forecast.remainingYears, potentialYearsRemaining: d.potential, attributes: d.attrs, gold: d.gold, streak: d.streak },
    recentHabitsWeekly: { workouts: round1(d.hab.workoutsWk), drinks: round1(d.hab.drinksWk), sleepHrs: round1(d.hab.sleep), diet1to5: round1(d.hab.diet), mood1to5: round1(d.hab.mood), gamblingLost: round1(d.hab.gambleLostWk) },
    ledger,
  });
}

/* ----------------------------- storage ----------------------------- */
const KEY_P = "lifeledger3:profile", KEY_E = "lifeledger3:entries", KEY_O = "lifeledger3:oracle", KEY_Q = "lifeledger3:quests";
/* Storage: uses the artifact's window.storage inside Claude's preview, and
   falls back to localStorage on the real deployed site. Swap to Supabase for
   multi-device (see BUILD.md — the calls are already async). */
async function storeGet(k) {
  try {
    if (window.storage) { const r = await window.storage.get(k, false); return r ? JSON.parse(r.value) : null; }
    const v = localStorage.getItem(k); return v ? JSON.parse(v) : null;
  } catch { return null; }
}
async function storeSet(k, v) {
  try {
    if (window.storage) { await window.storage.set(k, JSON.stringify(v), false); return; }
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

/* ----------------------------- palette ----------------------------- */
const C = { ink: "#13100B", ink2: "#1B1610", card: "#221C14", line: "#3A3022", parch: "#EBE0C6", dim: "#9A8C72", gold: "#C8A96E", goldHi: "#EAD08A", ember: "#BC4D2E", sage: "#86A063" };

function useCount(target, ms = 900) {
  const [v, setV] = useState(0); const ref = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setV(target); return; }
    const from = ref.current, start = performance.now(); let raf;
    const tick = (t) => { const p = clamp((t - start) / ms, 0, 1); const e = 1 - Math.pow(1 - p, 3); setV(from + (target - from) * e); if (p < 1) raf = requestAnimationFrame(tick); else ref.current = target; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/* =================================================================== */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [dynQuests, setDynQuests] = useState([]);
  const [oracle, setOracle] = useState(null);
  const [tab, setTab] = useState("hero");
  const [editing, setEditing] = useState(false);
  const [lastAI, setLastAI] = useState(null); // {summary, insight, ok} for a quick toast

  useEffect(() => {
    (async () => {
      const [p, e, o, q] = await Promise.all([storeGet(KEY_P), storeGet(KEY_E), storeGet(KEY_O), storeGet(KEY_Q)]);
      if (p) setProfile(p); if (Array.isArray(e)) setEntries(e); if (o) setOracle(o); if (Array.isArray(q)) setDynQuests(q);
      setLoading(false);
    })();
  }, []);

  const saveProfile = (p) => { setProfile(p); storeSet(KEY_P, p); setEditing(false); setTab("hero"); };
  const resetAll = () => { setProfile(null); setEntries([]); setOracle(null); setDynQuests([]); [KEY_P, KEY_E, KEY_O, KEY_Q].forEach((k) => storeSet(k, k === KEY_E || k === KEY_Q ? [] : null)); setEditing(false); };
  const saveOracle = (o) => { setOracle(o); storeSet(KEY_O, o); };
  const deleteEntry = (id) => { const n = entries.filter((e) => e.id !== id); setEntries(n); storeSet(KEY_E, n); };

  // The AI-on-every-entry pipeline.
  const addEntry = async (form) => {
    const diet = dietFromMeals(form.meals);
    let en = { ...form, id: Date.now(), diet, gambleWon: 0, gambleLost: 0, tags: [], ai: { ok: false } };
    const ctx = {
      recentTags: Array.from(new Set(entries.slice(0, 6).flatMap((e) => e.tags || []))),
      activeQuestTitles: dynQuests.map((q) => q.title),
    };
    try {
      const r = await processEntry(profile, { date: en.date, period: en.period, workouts: en.workouts, drinks: en.drinks, sleep: en.sleep, meals: en.meals, dietScore: diet, mood: en.mood, earned: num(en.earned), spent: num(en.spent), note: en.notes }, ctx);
      const ex = r.extracted || {};
      // Only fill where the form was empty/zero; always take gambling + tags + refined diet.
      en.workouts = en.workouts || num(ex.workouts) || 0;
      en.drinks = en.drinks || num(ex.drinks) || 0;
      if (num(ex.sleep)) en.sleep = num(ex.sleep);
      if (num(ex.mood)) en.mood = num(ex.mood);
      if (num(ex.dietScore)) en.diet = num(ex.dietScore);
      if (num(ex.earned)) en.earned = num(ex.earned);
      if (num(ex.spent)) en.spent = num(ex.spent);
      en.gambleWon = num(ex.gambling?.won) || 0;
      en.gambleLost = num(ex.gambling?.lost) || 0;
      en.tags = Array.isArray(r.tags) ? r.tags : [];
      en.ai = { ok: true, summary: r.summary, insight: r.insight };
      // dynamic quest minting (dedupe by title, only allowed metrics)
      const nq = r.newQuest;
      if (nq && nq.title && CONFIG.questMetrics.includes(nq.metric) && !dynQuests.some((q) => q.title.toLowerCase() === nq.title.toLowerCase())) {
        const next = [{ ...nq, id: "ai_" + Date.now(), createdAt: en.date }, ...dynQuests];
        setDynQuests(next); storeSet(KEY_Q, next);
      }
    } catch (err) {
      en.ai = { ok: false, summary: "Saved without AI — " + (err && err.message ? err.message : "offline"), insight: "" };
    }
    const next = [en, ...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
    setEntries(next); storeSet(KEY_E, next);
    setLastAI(en.ai); setTab("hero");
    return en.ai;
  };

  const d = useMemo(() => {
    if (!profile) return null;
    const hab = recentAverages(entries);
    const earned = entries.reduce((s, e) => s + (Number(e.earned) || 0), 0);
    const spent = entries.reduce((s, e) => s + (Number(e.spent) || 0), 0);
    const gWon = entries.reduce((s, e) => s + (Number(e.gambleWon) || 0), 0);
    const gLost = entries.reduce((s, e) => s + (Number(e.gambleLost) || 0), 0);
    const startGold = Number(profile.netWorth) || 0;
    const gold = startGold + earned - spent + gWon - gLost;
    const savingsRate = earned > 0 ? (earned - spent) / earned : 0;
    const deeds = entries.length, streak = computeStreak(entries);
    const forecast = computeForecast(profile, hab), potential = computePotential(profile);
    const attrs = computeAttributes(profile, hab, gold, savingsRate, deeds, streak);
    const rank = rankFor(deeds);
    const quests = computeQuests({ entries, gold, startGold, streak, hab, deeds }, dynQuests);
    return { hab, gold, startGold, savingsRate, deeds, streak, forecast, potential, attrs, rank, quests, gambleNet: gWon - gLost };
  }, [profile, entries, dynQuests]);

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={S.frame}>
        <div style={S.scroll}>
          {loading ? <div style={S.loading}>Unrolling the ledger…</div>
            : !profile || editing ? <Onboard initial={profile} onSave={saveProfile} onCancel={profile ? () => setEditing(false) : null} />
            : tab === "hero" ? <Hero profile={profile} d={d} lastAI={lastAI} clearAI={() => setLastAI(null)} onEdit={() => setEditing(true)} onReset={resetAll} />
            : tab === "log" ? <LogEntry onAdd={addEntry} />
            : tab === "chronicle" ? <Chronicle entries={entries} d={d} onDelete={deleteEntry} />
            : <Oracle profile={profile} entries={entries} d={d} cached={oracle} onResult={saveOracle} />}
        </div>
        {!loading && profile && !editing && <Nav tab={tab} setTab={setTab} />}
      </div>
    </div>
  );
}

/* ------------------------------- Nav ------------------------------- */
function Nav({ tab, setTab }) {
  const items = [{ id: "hero", label: "Hero", icon: "♦" }, { id: "log", label: "Log", icon: "✚" }, { id: "chronicle", label: "Chronicle", icon: "❧" }, { id: "oracle", label: "Oracle", icon: "✶" }];
  return (
    <nav style={S.nav}>
      {items.map((it) => (
        <button key={it.id} className="navbtn" onClick={() => setTab(it.id)} style={{ ...S.navBtn, color: tab === it.id ? C.goldHi : C.dim }}>
          <span style={{ ...S.navIcon, opacity: tab === it.id ? 1 : 0.7 }}>{it.icon}</span>
          <span style={S.navLabel}>{it.label}</span>
          {tab === it.id && <span style={S.navDot} />}
        </button>
      ))}
    </nav>
  );
}

/* ------------------------------- Hero ------------------------------ */
function Hero({ profile, d, lastAI, clearAI, onEdit, onReset }) {
  const { forecast, potential, attrs, gold, rank, deeds, streak, savingsRate, quests } = d;
  const [menu, setMenu] = useState(false);
  const lifeProgress = clamp(profile.age / forecast.estLifespan, 0, 1);
  const years = useCount(forecast.remainingYears), goldC = useCount(gold);
  const rankPct = rank.next ? clamp(((deeds - rank.current.at) / (rank.next.at - rank.current.at)) * 100, 0, 100) : 100;
  const activeQuests = quests.filter((q) => q.p < 1).slice(0, 4);
  const done = quests.filter((q) => q.p >= 1).length;

  return (
    <div style={S.pad}>
      {lastAI && (
        <div style={S.toast} onClick={clearAI}>
          <span style={{ color: lastAI.ok ? C.sage : C.ember }}>{lastAI.ok ? "✶ Scribe read your entry" : "⚠ Saved (AI offline)"}</span>
          {lastAI.summary ? <span style={S.toastSub}>{lastAI.summary}</span> : null}
        </div>
      )}
      <header style={S.topbar}>
        <div style={S.crestWrap}>
          <Crest initial={(profile.name || "A")[0].toUpperCase()} />
          <div>
            <div style={S.kicker}>Life Ledger of</div>
            <h1 style={S.name}>{profile.name || "Adventurer"}</h1>
            <div style={S.subline}>Lv {profile.age} · {rank.current.name} · {profile.city || profile.country || "the realm"}</div>
          </div>
        </div>
        <button className="gear" style={S.gear} onClick={() => setMenu((m) => !m)}>⚙</button>
      </header>
      {menu && (
        <div style={S.menu}>
          <button className="menuItem" style={S.menuItem} onClick={() => { setMenu(false); onEdit(); }}>Edit hero</button>
          <button className="menuItem" style={{ ...S.menuItem, color: C.ember }} onClick={() => { setMenu(false); onReset(); }}>Start new game</button>
        </div>
      )}

      <section style={S.gaugeCard}>
        <div style={S.gaugeHead}><span style={S.eyebrowGold}>Lifespan Forecast</span><span style={S.tinyNote}>playful estimate · not medical advice</span></div>
        <div style={S.gaugeRow}>
          <Gauge progress={lifeProgress} center={years.toFixed(1)} sub="years left" />
          <div style={S.gaugeSide}>
            <div style={S.coinBig}><span style={S.coinGlyph}>◉</span><div><div style={S.goldNum}>{fmtMoney(goldC)}</div><div style={S.goldLabel}>gold</div></div></div>
            <Stat k="Forecast age" v={forecast.estLifespan} />
            <Stat k="Days remaining" v={forecast.remainingDays.toLocaleString()} />
            <Stat k="Potential left" v={`${potential} yrs`} accent />
          </div>
        </div>
        {forecast.mods.length > 0 ? (
          <div style={S.mods}>{forecast.mods.map((m) => <span key={m.label} className="chip" style={{ ...S.chip, color: m.value >= 0 ? C.sage : C.ember, borderColor: m.value >= 0 ? C.sage : C.ember }}>{m.label} {m.value >= 0 ? "+" : ""}{m.value}</span>)}</div>
        ) : <div style={S.dim}>Log a deed to start moving your forecast.</div>}
      </section>

      <Section title="Attributes">
        <div style={S.attrGrid}>{Object.entries(attrs).map(([k, v], i) => <AttrBar key={k} name={k} val={v} delay={i * 80} />)}</div>
      </Section>

      <div style={S.miniRow}>
        <Mini label="Renown" big={rank.current.name} pct={rankPct} sub={rank.next ? `${rank.next.at - deeds} to ${rank.next.name}` : "max rank"} />
        <Mini label="Streak" big={`${streak} 🔥`} sub={`${deeds} deeds`} />
        <Mini label="Saved" big={`${Math.round(savingsRate * 100)}%`} sub="of earnings" />
      </div>

      <Section title={`Quests · ${done} done`}>
        {activeQuests.length === 0 ? <div style={S.dim}>All current quests complete. Legendary.</div> :
          activeQuests.map((q) => (
            <div key={q.id} style={S.quest}>
              <div style={S.questTop}>
                <span style={S.questTitle}>{q.title}{q.ai ? <span style={S.aiTag}>AI</span> : null}</span>
                <span style={S.questPct}>{Math.round(q.p * 100)}%</span>
              </div>
              <div style={S.questDesc}>{q.desc}</div>
              <div style={S.barBg}><div style={{ ...S.barFill, width: q.p * 100 + "%", background: C.goldHi }} /></div>
            </div>
          ))}
      </Section>
    </div>
  );
}

/* ------------------------------ Chronicle -------------------------- */
function Chronicle({ entries, d, onDelete }) {
  const chrono = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  let run = d.startGold; const goldSeries = chrono.map((e) => (run += (Number(e.earned) || 0) - (Number(e.spent) || 0) + (Number(e.gambleWon) || 0) - (Number(e.gambleLost) || 0)));
  let g = 0; const gambleSeries = chrono.map((e) => (g += (Number(e.gambleWon) || 0) - (Number(e.gambleLost) || 0)));
  const moodSeries = chrono.map((e) => Number(e.mood) || 3);
  const hasGamble = entries.some((e) => (Number(e.gambleWon) || 0) || (Number(e.gambleLost) || 0));
  return (
    <div style={S.pad}>
      <div style={S.kicker}>The Chronicle</div>
      <h1 style={S.name}>Trends &amp; deeds</h1>
      {entries.length < 2 ? <p style={S.dim}>Log a couple of deeds and your trends will appear here.</p> : (
        <div style={S.trendGrid}>
          <Trend title="Gold" series={goldSeries} color={C.goldHi} fmt={fmtMoney} />
          {hasGamble && <Trend title="Gambling (net)" series={gambleSeries} color={C.ember} fmt={fmtMoney} />}
          <Trend title="Mood" series={moodSeries} color={C.sage} fmt={(v) => v.toFixed(1)} />
        </div>
      )}
      <Section title="Deeds">
        {entries.length === 0 ? <div style={S.dim}>Nothing recorded yet.</div> :
          entries.map((e) => {
            const saved = (Number(e.earned) || 0) - (Number(e.spent) || 0);
            return (
              <div key={e.id} style={S.chronRow}>
                <div style={{ flex: 1 }}>
                  <div style={S.chronDate}>{e.date} · {e.period}</div>
                  {e.ai?.summary ? <div style={S.chronAI}>✶ {e.ai.summary}</div> : null}
                  <div style={S.chronStats}>🏋 {e.workouts} · 🍺 {e.drinks} · 😴 {e.sleep}h · 🍎 {e.diet}/5{(Number(e.gambleLost) || 0) ? ` · 🎲 -${e.gambleLost}` : ""} · {fmtMoney(saved)}</div>
                  {e.tags?.length ? <div style={S.tagRow}>{e.tags.map((t) => <span key={t} style={S.tag}>{t}</span>)}</div> : null}
                  {e.notes ? <div style={S.chronNote}>{e.notes}</div> : null}
                </div>
                <button className="del" style={S.del} onClick={() => onDelete(e.id)}>✕</button>
              </div>
            );
          })}
      </Section>
    </div>
  );
}

/* ------------------------------- Oracle ---------------------------- */
function Oracle({ profile, entries, d, cached, onResult }) {
  const [loading, setLoading] = useState(false), [err, setErr] = useState(null);
  const result = cached;
  const consult = async () => {
    setLoading(true); setErr(null);
    try { const r = await askOracle(profile, entries, d); onResult({ ...r, at: new Date().toISOString() }); }
    catch { setErr("The Oracle is silent — the connection failed. (This is where your own AI API plugs in.)"); }
    finally { setLoading(false); }
  };
  return (
    <div style={S.pad}>
      <div style={S.kicker}>Counsel</div>
      <h1 style={S.name}>The Oracle</h1>
      <p style={S.dim}>Every entry is already read by the Scribe. The Oracle gives a bigger-picture reading on demand. {entries.length < 1 ? "Log at least one deed first." : ""}</p>
      <button className="btn-primary" style={{ ...S.btnPrimary, width: "100%", marginTop: 10, opacity: loading || entries.length < 1 ? 0.6 : 1 }} disabled={loading || entries.length < 1} onClick={consult}>
        {loading ? "Gazing into the ledger…" : result ? "Consult again" : "Consult the Oracle"}
      </button>
      {err && <div style={S.oracleErr}>{err}</div>}
      {result && !loading && (
        <div style={S.scrollCard}>
          <div style={S.sealRow}><span style={S.seal}>✶</span><span style={S.sealLine} /></div>
          <p style={S.reading}>{result.reading}</p>
          {Array.isArray(result.observations) && result.observations.length > 0 && (<><div style={S.oracleH}>What the ledger shows</div>{result.observations.map((o, i) => <div key={i} style={S.obs}><span style={S.bullet}>◆</span><span>{o}</span></div>)}</>)}
          {Array.isArray(result.quests) && result.quests.length > 0 && (<><div style={S.oracleH}>Quests offered</div>{result.quests.map((q, i) => <div key={i} style={S.oQuest}><div style={S.oQuestTitle}>{q.title}</div><div style={S.oQuestWhy}>{q.why}</div></div>)}</>)}
          {result.forecastNote && <div style={S.forecastNote}>⟡ {result.forecastNote}</div>}
          {result.at && <div style={S.oracleStamp}>read {new Date(result.at).toLocaleString()}</div>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Onboard ---------------------------- */
function Onboard({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial || { name: "", age: 30, sex: "male", country: "Canada", city: "Halifax", birthplace: "", netWorth: 0, smoker: false });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.name.trim() && Number(f.age) > 0;
  return (
    <div style={S.pad}>
      <div style={S.kicker}>{initial ? "Edit hero" : "New game"}</div>
      <h1 style={S.name}>{initial ? "Your hero" : "Forge your hero"}</h1>
      <p style={S.dim}>These set your starting stats and forecast. Change anything later.</p>
      <Field label="Name / handle"><input className="inp" style={S.input} value={f.name} placeholder="What shall the bards call you?" onChange={(e) => set("name", e.target.value)} /></Field>
      <div style={S.two}>
        <Field label="Age"><input className="inp" style={S.input} type="number" value={f.age} onChange={(e) => set("age", e.target.value)} /></Field>
        <Field label="Sex (forecast)"><select className="inp" style={S.input} value={f.sex} onChange={(e) => set("sex", e.target.value)}><option value="male">Male</option><option value="female">Female</option><option value="other">Prefer not to say</option></select></Field>
      </div>
      <div style={S.two}>
        <Field label="Country"><input className="inp" style={S.input} value={f.country} onChange={(e) => set("country", e.target.value)} /></Field>
        <Field label="City"><input className="inp" style={S.input} value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
      </div>
      <Field label="Birthplace (optional)"><input className="inp" style={S.input} value={f.birthplace} onChange={(e) => set("birthplace", e.target.value)} /></Field>
      <Field label="Starting gold — savings / net worth ($)"><input className="inp" style={S.input} type="number" value={f.netWorth} onChange={(e) => set("netWorth", e.target.value)} /></Field>
      <label style={S.check}><input type="checkbox" checked={f.smoker} onChange={(e) => set("smoker", e.target.checked)} /><span>I smoke / use tobacco</span></label>
      <div style={S.actions}>
        <button className="btn-primary" style={{ ...S.btnPrimary, flex: 1, opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={() => onSave({ ...f, age: Number(f.age), netWorth: Number(f.netWorth) || 0 })}>{initial ? "Save" : "Begin"}</button>
        {onCancel && <button className="btn-ghost" style={S.btnGhost} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

/* ------------------------------ Log -------------------------------- */
function LogEntry({ onAdd }) {
  const today = new Date().toISOString().slice(0, 10);
  const [e, setE] = useState({ date: today, period: "week", workouts: 0, drinks: 0, sleep: 7, meals: { breakfast: "mixed", lunch: "mixed", dinner: "mixed" }, mood: 3, earned: 0, spent: 0, notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setE((s) => ({ ...s, [k]: v }));
  const setMeal = (m, v) => setE((s) => ({ ...s, meals: { ...s.meals, [m]: v } }));
  const submit = async () => { setBusy(true); await onAdd(e); setBusy(false); };
  return (
    <div style={S.pad}>
      <div style={S.kicker}>{e.period === "day" ? "Today" : "This week"}</div>
      <h1 style={S.name}>Log a deed</h1>
      <div style={S.two}>
        <Field label="Date"><input className="inp" style={S.input} type="date" value={e.date} onChange={(ev) => set("date", ev.target.value)} /></Field>
        <Field label="Covers"><select className="inp" style={S.input} value={e.period} onChange={(ev) => set("period", ev.target.value)}><option value="day">A day</option><option value="week">A week</option></select></Field>
      </div>
      <div style={S.two}>
        <Stepper label={`Workouts (${e.period})`} value={e.workouts} onChange={(v) => set("workouts", v)} max={21} />
        <Stepper label={`Drinks (${e.period})`} value={e.drinks} onChange={(v) => set("drinks", v)} max={60} />
      </div>
      <Slider label="Avg sleep / night" value={e.sleep} min={3} max={12} step={0.5} suffix="h" onChange={(v) => set("sleep", v)} />

      <div style={S.fieldLabel}>Meals</div>
      <div style={S.meals}>
        {["breakfast", "lunch", "dinner"].map((m) => (
          <div key={m} style={S.mealRow}>
            <span style={S.mealName}>{m[0].toUpperCase() + m.slice(1)}</span>
            <div style={S.segwrap}>
              {MEAL_OPTS.map(([val, lbl]) => (
                <button key={val} className="seg" onClick={() => setMeal(m, val)} style={{ ...S.seg, ...(e.meals[m] === val ? S.segOn : {}) }}>{lbl}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Slider label="Mood / spirit" value={e.mood} min={1} max={5} step={1} onChange={(v) => set("mood", v)} />
      <div style={S.two}>
        <Field label="Earned ($)"><input className="inp" style={S.input} type="number" value={e.earned} onChange={(ev) => set("earned", ev.target.value)} /></Field>
        <Field label="Spent ($)"><input className="inp" style={S.input} type="number" value={e.spent} onChange={(ev) => set("spent", ev.target.value)} /></Field>
      </div>
      <Field label="Anything else? (the AI reads this)">
        <textarea className="inp" style={{ ...S.input, minHeight: 76, resize: "vertical" }} value={e.notes} placeholder="e.g. gambled and lost $500 · ate clean all week · pulled two all-nighters" onChange={(ev) => set("notes", ev.target.value)} />
      </Field>
      <button className="btn-primary" style={{ ...S.btnPrimary, width: "100%", marginTop: 6, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={submit}>
        {busy ? "Scribe is reading…" : "Record it"}
      </button>
    </div>
  );
}

/* --------------------------- small parts --------------------------- */
function Section({ title, children }) { return (<section style={S.section}><h2 style={S.h2}>{title}</h2>{children}</section>); }
function Field({ label, children }) { return (<label style={S.field}><span style={S.fieldLabel}>{label}</span>{children}</label>); }
function Stat({ k, v, accent }) { return (<div style={S.sStat}><span style={S.sStatK}>{k}</span><span style={{ ...S.sStatV, color: accent ? C.sage : C.parch }}>{v}</span></div>); }
function Mini({ label, big, sub, pct }) { return (<div style={S.mini}><div style={S.miniLabel}>{label}</div><div style={S.miniBig}>{big}</div>{pct != null && <div style={S.barBg}><div style={{ ...S.barFill, width: pct + "%", background: C.goldHi }} /></div>}<div style={S.miniSub}>{sub}</div></div>); }
function AttrBar({ name, val, delay }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(val), 60 + delay); return () => clearTimeout(t); }, [val, delay]);
  return (<div style={S.attrRow}><span style={S.attrName}>{name}</span><div style={S.barBg}><div style={{ ...S.barFill, width: w + "%" }} /></div><span style={S.attrVal}>{val}</span></div>);
}
function Stepper({ label, value, onChange, max = 99 }) {
  return (<div style={S.field}><span style={S.fieldLabel}>{label}</span><div style={S.stepper}><button className="step" style={S.stepBtn} onClick={() => onChange(clamp(Number(value) - 1, 0, max))}>−</button><span style={S.stepVal}>{value}</span><button className="step" style={S.stepBtn} onClick={() => onChange(clamp(Number(value) + 1, 0, max))}>+</button></div></div>);
}
function Slider({ label, value, min, max, step, suffix = "", onChange }) {
  return (<div style={S.field}><span style={S.fieldLabel}>{label}: <b style={{ color: C.goldHi }}>{value}{suffix}</b></span><input type="range" className="rng" style={S.range} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></div>);
}
function Crest({ initial }) {
  return (
    <svg width="44" height="50" viewBox="0 0 44 50" style={{ flexShrink: 0 }}>
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.goldHi} /><stop offset="1" stopColor={C.gold} /></linearGradient></defs>
      <path d="M22 1 L42 8 V26 C42 38 33 46 22 49 C11 46 2 38 2 26 V8 Z" fill="#1B1610" stroke="url(#cg)" strokeWidth="2" />
      <text x="22" y="31" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="20" fontWeight="700" fill="url(#cg)">{initial}</text>
    </svg>
  );
}
function Gauge({ progress, center, sub }) {
  const size = 168, r = 68, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r, arc = 0.75;
  const bg = arc * circ, val = progress * arc * circ;
  const common = { cx, cy, r, fill: "none", strokeLinecap: "round", transform: `rotate(135 ${cx} ${cy})` };
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={C.ember} /><stop offset="1" stopColor={C.goldHi} /></linearGradient></defs>
      <circle {...common} stroke={C.card} strokeWidth="12" strokeDasharray={`${bg} ${circ}`} />
      <circle {...common} stroke="url(#gg)" strokeWidth="12" strokeDasharray={`${val} ${circ}`} style={{ transition: "stroke-dasharray 1s ease" }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="Cinzel, serif" fontSize="40" fontWeight="700" fill={C.parch}>{center}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" letterSpacing="1.5" fill={C.dim} style={{ textTransform: "uppercase" }}>{sub}</text>
    </svg>
  );
}
function Trend({ title, series, color, fmt }) {
  const w = 100, h = 38, pad = 3;
  const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  const pts = series.map((v, i) => { const x = series.length === 1 ? w / 2 : pad + (i / (series.length - 1)) * (w - pad * 2); const y = h - pad - ((v - min) / span) * (h - pad * 2); return [x, y]; });
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${h} L ${pts[0][0].toFixed(1)} ${h} Z`;
  return (
    <div style={S.trendCard}>
      <div style={S.trendTop}><span style={S.trendTitle}>{title}</span><span style={{ ...S.trendVal, color }}>{fmt(series[series.length - 1])}</span></div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 44 }}><path d={area} fill={color} opacity="0.14" /><path d={line} fill="none" stroke={color} strokeWidth="1.6" /></svg>
    </div>
  );
}

/* ------------------------------ styles ----------------------------- */
const S = {
  root: { minHeight: "100vh", background: C.ink, display: "flex", justifyContent: "center" },
  frame: { width: "100%", maxWidth: 460, minHeight: "100vh", color: C.parch, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column", position: "relative" },
  scroll: { flex: 1, overflowY: "auto", paddingBottom: 86 },
  pad: { padding: "22px 18px 8px" },
  loading: { textAlign: "center", padding: "120px 0", color: C.dim, fontFamily: "'Cinzel', serif", letterSpacing: 1 },
  kicker: { fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: C.gold },
  name: { fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 700, margin: "2px 0 4px", color: C.parch, lineHeight: 1.05 },
  subline: { fontSize: 12.5, color: C.dim },
  dim: { fontSize: 13, color: C.dim, lineHeight: 1.5 },

  toast: { background: "rgba(134,160,99,.12)", border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px", marginBottom: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 2 },
  toastSub: { fontSize: 12, color: C.dim },

  topbar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  crestWrap: { display: "flex", gap: 12, alignItems: "center" },
  gear: { background: "none", border: "none", color: C.dim, fontSize: 20, cursor: "pointer", padding: 4 },
  menu: { position: "absolute", right: 18, marginTop: -6, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", zIndex: 5, boxShadow: "0 8px 24px rgba(0,0,0,.5)" },
  menuItem: { display: "block", width: 160, textAlign: "left", padding: "11px 14px", background: "none", border: "none", color: C.parch, fontSize: 13, cursor: "pointer" },

  gaugeCard: { background: `radial-gradient(120% 100% at 50% 0%, ${C.ink2}, ${C.ink})`, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, boxShadow: "inset 0 1px 0 rgba(234,208,138,.08)" },
  gaugeHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 },
  eyebrowGold: { fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: C.gold, fontWeight: 700 },
  tinyNote: { fontSize: 10, color: C.dim },
  gaugeRow: { display: "flex", gap: 14, alignItems: "center", marginTop: 4 },
  gaugeSide: { flex: 1, display: "flex", flexDirection: "column", gap: 8 },
  coinBig: { display: "flex", alignItems: "center", gap: 9, marginBottom: 2 },
  coinGlyph: { color: C.goldHi, fontSize: 24, filter: "drop-shadow(0 0 8px rgba(234,208,138,.45))" },
  goldNum: { fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 700, color: C.goldHi, lineHeight: 1 },
  goldLabel: { fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: C.dim },
  sStat: { display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.line}`, paddingBottom: 5 },
  sStatK: { fontSize: 11, color: C.dim }, sStatV: { fontSize: 13, fontWeight: 600, fontFamily: "'Cinzel', serif" },
  mods: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 },
  chip: { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, border: "1px solid", background: "rgba(0,0,0,.2)" },

  section: { marginTop: 22 },
  h2: { fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: C.gold, marginBottom: 10 },
  attrGrid: { display: "flex", flexDirection: "column", gap: 9 },
  attrRow: { display: "flex", alignItems: "center", gap: 10 },
  attrName: { width: 82, fontSize: 12, fontFamily: "'Cinzel', serif", color: C.parch },
  attrVal: { width: 26, textAlign: "right", fontSize: 12, color: C.goldHi, fontWeight: 700 },
  barBg: { flex: 1, height: 9, background: C.card, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.line}` },
  barFill: { height: "100%", background: `linear-gradient(90deg, ${C.gold}, ${C.goldHi})`, borderRadius: 6, transition: "width 1s cubic-bezier(.2,.7,.2,1)" },

  miniRow: { display: "flex", gap: 10, marginTop: 22 },
  mini: { flex: 1, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 },
  miniLabel: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.dim },
  miniBig: { fontFamily: "'Cinzel', serif", fontSize: 16, color: C.parch, margin: "4px 0 7px", fontWeight: 700 },
  miniSub: { fontSize: 10, color: C.dim, marginTop: 6, lineHeight: 1.3 },

  quest: { marginBottom: 12 },
  questTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  questTitle: { fontFamily: "'Cinzel', serif", fontSize: 14, color: C.parch },
  aiTag: { fontSize: 8, letterSpacing: 1, color: C.ink, background: C.goldHi, borderRadius: 4, padding: "1px 4px", marginLeft: 6, verticalAlign: "middle", fontFamily: "'Inter',sans-serif", fontWeight: 700 },
  questPct: { fontSize: 11, color: C.goldHi, fontWeight: 700 },
  questDesc: { fontSize: 11.5, color: C.dim, margin: "2px 0 6px" },

  trendGrid: { display: "flex", flexDirection: "column", gap: 10, marginTop: 14 },
  trendCard: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px 4px" },
  trendTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  trendTitle: { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: C.dim },
  trendVal: { fontFamily: "'Cinzel', serif", fontSize: 15, fontWeight: 700 },

  chronRow: { display: "flex", gap: 10, padding: "12px 0", borderBottom: `1px solid ${C.line}` },
  chronDate: { fontFamily: "'Cinzel', serif", fontSize: 13, color: C.gold },
  chronAI: { fontSize: 12, color: C.sage, marginTop: 2, fontStyle: "italic" },
  chronStats: { fontSize: 12, color: C.parch, marginTop: 3 },
  chronNote: { fontSize: 11.5, color: C.dim, marginTop: 4, fontStyle: "italic" },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 },
  tag: { fontSize: 9.5, letterSpacing: 0.5, color: C.gold, border: `1px solid ${C.line}`, borderRadius: 12, padding: "1px 7px" },
  del: { background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 13, padding: 4 },

  oracleErr: { marginTop: 14, padding: 12, borderRadius: 10, border: `1px solid ${C.ember}`, color: C.parch, fontSize: 12.5, background: "rgba(188,77,46,.1)" },
  scrollCard: { marginTop: 16, background: `linear-gradient(160deg, ${C.parch}, #DCCDA8)`, color: "#2A2114", borderRadius: 14, padding: 18, border: `1px solid ${C.gold}`, boxShadow: "0 10px 30px rgba(0,0,0,.45)" },
  sealRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  seal: { width: 30, height: 30, borderRadius: "50%", background: C.ember, color: C.goldHi, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,.3)" },
  sealLine: { flex: 1, height: 1, background: "rgba(110,88,40,.4)" },
  reading: { fontSize: 14.5, lineHeight: 1.55, color: "#3A2C12", fontStyle: "italic", margin: 0 },
  oracleH: { fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#6E5828", margin: "16px 0 8px", fontWeight: 700 },
  obs: { display: "flex", gap: 8, fontSize: 13, color: "#3A2C12", marginBottom: 7, lineHeight: 1.45 },
  bullet: { color: C.ember, fontSize: 9, marginTop: 4 },
  oQuest: { borderLeft: `2px solid ${C.ember}`, paddingLeft: 10, marginBottom: 9 },
  oQuestTitle: { fontFamily: "'Cinzel', serif", fontSize: 14, color: "#3A2C12", fontWeight: 700 },
  oQuestWhy: { fontSize: 12, color: "#6E5828" },
  forecastNote: { marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(110,88,40,.3)", fontSize: 13, color: "#5A3D1A", fontWeight: 600 },
  oracleStamp: { marginTop: 10, fontSize: 10, color: "#8A7448", textAlign: "right" },

  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, flex: 1 },
  fieldLabel: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.dim, marginBottom: 6 },
  input: { background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", color: C.parch, fontSize: 14, fontFamily: "'Inter', sans-serif", outline: "none", width: "100%", boxSizing: "border-box" },
  two: { display: "flex", gap: 12 },
  check: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.parch, cursor: "pointer", marginBottom: 4 },
  actions: { display: "flex", gap: 10, marginTop: 18 },
  stepper: { display: "flex", alignItems: "center", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", background: C.ink2 },
  stepBtn: { width: 40, height: 42, background: "transparent", border: "none", color: C.goldHi, fontSize: 20, cursor: "pointer" },
  stepVal: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: 700, color: C.parch },
  range: { width: "100%", accentColor: C.gold },

  meals: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 },
  mealRow: { display: "flex", alignItems: "center", gap: 10 },
  mealName: { width: 74, fontSize: 12.5, color: C.parch },
  segwrap: { display: "flex", flex: 1, gap: 4 },
  seg: { flex: 1, padding: "7px 0", fontSize: 11, borderRadius: 7, border: `1px solid ${C.line}`, background: C.ink2, color: C.dim, cursor: "pointer", fontFamily: "'Inter',sans-serif" },
  segOn: { background: C.gold, color: C.ink, borderColor: C.gold, fontWeight: 700 },

  btnPrimary: { background: `linear-gradient(135deg, ${C.ember}, #8E3A22)`, color: C.parch, border: `1px solid ${C.gold}`, padding: "13px 16px", borderRadius: 10, fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: 1, cursor: "pointer", fontWeight: 600 },
  btnGhost: { background: "transparent", color: C.parch, border: `1px solid ${C.line}`, padding: "13px 16px", borderRadius: 10, fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 1, cursor: "pointer" },

  nav: { position: "sticky", bottom: 0, display: "flex", background: "rgba(19,16,11,.94)", borderTop: `1px solid ${C.line}`, backdropFilter: "blur(8px)" },
  navBtn: { flex: 1, background: "none", border: "none", padding: "10px 0 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative" },
  navIcon: { fontSize: 17 },
  navLabel: { fontSize: 10, letterSpacing: 1, fontFamily: "'Cinzel', serif" },
  navDot: { position: "absolute", top: 4, width: 4, height: 4, borderRadius: "50%", background: C.goldHi },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
* { -webkit-tap-highlight-color: transparent; }
.inp:focus { border-color: ${C.gold} !important; box-shadow: 0 0 0 2px rgba(200,169,110,.25); }
.btn-primary:hover { filter: brightness(1.08); }
.btn-ghost:hover { border-color: ${C.gold}; color: ${C.goldHi}; }
.step:hover, .seg:hover { background: rgba(200,169,110,.12); }
.gear:hover, .del:hover { color: ${C.gold}; }
.menuItem:hover { background: rgba(200,169,110,.1); }
.navbtn:active { transform: scale(.94); }
::-webkit-scrollbar { width: 0; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;
