import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  GovtMasthead, Nameplate, OfficialDoc, FileFolderTab, RubberStamp,
  DeskPanel, BrassPlaque, AgedPaper, TypewriterText, KarnatakaFlag,
  DeskDrawer, InkBottle, PenHolder, FileStack, SignatureLine,
  WaxSeal, DeskCalendar, Paperweight, DeskScene,
} from "@/components/GovtOffice";

/* ============================================================
   FIVE BUDGETS: KARNATAKA — A FISCAL SIMULATOR
   ------------------------------------------------------------
   Structure of this file:
     1. Formatting helpers
     2. BUCKETS       — the 8 allocation levers the player controls,
                        each carrying real RBI/CAG reference values
                        for turns 1-3 and a model "growth multiplier".
     2b. REVENUE      — where the money comes from (the real RBI
                        Appendix I decomposition) plus the three
                        revenue dials the player can twist: excise
                        (sin tax), mining, and user charges — each
                        with engine-priced side effects.
     3. Events        — fixed historical events for turns 1-3, and a
                        weighted random deck for turns 4-5.
     4. TURNS         — per-year configuration (revenue, committed
                        share, execution ratio, actual deficit).
     5. Engine        — resolveTurn(): the fiscal model. Pure data-in /
                        data-out, no React state inside. Also steps the
                        three consequence gauges — bond-market patience,
                        urban momentum, guarantee ratchet: fast down,
                        slow up, priced only into the open years.
     6. Narrative     — the Analyst (the game's "dungeon master"):
                        opening scenes per turn, live drafting
                        commentary, and the reckoning verdict. Advice
                        is flavour wrapped around the SAME verified
                        numbers; the player may heed or ignore it, and
                        nothing in resolveTurn ever reads what he says.
     7. UI            — screens (intro, briefing, allocate, results,
                        final) driven by a small phase state machine.

   Realism contract:
     - Turns 1-3 = FY2023-24 (A), 2024-25 (RE), 2025-26 (BE). Revenue,
       committed shares, sector allocations and deficits are real RBI
       Study of Budgets / CAG figures. The government's actual budget
       is always shown so the player can compare.
     - Turns 4-5 = 2026-27, 2027-28. Revenue realization, capex
       execution and shocks are randomized — the "predictive" half.
     - Growth multipliers, HDI movement and shock probabilities are
       the game's model layer: calibrated to the project's evidence
       base, but they are assumptions, not official forecasts.
     - Revenue dials (excise, mining, user charges) multiply REAL
       revenue heads from RBI Appendix I; their yield tapering,
       health/equity side effects and the Pay Commission card's
       arrears/committed-bump parameters are the model layer. At ×1.0
       every dial is a no-op, so playing the historical turns like
       the real government still reproduces CAG actuals.
     - The three consequence gauges are the model layer too. They
       MOVE from turn 1 (so the Analyst can warn you), but their
       numeric bites — issuance premiums, softened collections,
       permanent committed floors — are priced only into turns 4-5,
       keeping the historical calibration exact.
   ============================================================ */

/* ---------- 1. Formatting helpers ---------- */

/** "₹1,23,456 cr" — Indian digit grouping, rupees in crore. */
const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN") + " cr";
/** "₹28.84 lakh cr" — for GSDP-scale numbers (1 lakh cr = 1,00,000 cr). */
const fmtShort = (n: number) => "₹" + (n / 100000).toFixed(2) + " lakh cr";
/** 0.092 -> "9.2%" */
const pct = (n: number) => (n * 100).toFixed(1) + "%";

/* ---------- 2. Allocation buckets ---------- */

/**
 * One player-controlled allocation lever.
 * - `mult`: effective GSDP growth multiplier. Approximates how much a
 *   rupee of (executed) spending in this sector adds to the next
 *   year's growth rate, as a share of GSDP. Urban/transport sit high
 *   (private-sector crowding-in); subsidies sit lowest (consumption).
 * - `kind`: "capex" buckets are hit by the random execution ratio —
 *   money budgeted ≠ money spent (see resolveTurn step 4). The
 *   "revenue" bucket (guarantees/subsidies) always fully lands.
 * - `actual`: the government's real allocations for the three
 *   historical turns (₹ cr), from RBI Study of Budgets 2025-26,
 *   Appendix IV (Karnataka capital outlay) and Statement 36 (subsidies).
 *   Note: urban values are the verified ₹-lakh→₹-crore conversions
 *   (297.5 / 877.6 / 2395.4 — an 8× rise over two years, but ~3.5% of
 *   capex, not "one in four rupees").
 * - `hdi` + `hdiRef`: which human-development index this bucket moves
 *   (null = pure growth lever), and the benchmark spend level around
 *   which index movement is calibrated (spend > ref → index rises).
 */
type Bucket = {
  key: string;
  name: string;
  emoji: string;
  desc: string;
  mult: number;          // GSDP growth multiplier
  kind: "capex" | "revenue";
  actual: number[];      // govt actuals for turns 1-3 (₹ cr)
  hdi: "health" | "education" | "water" | "equity" | null;
  hdiRef: number;        // benchmark spend for index movement
};

const BUCKETS: Bucket[] = [
  { key: "urban", name: "Urban & Bengaluru infra", emoji: "🏙️", desc: "Metro, tunnels, business corridors. Highest growth payoff — but concentrates gains in one city.", mult: 2.2, kind: "capex", actual: [297.5, 877.6, 2395.4], hdi: null, hdiRef: 900 },
  { key: "irrigation", name: "Irrigation & flood control", emoji: "🌾", desc: "Canals, tanks, dams. Slow rural payoff — and drought insurance.", mult: 0.8, kind: "capex", actual: [17435.7, 16969.2, 20601.8], hdi: null, hdiRef: 17000 },
  { key: "transport", name: "Roads & transport", emoji: "🛣️", desc: "Highways, rural roads. Fast, broad growth payoff across districts.", mult: 1.5, kind: "capex", actual: [9644.8, 8130.7, 6958.1], hdi: null, hdiRef: 8000 },
  { key: "water", name: "Water & sanitation", emoji: "🚰", desc: "Pipes, sewage, drinking water. The public-health foundation.", mult: 1.1, kind: "capex", actual: [5981.2, 8508.0, 12430.1], hdi: "water", hdiRef: 8000 },
  { key: "health", name: "Health infrastructure", emoji: "🏥", desc: "Hospitals, PHCs, equipment. HDI mover with a lag.", mult: 0.6, kind: "capex", actual: [1113.8, 1317.1, 2115.2], hdi: "health", hdiRef: 1400 },
  { key: "education", name: "Education & schools", emoji: "🏫", desc: "Classrooms, hostels, institutes. Slowest-burning HDI investment.", mult: 0.7, kind: "capex", actual: [1201.1, 1626.7, 1657.7], hdi: "education", hdiRef: 1600 },
  { key: "scst", name: "SC/ST/OBC sub-plan capex", emoji: "⚖️", desc: "Equity-targeted capital for Kalyana Karnataka and the north — closes the state's divide.", mult: 0.4, kind: "capex", actual: [2764.1, 3728.5, 5136.8], hdi: "equity", hdiRef: 3900 },
  { key: "subsidies", name: "Guarantees & subsidies (revenue)", emoji: "🤲", desc: "Gruha Lakshmi, Gruha Jyothi, Shakti, power subsidy… consumption now, not assets. Borrowing to feed this breaks the golden rule.", mult: 0.15, kind: "revenue", actual: [41881, 47400, 49333], hdi: "equity", hdiRef: 46000 },
];

/* ---------- 2b. Revenue: sources & the player's revenue dials ---------- */

/**
 * Karnataka's real revenue decomposition (₹ cr), RBI Study of Budgets
 * 2025-26, Appendix I (Revenue Receipts): A 2023-24 / RE 2024-25 /
 * BE 2025-26. Powers the briefing panel ("Where the money comes
 * from") and the benchmarks for the three revenue dials below.
 * - `otherTax` is the own-tax residual after the five major heads
 *   (profession tax, electricity duty and minor heads).
 * - `mining` is "industries" under economic services — the iron-ore
 *   economy of Ballari and the Kalyana Karnataka belt.
 * - `userCharges` is general + social services non-tax — fees,
 *   tariffs and charges. The rest of own non-tax (interest receipts,
 *   dividends, other economic services) sits in `otherNonTax`.
 */
const REVENUE_HEADS = {
  ownTax: [163505, 180368, 208100],
  ownNonTax: [13117, 14500, 16500],
  centralShare: [41193, 46933, 51877],  // share in central taxes (Finance Commission devolution)
  grants: [15528, 16000, 16000],        // grants-in-aid from the Centre (CSS, FC & other grants)
  sgst: [71041, 80116, 92132],
  excise: [34629, 36500, 40000],        // the bottle tax — 2nd-largest own-tax head
  stamps: [20147, 24000, 28000],
  vat: [19231, 23538, 26410],          // sales tax / VAT
  vehicles: [11287, 12500, 15000],
  otherTax: [7170, 3714, 6558],        // residual: profession, electricity duty, minor heads
  mining: [7324, 7251, 9000],
  userCharges: [2825, 2503, 2396],      // general + social services non-tax
  otherNonTax: [2968, 4746, 5104],      // interest receipts, dividends, other economic services
};

/**
 * Rows for the briefing decomposition panel. Historical turns show
 * the real RBI figures; future turns apply FY2025-26 BE shares of
 * revenue to the forecast (labelled as a model estimate in the UI).
 */
function revenueRows(turnIdx: number, forecast: number): { label: string; value: number; hi?: boolean }[] {
  const cfg = TURNS[turnIdx];
  if (cfg.era === "historical") {
    const h = REVENUE_HEADS;
    return [
      { label: "SGST", value: h.sgst[turnIdx] },
      { label: "🍺 State excise — the bottle tax", value: h.excise[turnIdx], hi: true },
      { label: "Stamps & registration", value: h.stamps[turnIdx] },
      { label: "Sales tax / VAT", value: h.vat[turnIdx] },
      { label: "Motor vehicle tax", value: h.vehicles[turnIdx] },
      { label: "Other own taxes", value: h.otherTax[turnIdx] },
      { label: "⛏️ Mining & industries (non-tax)", value: h.mining[turnIdx], hi: true },
      { label: "💧 User charges & fees (non-tax)", value: h.userCharges[turnIdx], hi: true },
      { label: "Other own non-tax (interest, dividends)", value: h.otherNonTax[turnIdx] },
      { label: "Share in central taxes (devolution)", value: h.centralShare[turnIdx] },
      { label: "Grants from the Centre (CSS etc.)", value: h.grants[turnIdx] },
    ];
  }
  // Future turns: FY2025-26 BE shares applied to the revenue forecast.
  const f = (s: number) => Math.round((forecast * s) / 50) * 50;
  return [
    { label: "SGST", value: f(0.3150) },
    { label: "🍺 State excise — the bottle tax", value: f(0.1368), hi: true },
    { label: "Stamps & registration", value: f(0.0957) },
    { label: "Sales tax / VAT", value: f(0.0903) },
    { label: "Motor vehicle tax", value: f(0.0513) },
    { label: "Other own taxes", value: f(0.0224) },
    { label: "⛏️ Mining & industries (non-tax)", value: f(0.0308), hi: true },
    { label: "💧 User charges & fees (non-tax)", value: f(0.0082), hi: true },
    { label: "Other own non-tax (interest, dividends)", value: f(0.0174) },
    { label: "Share in central taxes (devolution)", value: f(0.1774) },
    { label: "Grants from the Centre (CSS etc.)", value: f(0.0547) },
  ];
}

/**
 * One player-controlled revenue dial. The dial multiplies the head's
 * benchmark yield; the delta (m − 1) × benchmark flows straight into
 * the allocation pool — it does NOT pass through the committed
 * share — and each dial carries an engine-priced side effect:
 *   - sin (excise): yields taper past ×1.15 (price-elastic drinkers
 *     and the illicit trade take the margin); pushing above benchmark
 *     is logged as a health cost (NIPFP draft literature estimate:
 *     alcohol's social cost is of the order of 2% of GSDP).
 *   - mining: over-driving auctions/leases benefits the equity index
 *     (money landing in the iron-ore belt); under-driving costs it.
 *   - charges (user charges & fees): hikes are regressive and cost
 *     the equity index; cuts buy goodwill at the treasury's expense.
 * At ×1.0 every dial is a no-op — the calibration contract holds.
 */
type RevLever = {
  key: "sin" | "mining" | "charges";
  name: string;
  emoji: string;
  desc: string;
  lo: number;           // multiplier range shown on the slider
  hi: number;
  futureShare: number;  // share of the revenue forecast used as benchmark in future turns
  note: string;         // the dial's price, one line
};

const REV_LEVERS: RevLever[] = [
  {
    key: "sin", name: "State excise — the bottle tax", emoji: "🍺",
    desc: "Karnataka's second-largest own tax: ₹34,629 cr (2023-24) rising to ₹40,000 cr (BE). Twist the dial to raise rates or open more shops.",
    lo: 0.8, hi: 1.4, futureShare: 0.1368,
    note: "yields taper past ×1.15 (illicit trade) · health ledger cost",
  },
  {
    key: "mining", name: "Mining & mineral levies", emoji: "⛏️",
    desc: "Non-tax yield from Ballari's iron-ore belt: ₹7,324 cr → ₹9,000 cr (BE). Aggressive auctions — and the SC mineral-verdict window — can push it higher.",
    lo: 0.8, hi: 1.5, futureShare: 0.0308,
    note: "money lands in Kalyana Karnataka · equity ledger bonus",
  },
  {
    key: "charges", name: "User charges & fees", emoji: "💧",
    desc: "Water tariffs, bus fares, service fees — general & social services non-tax, ~₹2,400–2,800 cr. The smallest machine, with no black market.",
    lo: 0.8, hi: 1.3, futureShare: 0.0082,
    note: "regressive — equity ledger cost",
  },
];

/**
 * Benchmark (₹ cr) for each dial: the real RBI Appendix I value for
 * historical turns; a forecast-share estimate for future turns.
 */
function revBenchmarks(turnIdx: number, forecast: number): { sin: number; mining: number; charges: number } {
  const cfg = TURNS[turnIdx];
  if (cfg.era === "historical") {
    return {
      sin: REVENUE_HEADS.excise[turnIdx],
      mining: REVENUE_HEADS.mining[turnIdx],
      charges: REVENUE_HEADS.userCharges[turnIdx],
    };
  }
  const shares: Record<"sin" | "mining" | "charges", number> = { sin: 0, mining: 0, charges: 0 };
  REV_LEVERS.forEach((l) => (shares[l.key] = forecast * l.futureShare));
  return shares;
}

/**
 * Benchmarks (₹ cr) for the three consequence gauges: executed urban
 * (index 0) + transport (index 2) capex drive urban momentum; the
 * subsidies allocation (index 7) drives the guarantee ratchet.
 * Historical turns use the government's real figures — so "match
 * the government" is always gauge-neutral; future turns use the
 * hdiRef benchmarks.
 */
function gaugeBenchmarks(turnIdx: number): { urban: number; transport: number; subsidies: number } {
  const cfg = TURNS[turnIdx];
  const b = (i: number) => (cfg.era === "historical" ? BUCKETS[i].actual[turnIdx] : BUCKETS[i].hdiRef);
  return { urban: b(0), transport: b(2), subsidies: b(7) };
}

/* ---------- 3. Events ---------- */

/**
 * One year's exogenous shock (or windfall).
 * - `growth`: additive hit to that year's GSDP growth (e.g. -0.012 = -1.2pp).
 * - `revNoise`: multiplicative swing on revenue realization (<1 = miss).
 * - `extraCost`: one-off borrowing hit in ₹ cr added straight to debt.
 *   Negative values are windfalls (they add revenue instead).
 * - `equity`: one-off bump to the equity index (windfalls that reach
 *   mining-district communities).
 */
type EventCard = {
  key: string;
  title: string;
  body: string;
  growth: number;      // delta on growth
  revNoise: number;    // multiplier on revenue realization
  extraCost: number;   // one-off borrowing hit (₹ cr)
  equity?: number;     // one-off equity index bump
  committedBump?: number; // permanent addition to the committed share (e.g. Pay Commission)
};

/**
 * Turns 1-3 play the REAL headlines of each year, so the player's
 * budgets resolve against the same headwinds the government faced.
 */
const HISTORICAL_EVENTS: EventCard[] = [
  {
    key: "drought-guarantees",
    title: "Drought year — and the five guarantees launch",
    body: "2023-24: weak monsoon hits rural incomes just as Gruha Jyothi, Gruha Lakshmi, Anna Bhagya and Shakti roll out mid-year. A new ₹40,000+ crore recurring commitment is born.",
    // Modest growth hit from drought; guarantees are a player lever (bucket),
    // not baked into the event, so the player chooses their scale.
    growth: -0.008, revNoise: 1.0, extraCost: 0,
  },
  {
    key: "sgst-miss",
    title: "The over-optimistic budget: SGST misses by ₹6,359 crore",
    body: "2024-25: collections land well below the Budget Estimate — RBI later scores Karnataka a 'D' on revenue forecasting. Drought persists; 7th Pay Commission arithmetic looms. Interest payment exceeds principal repayment for the first time.",
    // Small equity credit: guarantee schemes did reach households.
    growth: -0.005, revNoise: 1.0, extraCost: 0, equity: 0.5,
  },
  {
    key: "record-borrowing",
    title: "Record borrowing — ₹92,025 crore from the market",
    body: "2025-26: gross market borrowing more than doubles in two years. The budget doubles down on Bengaluru (urban capex ×3) while road capex is cut 28%. Nationally, states spend only 26.3% of budgeted capex by half-year — execution is the new problem.",
    // Slight growth lift: the borrowing itself was capex-directed.
    growth: 0.002, revNoise: 1.0, extraCost: 0,
  },
];

/**
 * The random deck for turns 4-5, weighted by the state's actual
 * shock distribution (drought is the most common card — that's the
 * real pattern). Upside and downside cards are deliberately balanced
 * so the future is genuinely uncertain, not doom-laden.
 * Weights sum to 1.0: 22 + 14 + 12 + 10 + 15 + 15 + 12 = 100.
 * The Pay Commission card's arrears (₹10,000 cr) and committed bump
 * (+0.8pp of revenue, permanent) are model assumptions — the award's
 * actual cost to Karnataka is not yet published.
 */
const FUTURE_DECK: { e: EventCard; w: number }[] = [
  { w: 0.22, e: { key: "drought", title: "Drought year", body: "Weak monsoon. Farm distress, irrigation pump-set power bills spike, rural demand dips — and the pressure for a farm loan waiver becomes intense.", growth: -0.012, revNoise: 0.98, extraCost: 8000 } },
  { w: 0.14, e: { key: "flood", title: "A major Bengaluru flood event", body: "Unprecedented rain drowns the tech corridor. Repairs, compensation and an angry IT sector — one bad quarter for the state's biggest engine.", growth: -0.008, revNoise: 1.0, extraCost: 12000 } },
  { w: 0.12, e: { key: "itslow", title: "Global IT / export slowdown", body: "Client budgets shrink across the Atlantic. Bengaluru's services engine sputters — SGST and stamps collections soften.", growth: -0.018, revNoise: 0.96, extraCost: 0 } },
  { w: 0.10, e: { key: "devolution", title: "Devolution shock from Delhi", body: "The Finance Commission revises inter-se shares; centrally sponsored scheme money is cut. Karnataka — already a net contributor — absorbs the blow.", growth: -0.003, revNoise: 0.94, extraCost: 0 } },
  { w: 0.15, e: { key: "minerals", title: "Mineral-tax windfall lands", body: "The Supreme Court verdict on retrospective mineral levies finally pays out. Ballari's iron-ore districts send a surge of non-tax revenue.", growth: 0.002, revNoise: 1.0, extraCost: -5000, equity: 1 } },
  { w: 0.15, e: { key: "boom", title: "Global investment boom", body: "A capex super-cycle: GCCs and fabs pick Karnataka. Stamps and registration collections — the state's most buoyant tax — surge.", growth: 0.015, revNoise: 1.05, extraCost: 0 } },
  { w: 0.12, e: { key: "paycomm", title: "The Pay Commission lands", body: "The 8th Pay Commission's award reaches state payrolls: salaries and pensions reset to a higher base — arrears now, a permanently heavier ratchet forever. The one bill no assembly ever votes down.", growth: 0.003, revNoise: 1.02, extraCost: 10000, committedBump: 0.008 } },
];

/* ---------- 4. Per-turn configuration ---------- */

/**
 * One fiscal year of play.
 * - `committedRate`: the share of revenue already locked into salaries,
 *   pensions, interest (₹41,000+ cr/yr, 14.2% of revenue receipts per
 *   ISEC), loan obligations and other non-negotiable revenue spending.
 *   Derived so that "Match the real government" works exactly: for the
 *   historical turns, revenue − committed + actual deficit = the sum of
 *   the government's real bucket allocations (~89-91% of revenue).
 *   It CREEPS UP each year (0.888 → 0.928): pension indexation, the
 *   guarantee ratchet and the demographic clock — the game's villain.
 * - `execRatio`: share of budgeted capex actually spent. Historical
 *   turns use plausible fixed ratios (2025-26 set low, reflecting the
 *   nationally reported 26.3% half-year utilisation); future turns
 *   sample randomly in resolveTurn.
 * - `actualFD`: the government's real fiscal deficit for the year —
 *   used by "Match the real government" and the baseline chart.
 */
type TurnCfg = {
  fy: string;
  era: "historical" | "future";
  tagline: string;
  revenue: number;        // forecast for the year (₹ cr)
  committedRate: number;  // locked share of revenue
  execRatio: number;      // capex execution ratio (fixed for historical, sampled for future)
  event: EventCard;       // historical turns: fixed; future: drawn at resolution
  actualFD: number;       // actual fiscal deficit (historical)
  actualNotes: string[];  // "what actually happened"
};

const TURNS: TurnCfg[] = [
  {
    fy: "2023-24", era: "historical", tagline: "The Guarantee Year",
    revenue: 233343, committedRate: 0.888, execRatio: 0.88,
    event: HISTORICAL_EVENTS[0], actualFD: 68000,
    actualNotes: [
      "Revenue receipts ₹2.33 lakh crore — 76% self-earned, only ~24% from Delhi.",
      "Revenue deficit: ₹9,272 crore. The five guarantees launched mid-year.",
      "Roads & transport (₹9,645 cr) outspent urban development (₹297 cr) 32-to-1.",
    ],
  },
  {
    fy: "2024-25", era: "historical", tagline: "The Over-Optimistic Budget",
    revenue: 257801, committedRate: 0.907, execRatio: 0.75,
    event: HISTORICAL_EVENTS[1], actualFD: 78000,
    actualNotes: [
      "SGST: budgeted ₹86,475 cr, collected ₹80,116 cr (RE) — a ₹6,359 cr miss.",
      "Revenue deficit ballooned to ₹26,127 crore (RE).",
      "Urban development capex nearly tripled to ₹878 cr; roads flat.",
      "Interest payment exceeded principal repayment on state debt.",
    ],
  },
  {
    fy: "2025-26", era: "historical", tagline: "The Bengaluru Bet",
    revenue: 292477, committedRate: 0.907, execRatio: 0.70,
    event: HISTORICAL_EVENTS[2], actualFD: 90428,
    actualNotes: [
      "Capital outlay budgeted ₹68,172 cr (+25% over RE) — but nationally states spent only 26.3% of budgeted capex by half-year.",
      "Urban development ×2.7 in one year to ₹2,395 cr; roads cut −28% to ₹6,958 cr.",
      "Fiscal deficit ₹90,428 cr = 2.95% of GSDP. Gross market borrowing ₹92,025 cr — more than double two years earlier.",
      "Sinking fund raised 50% to ₹3,000 cr — a quiet prudence signal.",
    ],
  },
  // Future turns: revenue and event are computed at play time (see
  // resolveTurn); the config only fixes the FY label and the next
  // notch of the committed-expenditure ratchet.
  { fy: "2026-27", era: "future", tagline: "The Unwritten Year", revenue: 0, committedRate: 0.918, execRatio: 0, event: HISTORICAL_EVENTS[0], actualFD: 0, actualNotes: [] },
  { fy: "2027-28", era: "future", tagline: "The Divergence", revenue: 0, committedRate: 0.928, execRatio: 0, event: HISTORICAL_EVENTS[0], actualFD: 0, actualNotes: [] },
];

/* ---------- 5. Engine constants & state ---------- */

/**
 * Model calibration. All chosen so that playing the historical turns
 * like the actual government reproduces the real macro path:
 * 2024-25 GSDP lands on CAG's ₹28.84 lakh cr, liabilities on ₹6.92
 * lakh cr, and the growth numbers track the ~9-10% nominal trend.
 */
const BASE_GROWTH = [0.083, 0.095, 0.085, 0.085, 0.083]; // underlying trend growth per turn (demography slowly drags it down)
const REV_GSDP_RATIO = 0.092;  // revenue receipts ≈ 9.2% of GSDP (avg of the three historical years) — this is how future revenue forecasts are generated from the player's GSDP path, closing the growth→revenue compounding loop
const DEBT_CAP = 0.252;    // 16th FC: total liabilities ≤ 25.2% of GSDP
const GFD_CAP = 0.03;      // KFRA: fiscal deficit ≤ 3% of GSDP

/**
 * The persistent state carried across turns ("the world").
 * - `gsdp`: GSDP of the fiscal year being played.
 * - `pendingBoost`: growth contribution already earned from LAST
 *   turn's executed capex — capex takes a year to bite (the lag that
 *   makes deferring investment quietly costly).
 * - `indices`: the four human-development sub-indices (0-100). Not
 *   official HDI — an engine proxy calibrated to Karnataka's profile
 *   (strong southern districts, lagging Kalyana Karnataka).
 * - `gauges`: the three consequence gauges (0-100): bond-market
 *   patience (starts 70), urban momentum (60), guarantee ratchet
 *   (25 — the five guarantees are already running). Model layer:
 *   they move from turn 1 but only bite numerically in turns 4-5.
 */
type World = {
  gsdp: number;        // current FY GSDP (₹ cr)
  debt: number;        // total liabilities (₹ cr)
  rate: number;        // interest on fresh borrowing (%)
  rating: string;
  indices: { health: number; education: number; water: number; equity: number };
  pendingBoost: number;
  committedAdj: number;  // permanent additions to the committed share (e.g. Pay Commission award)
  gauges: { patience: number; momentum: number; ratchet: number };  // consequence gauges (0-100)
};

/**
 * Opening position (end-March 2023):
 * - GSDP 2023-24 calibrated at ₹26.2 lakh cr so that one year of trend
 *   growth lands 2024-25 on CAG's audited ₹28.84 lakh cr.
 * - Debt ₹5.46 lakh cr calibrated so that adding the actual deficits
 *   of 2023-24 and 2024-25 reproduces CAG's ₹6.92 lakh cr liabilities.
 * - pendingBoost 0.9pp: the growth tailwind from pre-game (2022-23)
 *   capex, so turn 2 doesn't start from zero.
 */
function initialWorld(): World {
  return {
    gsdp: 2620000,      // FY2023-24 GSDP (calibrated)
    debt: 546000,       // end-March 2023 liabilities (calibrated)
    rate: 7.2,          // historical avg cost of state borrowing
    rating: "AA+",
    indices: { health: 62, education: 58, water: 60, equity: 54 },
    pendingBoost: 0.009,
    committedAdj: 0,      // no permanent committed additions yet — the Pay Commission can change this
    gauges: { patience: 70, momentum: 60, ratchet: 25 }, // patience high, corridor healthy, guarantees already running
  };
}

/**
 * Rating ladder: crossing the 25.2% debt cap costs a notch; 28% and
 * 32% cost more. Ratings are cosmetic+rate carriers, not a win state.
 */
function ratingFor(ratio: number, rating: string): string {
  if (ratio > 0.32) return "BBB";
  if (ratio > 0.28) return "A";
  if (ratio > DEBT_CAP) return "AA";
  return rating === "AA+" || ratio <= DEBT_CAP ? "AA+" : rating;
}

/**
 * Draw a future-year event from the weighted deck. We expand the deck
 * into 100 slots (weight × 100) and index with the random number —
 * simple, transparent, and exactly reproduces the stated weights.
 */
function drawEvent(rng: number): EventCard {
  const deck = FUTURE_DECK.flatMap(({ e, w }) => Array(Math.round(w * 100)).fill(e) as EventCard[]);
  return deck[Math.floor(rng * deck.length)];
}

/* ---------- The resolution engine ---------- */

/**
 * Resolve one budget year: take the player's allocations + borrowing,
 * apply the event, noise and execution dice, and return the next
 * World plus a full TurnResult for the results screen. This function
 * is deliberately pure (state is threaded in and out) so a whole
 * game is reproducible from its inputs.
 *
 * rngs: three independent random numbers (execution, event draw,
 * revenue noise), injected by the caller — keeps the model testable.
 */
function resolveTurn(
  turnIdx: number,
  allocs: number[],
  borrowing: number,
  revMods: { sin: number; mining: number; charges: number },
  world: World,
  rngs: { exec: number; event: number; noise: number },
): { world: World; res: TurnResult } {
  const cfg = TURNS[turnIdx];
  const isFuture = cfg.era === "future";

  // -- Step 1: this year's shock. Historical turns replay the real
  // event; future turns draw from the weighted deck.
  const event = isFuture ? drawEvent(rngs.event) : cfg.event;

  // -- Step 2: revenue realization.
  // Historical turns use the real figure (A/RE/BE from RBI). Future
  // turns forecast revenue from the player's own GSDP path (so
  // growth choices compound into revenue), then randomize the
  // realization — the RBI-marksmanship mechanic: budget ≠ collection.
  // Noise range 0.94–1.03, then the event's own multiplier stacks.
  const forecast = isFuture ? world.gsdp * REV_GSDP_RATIO : cfg.revenue;
  const noise = isFuture ? 0.94 + 0.09 * rngs.noise : 1;
  // Urban-momentum bite (future turns only): a starved Bengaluru
  // machine softens the state's most buoyant collections — up to −3%
  // once momentum hits zero. Historical turns are untouched.
  const momentumTilt = isFuture ? 1 - (Math.max(0, 40 - world.gauges.momentum) / 40) * 0.03 : 1;
  const revenueRealized = forecast * noise * event.revNoise * momentumTilt;

  // -- Step 2.5: the revenue dials. Each dial multiplies its head's
  // benchmark yield (real RBI figures on historical turns); the delta
  // flows straight into the pool — NOT through the committed share —
  // and is scaled by the same realization noise as the rest of
  // revenue. Excise yields taper past ×1.15: price-elastic drinkers
  // and the illicit trade take the margin.
  const bench = revBenchmarks(turnIdx, forecast);
  const sinEff = revMods.sin <= 1.15 ? revMods.sin : 1.15 + (revMods.sin - 1.15) * 0.5;
  const leverExtra =
    ((sinEff - 1) * bench.sin + (revMods.mining - 1) * bench.mining + (revMods.charges - 1) * bench.charges) *
    noise * event.revNoise;

  // -- Step 3: the fiscal straightjacket. Committed spending scales
  // with realized revenue (a revenue miss squeezes you, not the
  // pensioners — that's how it works in reality too), and includes
  // any permanent ratchet additions the world has accumulated (the
  // Pay Commission award). What's left, plus your borrowing and dial
  // money, is the pool you actually allocated from — note it may now
  // differ from what you budgeted. That gap IS the game.
  const committedRate = Math.min(0.97, cfg.committedRate + world.committedAdj);
  const committed = revenueRealized * committedRate;
  const discretionary = revenueRealized - committed;
  const pool = discretionary + borrowing + leverExtra;

  // -- Step 4: execution. Budgeted capex spends at an execution ratio
  // (fixed for historical turns; 0.62–0.92 sampled for future ones).
  // Revenue-type allocations (subsidies) always land in full — you
  // can't half-pay a guarantee.
  const execRatio = isFuture ? 0.62 + 0.3 * rngs.exec : cfg.execRatio;
  const executed = allocs.map((a, i) => (BUCKETS[i].kind === "capex" ? a * execRatio : a));
  const capexExecuted = allocs.reduce((s, a, i) => s + (BUCKETS[i].kind === "capex" ? a * execRatio : 0), 0);

  // -- Step 5: growth. Trend + last year's capex tailwind (pendingBoost)
  // + this year's event + a quarter of this year's own capex kick
  // (the rest arrives next year via pendingBoost — the lag).
  // Borrowing above the 3% KFRA cap drags growth (credibility + rate
  // effects); a floor of 3% keeps extreme draws non-absurd.
  const capexBoost = allocs.reduce((s, a, i) => s + BUCKETS[i].mult * (BUCKETS[i].kind === "capex" ? a * execRatio : a), 0) / world.gsdp;
  let growth = BASE_GROWTH[turnIdx] + world.pendingBoost + event.growth + capexBoost * 0.25;
  const fdPct = (borrowing + event.extraCost) / world.gsdp;
  if (fdPct > GFD_CAP) growth -= 0.001 * ((fdPct - GFD_CAP) / 0.005);
  if (isFuture && world.gauges.momentum < 25) growth -= 0.003; // the state's biggest engine sputters
  growth = Math.max(0.03, growth);

  // -- Step 6: human development. Each HDI-linked bucket moves its
  // index by its % deviation from the benchmark spend (diminishing
  // returns: clamped to ±2.5 index points per year). Subsidies get a
  // softer coefficient — consumption transfers help, but a rupee of
  // SC/ST capital moves the equity needle further. Windfall events
  // (e.g. mineral revenue reaching mining districts) add a one-off
  // equity bump.
  const idx = { ...world.indices };
  const indexDeltas: Record<string, number> = {};
  for (let i = 0; i < BUCKETS.length; i++) {
    const b = BUCKETS[i];
    if (!b.hdi) continue;
    const move = (executed[i] - b.hdiRef) / b.hdiRef;
    const delta = Math.max(-2.5, Math.min(2.5, (b.key === "subsidies" ? 0.8 : 1.5) * move));
    idx[b.hdi] = Math.max(0, Math.min(100, idx[b.hdi] + delta));
    indexDeltas[b.key] = delta;
  }
  if (event.equity) idx.equity = Math.min(100, idx.equity + event.equity);

  // Step 6b: the revenue dials' side effects. Excise above benchmark
  // is a health cost (alcohol's social cost — NIPFP draft literature
  // estimate: of the order of 2% of GSDP); mining above benchmark
  // lands money in the iron-ore belt (equity); user-charge hikes are
  // regressive (equity). All are zero at ×1.0 — the calibration
  // contract holds.
  const revDeltas: { health: number; equity: number } = {
    health: sinEff > 1 ? -(sinEff - 1) * 1.2 : (1 - sinEff) * 0.8,
    equity:
      (revMods.mining > 1 ? (revMods.mining - 1) * 0.8 : -(1 - revMods.mining) * 0.8) +
      (revMods.charges > 1 ? -(revMods.charges - 1) * 1.0 : (1 - revMods.charges) * 0.6),
  };
  if (revDeltas.health) idx.health = Math.max(0, Math.min(100, idx.health + revDeltas.health));
  if (revDeltas.equity) idx.equity = Math.max(0, Math.min(100, idx.equity + revDeltas.equity));

  // -- Step 7: debt. New debt = old debt + borrowing + one-off shock
  // costs. (Borrowing ≈ fiscal deficit by the RBI reconciliation we
  // verified: net borrowing ₹89,525 cr ≈ FD ₹90,428 cr in 2025-26.)
  // Ratio is measured against the current FY's GSDP — the standard
  // end-March liabilities / that year's GSDP convention.
  // Market-patience bite (future turns only): a thin order book
  // prices in an issuance premium — the slippage goes straight onto
  // the debt. Below 25 patience the auction partially fails (the UI
  // caps borrowing at 2.5% of GSDP) and the premium triples.
  const patience = world.gauges.patience;
  const issuancePremium = isFuture ? borrowing * (patience < 25 ? 0.015 : patience < 45 ? 0.005 : 0) : 0;
  const debtNew = world.debt + borrowing + issuancePremium + Math.max(0, event.extraCost);
  const ratio = debtNew / world.gsdp;

  // -- Step 8: golden rule & the price of laxity. Borrowing only for
  // executed capex keeps the rule. Crossing the debt cap for the
  // first time, or busting the FD cap, permanently raises your
  // borrowing rate — markets remember, and so does the engine.
  const goldenRule = borrowing <= capexExecuted;
  const prevRatio = world.debt / world.gsdp;
  const rating = ratingFor(ratio, world.rating);
  let rate = world.rate;
  if (ratio > DEBT_CAP && prevRatio <= DEBT_CAP) rate += 0.4;
  if (fdPct > GFD_CAP) rate += 0.2;
  if (isFuture && patience < 45) rate += 0.3; // thin order book reprices every auction
  rate = Math.min(9.6, rate);

  // -- Step 9: the consequence gauges (model layer). They move from
  // turn 1, but their bites are priced only into the open years —
  // see steps 2/5/7/8 above. All fall fast and heal slowly; the
  // ratchet is the exception that climbs on expansion and barely
  // unwinds. "Match the government" is always gauge-neutral because
  // the benchmarks ARE the government's figures.
  const gbench = gaugeBenchmarks(turnIdx);
  const gauges = { ...world.gauges };
  const gaugeDeltas: Record<string, number> = {};
  // Bond-market patience: the market's memory of your rule-keeping.
  let dPat = 0;
  if (!goldenRule) dPat -= 12;
  if (fdPct > GFD_CAP) dPat -= 8 * ((fdPct - GFD_CAP) / 0.01); // −8 per pp over the KFRA line
  if (ratio > DEBT_CAP) dPat -= 10;
  if (goldenRule && fdPct <= GFD_CAP) dPat += 4;               // a clean year heals
  if (ratio < prevRatio) dPat += 2;                            // so does a shrinking debt ratio
  if (dPat) { gauges.patience = Math.max(0, Math.min(100, gauges.patience + dPat)); gaugeDeltas.patience = dPat; }
  // Urban momentum: starve the corridor and it falls fast.
  let dMom = 0;
  const corridor = executed[0] + executed[2];
  const corridorBench = gbench.urban + gbench.transport;
  if (executed[0] < gbench.urban * 0.25) dMom -= 20;            // urban drafted near zero
  else if (corridor < corridorBench * 0.6) dMom -= 12;         // corridor starved
  if (event.key === "flood") dMom -= 5;
  if (corridor >= corridorBench * 0.95) dMom += 5;              // corridor fed at benchmark
  if (event.key === "boom") dMom += 3;
  if (dMom) { gauges.momentum = Math.max(0, Math.min(100, gauges.momentum + dMom)); gaugeDeltas.momentum = dMom; }
  // Guarantee ratchet: climbs on expansion past benchmark, taking a
  // permanent bite at the committed share; rolls back only −2, rarely.
  let dRat = 0, ratchetBite = 0;
  if (executed[7] > gbench.subsidies * 1.1) { dRat = 10; ratchetBite = 0.005; }
  else if (executed[7] < gbench.subsidies * 0.9) dRat = -2;
  if (dRat) { gauges.ratchet = Math.max(0, Math.min(100, gauges.ratchet + dRat)); gaugeDeltas.ratchet = dRat; }

  // -- Step 10: carry the world forward. Next year's GSDP compounds;
  // 75% of this year's capex boost becomes next year's pendingBoost.
  const nextWorld: World = {
    gsdp: world.gsdp * (1 + growth),
    debt: debtNew,
    rate,
    rating,
    indices: idx,
    pendingBoost: capexBoost * 0.75,
    committedAdj: world.committedAdj + (event.committedBump ?? 0) + ratchetBite,
    gauges,
  };

  // Narrative notes for the results screen — the engine explains itself.
  const notes: string[] = [];
  if (isFuture) {
    notes.push(`Revenue forecast ${fmt(forecast)}; realized ${fmt(revenueRealized)} (${noise * event.revNoise > 1 ? "beat" : "miss"} of ${Math.abs(Math.round((noise * event.revNoise - 1) * 100))}%).`);
  }
  if (goldenRule) notes.push("Golden rule held: borrowing stayed within executed capital spending.");
  else notes.push(`Golden rule broken: borrowed ${fmt(borrowing)} against only ${fmt(capexExecuted)} of executed capex — borrowing is partly funding consumption.`);
  if (ratio > DEBT_CAP) notes.push(`Debt crossed the 25.2% cap (${pct(ratio)}). Rating: ${rating}, borrowing rate now ${rate.toFixed(1)}%.`);
  if (event.extraCost > 0) notes.push(`Shock cost ${fmt(event.extraCost)} added straight to debt.`);
  if (event.extraCost < 0) notes.push(`Windfall: ${fmt(-event.extraCost)} of extra revenue.`);
  if (leverExtra > 500) notes.push(`Revenue dials delivered ${fmt(leverExtra)} extra to the pool (excise ×${sinEff.toFixed(2)}, mining ×${revMods.mining.toFixed(2)}, user charges ×${revMods.charges.toFixed(2)}).`);
  if (leverExtra < -500) notes.push(`Revenue dials gave up ${fmt(-leverExtra)} (excise ×${sinEff.toFixed(2)}, mining ×${revMods.mining.toFixed(2)}, user charges ×${revMods.charges.toFixed(2)}).`);
  if (sinEff > 1.001) notes.push(`Excise pushed above benchmark: the health ledger logged ${revDeltas.health.toFixed(2)} — alcohol's social cost is real, if unpriced.`);
  if (sinEff < 0.999) notes.push(`Excise cut below benchmark: the health ledger credits you +${revDeltas.health.toFixed(2)}.`);
  if (event.committedBump) notes.push(`Pay Commission: ${fmt(event.extraCost)} of arrears went straight to debt, and the committed share rises permanently by ${(event.committedBump * 100).toFixed(1)} paise per revenue rupee.`);
  if (momentumTilt < 1) notes.push(`Urban momentum shaved ${((1 - momentumTilt) * 100).toFixed(1)}% off this year's collections — the stamps machine is cooling.`);
  if (issuancePremium > 100) notes.push(`Thin order book: ${fmt(issuancePremium)} of issuance premium went straight onto the debt (market patience ${Math.round(gauges.patience)}).`);
  if (gaugeDeltas.patience) notes.push(`Market patience ${gaugeDeltas.patience > 0 ? "recovered" : "fell"} to ${Math.round(gauges.patience)} — the bond market keeps a longer ledger than the voters do.`);
  if (gaugeDeltas.momentum) notes.push(`Urban momentum ${gaugeDeltas.momentum > 0 ? "rose" : "fell"} to ${Math.round(gauges.momentum)}.`);
  if (gaugeDeltas.ratchet && ratchetBite) notes.push(`Guarantee ratchet climbed to ${Math.round(gauges.ratchet)}: a new permanent floor — the committed share gains 0.5 paise per revenue rupee, forever.`);
  else if (gaugeDeltas.ratchet) notes.push(`Guarantee ratchet eased to ${Math.round(gauges.ratchet)} — a rare rollback.`);

  // Everything the results screen needs, frozen at resolution time.
  return {
    world: nextWorld,
    res: {
      fy: cfg.fy, era: cfg.era, growth, gsdp: world.gsdp, debt: debtNew, debtRatio: ratio,
      rating, borrowing, fdPct, capexExecuted, goldenRule, revenueRealized, revenueForecast: forecast,
      event, allocs, bucketsExecuted: executed, indices: idx, indexDeltas, execRatio, notes,
      revMods, leverExtra, revDeltas, gauges, gaugeDeltas, issuancePremium,
    },
  };
}

/**
 * Full result of one resolved turn. Stored in the results array so
 * the final screen can chart the whole trajectory without re-simulating.
 */
type TurnResult = {
  fy: string;
  era: "historical" | "future";
  growth: number;
  gsdp: number;
  debt: number;
  debtRatio: number;
  rating: string;
  borrowing: number;
  fdPct: number;
  capexExecuted: number;
  goldenRule: boolean;
  revenueRealized: number;
  revenueForecast: number;
  event: EventCard;
  allocs: number[];
  bucketsExecuted: number[];
  indices: { health: number; education: number; water: number; equity: number };
  indexDeltas: Record<string, number>;
  execRatio: number;
  notes: string[];
  revMods: { sin: number; mining: number; charges: number };
  leverExtra: number;
  revDeltas: { health: number; equity: number };
  gauges: { patience: number; momentum: number; ratchet: number };
  gaugeDeltas: Record<string, number>;
  issuancePremium: number;
};

/* ---------------- Baseline (what actually happened) ---------------- */

/**
 * The real-world debt path the player is measured against:
 * actual deficits 2023-24 → 2025-26 (CAG/RBI), then the ISEC trend
 * projection (+~0.9pp/yr) — which breaches the 25.2% cap inside this
 * window, exactly as the project's own debt model shows.
 */
const BASELINE = [
  { fy: "2023-24", ratio: 23.4 }, { fy: "2024-25", ratio: 24.2 },
  { fy: "2025-26", ratio: 25.0 }, { fy: "2026-27", ratio: 25.9 },
  { fy: "2027-28", ratio: 26.8 },
];

/* ---------------- 6. The Analyst — the game's narrator ---------------- */

/**
 * The Analyst — the game's "dungeon master". Dr Sid Kotian is the finance
 * ministry's chief economic advisor: he reads each year aloud, watches
 * the draft budget as the sliders move, and delivers the reckoning.
 * His lines are flavour wrapped around the SAME verified numbers the
 * engine uses; he can be heard or ignored, and nothing in resolveTurn
 * ever reads what he says.
 */
const ANALYST_NAME = "Dr Sid Kotian — Chief Economic Advisor";

/**
 * The opening scene of the whole game (intro screen). Every figure is
 * calibrated/verified: ₹26 lakh cr opening GSDP, the 25.2% debt cap.
 */
const INTRO_SCENE =
  "You are the Finance Minister of Karnataka. You get five chances to grow a ₹26 lakh-crore economy, keep citizens healthy, schooled and watered, and hold the debt line at 25.2% of income. The files on your desk are real. The choices are yours.";

/**
 * Turn-opening narration — one scene per budget year, in the Analyst's
 * voice. All numbers are verified RBI/CAG figures (see TURNS and
 * HISTORICAL_EVENTS); only the prose is theatre.
 */
const TURN_SCENES: string[] = [
  "November 2023. A weak monsoon has left the fields anxious, and your first file is already waiting: five poll promises — Gruha Jyothi, Gruha Lakshmi, Anna Bhagya, Shakti — worth over ₹40,000 crore a year once fully running. The vault holds ₹2.33 lakh crore. Most of it was spoken for before you took the oath. The state is watching what you sign first.",
  "The second year opens on a dry note. Deficient rain in the kharif season, farm distress in the north — and a sobering discovery in the accounts: last year's SGST estimate was ₹6,359 crore too optimistic. RBI will grade this state's revenue forecasting a 'D'. Interest payments have just crossed principal repayments for the first time: the debt now costs more to carry than it retires.",
  "The third budget is a wager on one city. Urban development capex nearly triples to ₹2,395 crore while roads take a 28% cut. Gross market borrowing crosses ₹92,000 crore — more than double what it was two budgets ago. The slogan on the file reads 'Brand Bengaluru'. The margin on the ledger reads 'thin'.",
  "Here the audits end and the dice come out. The committed ratchet — pensions, interest, guarantees — now claims about 92 paise of every revenue rupee before you begin. Beyond the lamplight of published data, the year is yours to write. Budget for the monsoon you might get, not the one you hope for.",
  "The final budget. The ratchet now claims 93 paise of every rupee. Whatever divergence was implied by your predecessors' path, yours now compounds — buffers rebuilt or buffers gone, the Kalyana Karnataka divide closed or widened. The demographic clock does not wait for elections.",
];

/**
 * Briefing advice (ledger screen). Reacts to the state of the world —
 * last year's verdict, proximity to the debt cap, and the era. This
 * replaces the old "carrying over" paragraph: consequences carry over
 * in the Analyst's voice instead.
 */
function analystBriefing(
  turnIdx: number, world: World, cfg: TurnCfg, prev: TurnResult | null,
): string[] {
  const lines: string[] = [];
  const ratio = world.debt / world.gsdp;
  if (turnIdx === 0) {
    lines.push("I'm Dr Sid Kotian. I read the ledgers so you can read the room. I'll advise you every year — what you do with my advice is politics; what the numbers do is arithmetic.");
    lines.push("Know this before you touch a slider: of every ₹100 of revenue this year, ₹89 is already spoken for — salaries, pensions, interest, schemes. Your kingdom is the last ₹11, plus whatever you dare to borrow.");
    lines.push("Three money machines fund the state's own earnings: the bottle (excise — ₹34,629 cr, the second-largest own tax), the mine (Ballari's iron ore, ~₹7,300 cr), and the fee (user charges, ~₹2,800 cr). On the drafting table you can twist all three dials — each has its price written on the back.");
  }
  if (prev) {
    if (prev.goldenRule) lines.push("Last year the golden rule held — every borrowed rupee went into capital. Boring is underrated, Minister.");
    else lines.push(`Last year you borrowed ${fmt(prev.borrowing)} against ${fmt(prev.capexExecuted)} of executed capital. The golden rule snapped — some of that debt now pays for consumption, and the market files such things away.`);
  }
  if (ratio > DEBT_CAP) lines.push(`Debt stands at ${pct(ratio)} of GSDP — over the 25.2% cap. Every fresh bond we sell now carries our penalty rate (${world.rate.toFixed(1)}%). I'd climb down before I climb further.`);
  else if (ratio > 0.244) lines.push(`Debt is at ${pct(ratio)} of GSDP — inside the cap, but the margin is thinner than a monsoon forecast. One bad year pushes us through.`);
  if (world.committedAdj > 0) lines.push(`The Pay Commission award now sits permanently in the ledger: ${(world.committedAdj * 100).toFixed(1)} paise more of every revenue rupee is spoken for before you begin. The ratchet has a new tooth.`);
  if (world.gauges.patience < 45) lines.push(`Market patience stands at ${Math.round(world.gauges.patience)}. The debt office reports a thinning order book — our last auction cleared only after the yield nodded. The market reads our ledgers before it reads our press releases.`);
  if (world.gauges.momentum < 40) lines.push(`Urban momentum at ${Math.round(world.gauges.momentum)} — Hyderabad and Pune don't wait while we hesitate. Starve the corridor and the stamps table notices before the voters do.`);
  if (world.gauges.ratchet > 60) lines.push(`The guarantee ratchet stands at ${Math.round(world.gauges.ratchet)}. We didn't spend that money, Minister — we re-based the state's floor. That applause will outlive both of us.`);
  if (cfg.era === "future") lines.push("The published numbers end here. From this year on, revenue realization, execution speed and the year's shocks are dice — my advice can only help you choose what to bet on.");
  return lines;
}

/**
 * Live drafting commentary (allocate screen). Derived fresh on every
 * render from the slider positions — the Analyst looking over your
 * shoulder. Signals are priority-ordered and capped at four lines.
 */
function analystDrafting(
  turnIdx: number, world: World, cfg: TurnCfg,
  borrowing: number, allocs: number[], pool: number,
  revMods: { sin: number; mining: number; charges: number }, leverExtra: number,
): string[] {
  const lines: string[] = [];
  const byKey: Record<string, number> = {};
  BUCKETS.forEach((b, i) => (byKey[b.key] = allocs[i]));
  const capexBudgeted = BUCKETS.reduce((s, b, i) => s + (b.kind === "capex" ? allocs[i] : 0), 0);

  // 1) The KFRA borrowing line.
  if (borrowing > world.gsdp * GFD_CAP)
    lines.push(`The borrowing slider is past the KFRA line — ${pct(borrowing / world.gsdp)} of GSDP. Rating agencies don't send warnings, they send invoices: expect the cost of every future bond to creep up.`);
  // 2) The golden rule, judged on the draft (executed capex will land lower).
  if (borrowing > capexBudgeted)
    lines.push(`You're borrowing ${fmt(borrowing)} but drafting only ${fmt(capexBudgeted)} of capital. Borrow beyond your capex and the golden rule breaks before the dice even roll.`);
  // 2a) The consequence gauges — warn when this draft will move them.
  const gbench = gaugeBenchmarks(turnIdx);
  if (byKey.subsidies > gbench.subsidies * 1.1)
    lines.push(`Subsidies at ${fmt(byKey.subsidies)} — past ${fmt(gbench.subsidies * 1.1)} the guarantee ratchet climbs, and it takes a permanent 0.5-paise bite at the committed share. That applause will outlive both of us.`);
  if (byKey.urban < gbench.urban * 0.25)
    lines.push(`Urban Bengaluru drafted at ${fmt(byKey.urban)} — a floor this thin drops urban momentum by 20 points, and the stamps machine cools with it.`);
  if (cfg.era === "future" && world.gauges.patience < 45 && borrowing > 0)
    lines.push(`With market patience at ${Math.round(world.gauges.patience)}, this auction carries a premium — the slippage goes straight onto the debt.`);
  // 2b) The revenue dials — the Analyst prices each twist.
  if (revMods.sin > 1.15)
    lines.push(`Excise at ×${revMods.sin.toFixed(2)} — past ×1.15 you're mostly licensing the illicit trade. NIPFP's draft reckons alcohol's social cost at the order of 2% of GSDP; the health ledger will log it.`);
  else if (revMods.sin < 0.95)
    lines.push(`You've cut excise to ×${revMods.sin.toFixed(2)} — the health ledger thanks you, the treasury doesn't. Somebody must now fund what the bottle was funding.`);
  if (revMods.mining > 1.2)
    lines.push(`Mining at ×${revMods.mining.toFixed(2)} — auction the belt harder and Ballari's money lands in Kalyana Karnataka. Just remember: ore is a finite file to sign.`);
  if (revMods.charges > 1.15)
    lines.push(`User charges at ×${revMods.charges.toFixed(2)} — a water bill is the most honest tax and the most hated one. The equity ledger will notice.`);
  if (leverExtra > 5000)
    lines.push(`Your revenue dials are carrying ${fmt(leverExtra)} of this budget. Useful — so long as you remember which ledgers the dials will bill at reckoning.`);
  // 3) Starved growth corridors (urban = the state's engine, and the
  //    player's proposed consequence loop lives here too).
  const urbanFloor = (cfg.era === "historical" ? BUCKETS[0].actual[turnIdx] : BUCKETS[0].hdiRef) * 0.5;
  if (byKey.urban < urbanFloor)
    lines.push(`Urban Bengaluru sits at ${fmt(byKey.urban)}. Hyderabad and Pune don't wait while we hesitate — every corridor we don't fund, a rival city builds twice, and the stamps revenue walks with it.`);
  // 4) Starved human development (one warning is enough).
  for (const b of BUCKETS) {
    if (b.hdi && b.key !== "subsidies" && byKey[b.key] < b.hdiRef * 0.5) {
      lines.push(`${b.name} is drafted at ${fmt(byKey[b.key])} — under half its benchmark (${fmt(b.hdiRef)}). The ${b.hdi} index will remember this year longer than the voters will.`);
      break;
    }
  }
  // 5) Subsidy share of the pool.
  if (byKey.subsidies > pool * 0.55)
    lines.push("Subsidies are taking more than half the pool. A guarantee is the most expensive applause in the business — it outlives the applause by decades.");
  // 6) Unallocated money (the confirm-time sweep, said out loud).
  const unalloc = pool - allocs.reduce((a, b) => a + b, 0);
  if (unalloc > pool * 0.12)
    lines.push(`${fmt(unalloc)} still sits unallocated — on lock, the machine sweeps it into your largest line. Better to decide it yourself, Minister.`);
  if (!lines.length)
    lines.push("A disciplined draft, on its face. Now the part no slide ever shows: the year will not ask your permission before it happens.");
  return lines.slice(0, 4);
}

/**
 * Reckoning commentary (results screen): one verdict line on
 * execution, then the engine's factual notes spoken in the Analyst's
 * voice (revenue beats/misses, rule verdicts, cap breaches, shocks).
 */
function analystReckoning(last: TurnResult): string[] {
  const lines: string[] = [];
  if (last.execRatio >= 0.85)
    lines.push(`The machine worked this year: ${pct(last.execRatio)} of budgeted capital actually moved. Some years, the state keeps its promises.`);
  else if (last.execRatio >= 0.7)
    lines.push(`${pct(last.execRatio)} of budgeted capital moved — respectable, but a quarter of your promises stayed on paper.`);
  else
    lines.push(`Only ${pct(last.execRatio)} of budgeted capital moved. A budget is a promise; execution is the keeping of it.`);
  lines.push(...last.notes);
  return lines;
}

/**
 * Epilogue (final screen): the Analyst's closing verdict, driven by
 * the same grade arithmetic the scorecard shows.
 */
function analystEpilogue(
  grade: string, finalRatio: number, goldenBreaks: number, hdiDelta: number,
): string[] {
  const lines: string[] = [];
  if (grade === "A") lines.push("History keeps a short shelf for finance ministers who held growth, the social ledger and the debt line all at once. You're on it.");
  else if (grade === "B+" || grade === "B") lines.push("A working exchequer — growth and development broadly held, with one soft spot you already know the name of.");
  else if (grade === "C") lines.push("You governed the way recent budgets have: a rich state, still growing, quietly spending its buffers.");
  else lines.push("High promises, thin margins, no room for the next shock. The guarantees won the news cycle; compounding won the decade.");
  if (finalRatio <= DEBT_CAP) lines.push(`And you kept the debt at ${pct(finalRatio)} — inside the 25.2% cap while the real trajectory crossed it. That, Minister, is the whole game.`);
  else lines.push(`Debt closed at ${pct(finalRatio)} of GSDP. The real path crossed the cap too — the difference between your Karnataka and theirs is the size of the hole.`);
  if (goldenBreaks === 0) lines.push("Five budgets, and not once did you borrow for consumption. The golden rule held. They'll call it boring; the bond market will call it beautiful.");
  else if (goldenBreaks >= 3) lines.push(`The golden rule broke ${goldenBreaks} times in five years. Each break was small; together they re-priced every rupee you'll ever borrow.`);
  if (hdiDelta >= 4) lines.push("And the human ledger: schools, clinics, water and the Kalyana Karnataka divide all moved. Growth is the headlines; this is the history.");
  return lines;
}

/** Typewriter hook — types `text` out two chars per tick for the
 *  read-aloud feel. `skip` reveals the whole line instantly (the
 *  player's right at any table). */
function useTypewriter(text: string, speedMs = 14) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(text.length, i + 2);
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, speedMs);
    return () => clearInterval(id);
  }, [text, speedMs]);
  return { shown: text.slice(0, n), done: n >= text.length, skip: () => setN(text.length) };
}

/** Scene narration card — the turn's opening, styled as an official
 *  memorandum on aged paper with government letterhead. */
const SceneNarration = ({ text }: { text: string }) => {
  const { shown, done, skip } = useTypewriter(text);
  return (
    <div className="paper-texture rounded-sm p-6 relative">
      <div className="paper-clip" />
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-900/20">
        <div className="text-[10px] uppercase tracking-[0.2em] text-red-800 font-serif font-bold">Office Memorandum</div>
        <div className="file-number">FM/BUD/{new Date().getFullYear()}</div>
      </div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-amber-800/70 mb-2">The Chief Economic Advisor reads the year</div>
      <p className="font-serif text-[15px] italic leading-relaxed text-amber-900">
        {shown}
        {!done && <span className="animate-pulse text-red-800">▌</span>}
      </p>
      {!done && (
        <button onClick={skip} className="mt-3 text-[11px] text-amber-700 underline hover:text-amber-900 font-serif">
          skip ⏩
        </button>
      )}
      <div className="mt-4 pt-2 border-t border-amber-900/20 flex justify-end">
        <div className="official-seal w-12 h-12 text-[7px]">
          <span className="relative z-10">Govt<br/>of<br/>Karnataka</span>
        </div>
      </div>
    </div>
  );
};

/** The Analyst's advice panel — the DM's guidance on official letterhead.
 *  Styled as a note pinned to the minister's desk. Advisory only; it
 *  never blocks play and never touches the numbers. */
const AnalystBox = ({ lines, tone = "neutral" }: { lines: string[]; tone?: "neutral" | "warn" | "good" }) => (
  <div className={`paper-texture rounded-sm p-4 relative ${
    tone === "warn" ? "ring-2 ring-red-800/30" : tone === "good" ? "ring-2 ring-emerald-700/30" : ""
  }`}>
    <div className="paper-clip" />
    <div className="flex items-center gap-3 mb-3 pb-2 border-b border-amber-900/20">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-800 bg-amber-100 text-lg shadow-inner">🧐</div>
      <div>
        <div className="text-sm font-serif font-bold text-amber-900">{ANALYST_NAME}</div>
        <div className="text-[10px] uppercase tracking-wider text-red-800/70">advice — take it or leave it</div>
      </div>
      <div className="ml-auto">
        <RubberStamp text={tone === "warn" ? "Urgent" : tone === "good" ? "Noted" : "For Info"} type={tone === "warn" ? "rejected" : tone === "good" ? "approved" : "noted"} size="sm" />
      </div>
    </div>
    <div className="space-y-2 text-sm">
      {lines.map((l, i) => (
        <p key={i} className={`font-serif leading-relaxed ${tone === "warn" ? "text-red-900" : tone === "good" ? "text-emerald-900" : "text-amber-900"}`}>
          {l}
        </p>
      ))}
    </div>
    <div className="mt-3 pt-2 border-t border-amber-900/20">
      <SignatureLine label="Dr Sid Kotian, CEA" />
    </div>
  </div>
);

/** One-look rupee flow: the year's spending power split into
 *  committed (locked), free (the player's kingdom) and borrowed money.
 *  Styled as a treasury ledger breakdown. */
const RupeeBar = ({ committed, discretionary, borrowing }: { committed: number; discretionary: number; borrowing: number }) => {
  const total = committed + discretionary + borrowing;
  return (
    <div className="paper-texture rounded-sm p-4">
      <div className="text-[10px] uppercase tracking-wider text-amber-800/70 font-serif mb-2 border-b border-amber-900/20 pb-1">Treasury Ledger — FY Allocation</div>
      <div className="flex h-10 overflow-hidden rounded-sm text-[11px] font-serif font-medium border border-amber-900/30">
        <div className="flex items-center justify-center overflow-hidden whitespace-nowrap bg-red-800/80 px-2 text-amber-50" style={{ width: `${(committed / total) * 100}%` }}>
          🔒 Committed {fmt(committed)}
        </div>
        <div className="flex items-center justify-center overflow-hidden whitespace-nowrap bg-emerald-700/80 px-2 text-amber-50" style={{ width: `${(discretionary / total) * 100}%` }}>
          ✋ Free {fmt(discretionary)}
        </div>
        {borrowing > 0 && (
          <div className="flex items-center justify-center overflow-hidden whitespace-nowrap bg-amber-600 px-2 text-amber-950" style={{ width: `${(borrowing / total) * 100}%` }}>
            🏛️ Borrowed {fmt(borrowing)}
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-amber-800/70 font-serif">
        <span>the year's spending power, at a glance</span>
        <span className="font-bold">{fmt(total)} total</span>
      </div>
    </div>
  );
};

/** You-vs-government mini bars for historical turns, styled as
 *  a comparison ledger (your draft in ink, government in red seal). */
const CompareBar = ({ you, govt, max }: { you: number; govt: number; max: number }) => (
  <div className="mt-2 space-y-1.5 text-[10px] font-serif">
    <div className="flex items-center gap-2">
      <span className="w-12 text-amber-800 font-bold">Your draft</span>
      <div className="h-2 flex-1 overflow-hidden rounded-sm bg-amber-900/10 border border-amber-900/20">
        <div className="h-full rounded-sm bg-amber-700" style={{ width: `${Math.min(100, (you / max) * 100)}%` }} />
      </div>
      <span className="w-16 text-right text-amber-900">{fmt(you)}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="w-12 text-red-800 font-bold">Govt actual</span>
      <div className="h-2 flex-1 overflow-hidden rounded-sm bg-amber-900/10 border border-amber-900/20">
        <div className="h-full rounded-sm bg-red-700" style={{ width: `${Math.min(100, (govt / max) * 100)}%` }} />
      </div>
      <span className="w-16 text-right text-amber-900">{fmt(govt)}</span>
    </div>
  </div>
);

/* ---------------- 7. UI helpers ---------------- */

/** Compact stat card styled as a ledger entry on official paper.
 *  `tone` colors the value like ink stamps. */
const Stat = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn" }) => (
  <div className="paper-texture rounded-sm p-3 relative">
    <div className="text-[10px] uppercase tracking-wider text-amber-800/70 font-serif border-b border-amber-900/20 pb-1 mb-1.5">{label}</div>
    <div className={`text-lg font-serif font-bold ${tone === "good" ? "text-emerald-800" : tone === "bad" ? "text-red-800" : tone === "warn" ? "text-amber-700" : "text-amber-900"}`}>{value}</div>
    {sub && <div className="text-[10px] text-amber-800/60 font-serif mt-0.5">{sub}</div>}
  </div>
);

/** Badge distinguishing anchored historical turns from open future ones.
 *  Styled as an official file classification stamp. */
const EraBadge = ({ era }: { era: "historical" | "future" }) => (
  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm border-2 font-serif text-[10px] font-bold uppercase tracking-wider ${
    era === "historical"
      ? "border-blue-800 text-blue-800 bg-blue-50 rotate-[-2deg]"
      : "border-amber-700 text-amber-800 bg-amber-50 rotate-[2deg]"
  }`}>
    <span>{era === "historical" ? "📜" : "🎲"}</span>
    <span>{era === "historical" ? "Verified Records — RBI/CAG" : "Open File — Projected"}</span>
  </div>
);

/** Turn progress styled as a file tray with labeled folders. */
const Dots = ({ turn }: { turn: number }) => (
  <div className="flex items-end gap-1">
    {TURNS.map((t, i) => (
      <div key={i} className="flex flex-col items-center gap-0.5">
        <div className={`w-8 h-6 rounded-t-sm border-t-2 border-l-2 border-r-2 ${
          i < turn
            ? "bg-emerald-700 border-emerald-900"
            : i === turn
            ? "bg-amber-600 border-amber-800"
            : "bg-stone-400 border-stone-500"
        }`} />
        <div className={`text-[8px] font-serif ${i === turn ? "text-amber-900 font-bold" : "text-amber-100/50"}`}>
          {t.fy.slice(2)}
        </div>
      </div>
    ))}
  </div>
);

/* ---------------- App: the phase state machine ---------------- */

/**
 * phase: intro → [ledger → allocate → results] × 5 turns → final.
 * State ownership:
 *   - `world`: the persistent fiscal state (one World per turn).
 *   - `results`: every resolved TurnResult, for the final scorecard.
 *   - `borrowing` / `allocs`: the player's in-progress draft budget.
 */
export default function App() {
  const [phase, setPhase] = useState<"intro" | "ledger" | "allocate" | "results" | "final">("intro");
  const [turn, setTurn] = useState(0);
  const [world, setWorld] = useState<World>(initialWorld);
  const [results, setResults] = useState<TurnResult[]>([]);
  const [last, setLast] = useState<TurnResult | null>(null);
  const [borrowing, setBorrowing] = useState<number>(0);
  const [allocs, setAllocs] = useState<number[]>(BUCKETS.map(() => 0));
  const [seedBump, setSeedBump] = useState(0); // tiny state nudge so each turn's dice feel fresh; kept small so it never affects the draw range
  // The three revenue dials (multipliers on real revenue heads) and
  // two disclosure toggles (revenue breakdown, golden-rule explainer).
  const [revMods, setRevMods] = useState<{ sin: number; mining: number; charges: number }>({ sin: 1, mining: 1, charges: 1 });
  const [showRev, setShowRev] = useState(false);
  const [showGolden, setShowGolden] = useState(false);

  // ---- Derived ledger numbers for the current turn ----
  const cfg = TURNS[turn];
  // Revenue forecast: real for historical turns; ~9.2% of the player's
  // current GSDP path for future turns (growth → revenue compounding).
  const forecast = cfg.era === "future" ? world.gsdp * REV_GSDP_RATIO : cfg.revenue;
  // Effective committed rate: the turn's ratchet plus any permanent
  // additions the world has accumulated (Pay Commission award).
  const committedRateNow = Math.min(0.97, cfg.committedRate + world.committedAdj);
  const committed = forecast * committedRateNow;  // locked-in spending
  const discretionary = forecast - committed;       // what's free before borrowing
  // Revenue-dial preview (the engine re-computes with the year's
  // actual realization noise): benchmark × (dial − 1), with the same
  // excise taper past ×1.15 the engine applies.
  const benchNow = revBenchmarks(turn, forecast);
  const sinEffNow = revMods.sin <= 1.15 ? revMods.sin : 1.15 + (revMods.sin - 1.15) * 0.5;
  const leverExtraNow = (sinEffNow - 1) * benchNow.sin + (revMods.mining - 1) * benchNow.mining + (revMods.charges - 1) * benchNow.charges;
  const pool = discretionary + borrowing + leverExtraNow;  // the full allocation pool
  const leverText = leverExtraNow > 500 ? ` + ${fmt(leverExtraNow)} from revenue dials` : leverExtraNow < -500 ? ` − ${fmt(-leverExtraNow)} given up via revenue dials` : "";
  const allocated = allocs.reduce((a, b) => a + b, 0);
  const remaining = pool - allocated;
  // Borrowing slider bounds: 0 up to 3.5% of GSDP, so the player CAN
  // breach the KFRA 3% cap — visibly, with a warning and a growth cost.
  // Market patience below 25 (future turns) = partial auction
  // failure: the market won't absorb more than 2.5% of GSDP.
  const auctionCap = cfg.era === "future" && world.gauges.patience < 25;
  const maxBorrow = Math.round(world.gsdp * (auctionCap ? 0.025 : 0.035) / 100) * 100;
  const borrowCap = world.gsdp * GFD_CAP;

  /** Enter a turn: pre-load a sensible default draft budget.
   *  Historical turns default to the government's real FD %; future
   *  turns default to the 3% cap; sliders start at benchmark spends. */
  const startTurn = () => {
    const borrowCeiling = auctionCap ? Math.min(borrowCap, world.gsdp * 0.025) : borrowCap;
    const defaultBorrow = Math.round(Math.min(borrowCeiling, world.gsdp * (cfg.era === "historical" ? [0.026, 0.027, 0.0295][turn] : 0.03)) / 100) * 100;
    setBorrowing(defaultBorrow);
    setAllocs(BUCKETS.map((b) => (cfg.era === "historical" ? b.actual[turn] : Math.round(b.hdiRef * 0.9))));
    setRevMods({ sin: 1, mining: 1, charges: 1 });
    setPhase("ledger");
  };

  /** Historical turns only: load the government's exact real budget,
   *  so players can start from reality and tweak. */
  const matchGovt = () => {
    setBorrowing(Math.round(cfg.actualFD / 100) * 100);
    setAllocs(BUCKETS.map((b) => b.actual[turn]));
    setRevMods({ sin: 1, mining: 1, charges: 1 }); // the real budgets left the dials untwisted
  };

  /** Set one bucket's allocation, snapped to ₹50 cr steps for tidy sliders. */
  const setBucket = (i: number, v: number) => {
    const next = [...allocs];
    next[i] = Math.round(v / 50) * 50;
    setAllocs(next);
  };

  /** Set one revenue dial (a multiplier on its head), snapped to 0.05 steps. */
  const setRevMod = (k: "sin" | "mining" | "charges", v: number) =>
    setRevMods({ ...revMods, [k]: Math.round(v * 20) / 20 });

  /**
   * Lock the budget and resolve the year. Any small remainder (slider
   * rounding) is absorbed into the player's largest bucket, so the
   * budget always balances to the rupee. Three dice are rolled here:
   * execution ratio, event draw, revenue noise.
   */
  const confirm = () => {
    // absorb small remainder into the largest bucket
    let next = [...allocs];
    const rem = Math.round(remaining / 50) * 50;
    if (Math.abs(rem) > 0) {
      let big = 0;
      next.forEach((v, i) => { if (v > next[big]) big = i; });
      next[big] = Math.max(0, next[big] + rem);
    }
    const r = { exec: Math.random(), event: Math.random() + seedBump % 1, noise: Math.random() };
    const { world: w2, res } = resolveTurn(turn, next, Math.round(borrowing / 100) * 100, revMods, world, r);
    setWorld(w2);        // advance the world for next turn
    setResults([...results, res]);
    setLast(res);        // results screen shows this turn
    setPhase("results");
  };

  /** Advance to the next turn, or the final scorecard after turn 5. */
  const nextTurn = () => {
    if (turn === 4) { setPhase("final"); return; }
    setTurn(turn + 1);
    setSeedBump(seedBump + 1);
    setBorrowing(0);
    setAllocs(BUCKETS.map(() => 0));
    setRevMods({ sin: 1, mining: 1, charges: 1 });
    setPhase("ledger");
  };

  /** Full reset — every replay rolls new dice for the future turns. */
  const restart = () => {
    setPhase("intro"); setTurn(0); setWorld(initialWorld()); setResults([]); setLast(null); setBorrowing(0); setAllocs(BUCKETS.map(() => 0)); setRevMods({ sin: 1, mining: 1, charges: 1 });
  };

  /* ---------------- Screens ---------------- */

  // -- Intro: premise, rules of the world, and the data disclaimer. --
  if (phase === "intro") {
    return (
      <DeskScene><div className="min-h-screen text-amber-100 p-6">
        <div className="mx-auto max-w-3xl">
          {/* Government of Karnataka official letterhead */}
          <div className="mt-6">
            <GovtMasthead subtitle="Finance Department — Budget Wing" />
            <div className="paper-texture rounded-b-lg p-6 -mt-1">
              <div className="text-center">
                <KarnatakaFlag className="mb-4" />
                <h1 className="text-3xl font-serif font-bold text-amber-900 tracking-tight">Five Budgets: Karnataka</h1>
                <p className="mt-2 text-amber-800/70 font-serif italic">A fiscal role-playing game built on real RBI, CAG and budget data</p>
              </div>
              <div className="mt-6 flex justify-center">
                <Nameplate name="Finance Minister" designation="Government of Karnataka" />
              </div>
            </div>
          </div>
          {/* The DM opens the story, then states the listen-or-ignore contract */}
          <div className="mt-8">
            <SceneNarration text={INTRO_SCENE} />
          </div>
          <div className="mt-4">
            <AnalystBox
              lines={[
                "I'm Dr Sid Kotian, and I'm here to advise you.",
                "Hear me out or ignore me entirely; I never touch your sliders. The only thing that decides how Karnataka looks in 2028 is what you sign.",
                "One caution before we begin: the engine under this game is real arithmetic on real budgets. When you break the golden rule, it breaks — I merely tell you which rule is about to.",
              ]}
            />
          </div>

          {/* The shape of the campaign: three file folders */}
          <div className="mt-6">
            <div className="flex gap-1 mb-0">
              <FileFolderTab label="BUDGET FILES" active={true} />
            </div>
            <div className="paper-texture rounded-tr-lg rounded-br-lg rounded-bl-lg p-5 space-y-4">
              {[
                { e: "📜", t: "Acts I–III · the real years", d: "FY 2023-24, 2024-25 and 2025-26, replayed against the actual budgets and outcomes from the RBI Study of Budgets and CAG audits. Every turn you can start from what the government really did — then dare to differ." },
                { e: "🎲", t: "Acts IV–V · the open years", d: "FY 2026-27 and 2027-28, where the audits end. Revenue realization, execution speed and shocks — drought, floods, IT cycles, devolution cuts, windfalls — are the dice." },
                { e: "⚖️", t: "The straightjacket", d: "About 90% of revenue is locked into salaries, pensions, interest and guarantees before you begin. Your real levers: the last 10%, how much you borrow, how you split growth against human development — and three revenue dials: the bottle 🍺, the mine ⛏️ and the water bill 🚿." },
              ].map((c) => (
                <div key={c.t} className="border-l-4 border-amber-700 pl-4 py-2 bg-amber-50/50 rounded-r">
                  <div className="font-serif font-bold text-amber-900"><span className="mr-1.5">{c.e}</span>{c.t}</div>
                  <div className="mt-1 text-sm text-amber-800/80 font-serif">{c.d}</div>
                </div>
              ))}
            </div>
          </div>
          {/* The fiscal rulebook — official Karnataka Gazette notice style */}
          <div className="mt-6">
            <BrassPlaque>📋 Karnataka Fiscal Responsibility Rules — As Enforced</BrassPlaque>
            <div className="paper-texture rounded-b-lg p-4 text-sm mt-1">
              <p className="font-serif text-amber-900 leading-relaxed">
                <span className="font-bold text-red-800">The rules of the world:</span> keep the fiscal deficit near 3% of GSDP (KFRA), watch the 25.2% debt-to-GSDP cap (16th FC), and remember the golden rule — borrow only for capital spending. Interest above ₹41,000 crore a year is already eating 14% of revenue. Every turn, the demographic clock locks in a little more. And three consequence gauges — bond-market patience, urban momentum, the guarantee ratchet — remember what you do: they fall fast, heal slowly, and are priced from 2026-27.
              </p>
              <div className="mt-3 flex justify-end">
                <WaxSeal color="red" />
              </div>
            </div>
          </div>
          {/* The golden rule — as a Finance Department circular */}
          <div className="mt-4">
            <div className="flex gap-1 mb-0">
              <FileFolderTab label="FD CIRCULAR NO. 01/2023" active={true} />
            </div>
            <div className="paper-texture rounded-tr-lg rounded-br-lg rounded-bl-lg p-5 text-sm">
              <div className="font-serif font-bold text-emerald-800 text-lg mb-3 border-b border-emerald-800/20 pb-2">⚖️ The Golden Rule, Explained</div>
              <p className="mt-2 font-serif text-amber-900"><span className="font-bold text-amber-900">What it says:</span> borrow only to build. A budget keeps the golden rule when its borrowing for the year does not exceed its capital spending — every borrowed rupee matched by a rupee of assets that will outlive the loan.</p>
              <p className="mt-2 font-serif text-amber-900"><span className="font-bold text-amber-900">Why it works:</span> an asset repays its own debt — a metro line, a canal, a highway earns and saves money for decades after the bond matures. Borrow for consumption — salaries, subsidies, guarantees — and the loan outlives what it bought: next year's revenue must pay for next year's spending <span className="italic">and</span> yesterday's consumption, with interest. That is how the ratchet tightens.</p>
              <p className="mt-2 font-serif text-amber-900"><span className="font-bold text-amber-900">Karnataka, on the record:</span> the revenue deficit — consumption spending beyond revenue — went from ₹9,272 crore in 2023-24 to ₹26,127 crore in 2024-25. Interest payments, over ₹41,000 crore a year (14.2% of revenue), exceeded principal repayment for the first time in 2024-25: the debt now costs more to carry than it retires. The state has been borrowing partly to consume.</p>
            </div>
          </div>
          <div className="mt-6 text-center">
            <button
              onClick={startTurn}
              className="brass-plaque text-lg px-8 py-3 hover:brightness-110 transition-all transform hover:scale-105"
            >
              🏛️ Enter Vidhana Soudha →
            </button>
            {/* Provenance + honesty about what's data and what's model */}
            <div className="mt-8 paper-texture rounded-sm p-4 text-[11px] leading-relaxed text-amber-800/80 font-serif">
              <div className="font-bold text-amber-900 mb-1">📜 Data Sources & Methodology</div>
              Data: RBI State Finances — A Study of Budgets (2024-25, 2025-26 editions; Karnataka Appendices I & IV — including the Appendix I revenue decomposition), CAG State Finances Audit 2024-25, ISEC report to the 16th Finance Commission.
              Growth multipliers, execution ratios, shock probabilities, revenue-dial side effects, the consequence gauges and the Pay Commission card's fiscal parameters are model assumptions — the game's realism layer, not official forecasts. GSDP/debt levels calibrated to CAG actuals (₹28.84 lakh cr GSDP, ₹6.92 lakh cr liabilities, 2024-25).
            </div>
          </div>
        </div>
      </div>
      </DeskScene>
    );
  }

  // -- Ledger ("The Briefing"): the Analyst reads the year aloud
  //    first, then the map — vital signs, the rupee-flow bar of what's
  //    locked vs free, and the year's headline intel.
  if (phase === "ledger") {
    const prev = results[results.length - 1]; // carry-over from the previous reckoning
    return (
      <DeskScene><div className="min-h-screen text-amber-100 p-6">
        <div className="mx-auto max-w-4xl">
          {/* Government letterhead for the briefing */}
          <div className="mb-6">
            <GovtMasthead subtitle={`Budget ${turn + 1} of 5 — Finance Department`} />
            <div className="paper-texture rounded-b-lg p-5 -mt-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-red-800 font-serif font-bold uppercase tracking-wider">Annual Budget Briefing</div>
                  <h1 className="text-2xl font-serif font-bold text-amber-900">FY {cfg.fy} — {cfg.tagline}</h1>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <EraBadge era={cfg.era} />
                  <Dots turn={turn} />
                </div>
              </div>
            </div>
          </div>

          {/* The DM reads the year — typed out, skippable */}
          <div className="mt-5">
            <SceneNarration text={TURN_SCENES[turn]} />
          </div>

          {/* The Analyst's read on where the state stands (uses last
              year's reckoning, so consequences carry over in his voice) */}
          <div className="mt-4">
            <AnalystBox lines={analystBriefing(turn, world, cfg, prev)} tone={world.debt / world.gsdp > DEBT_CAP ? "warn" : "neutral"} />
          </div>

          {/* Four vital signs of the state at the start of the year */}
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <Stat label="GSDP (this FY)" value={fmtShort(world.gsdp)} sub={`avg borrowing rate ${world.rate.toFixed(1)}%`} />
            <Stat label="Debt / GSDP" value={pct(world.debt / world.gsdp)} sub={`cap 25.2% · rating ${world.rating}`} tone={world.debt / world.gsdp > DEBT_CAP ? "bad" : "good"} />
            <Stat label="Revenue forecast" value={fmt(forecast)} sub={cfg.era === "future" ? "realization will be random" : "actuals from RBI"} />
            <Stat label="HDI proxy" value={pct((world.indices.health + world.indices.education + world.indices.water + world.indices.equity) / 400)} sub="health·education·water·equity" />
          </div>

          {/* The straightjacket as one picture: the rupee-flow bar,
              then the ledger detail beneath it. */}
          <div className="mt-6 paper-texture rounded-sm p-5">
            <h2 className="font-serif font-bold text-amber-900">Where the money goes before you choose</h2>
            <div className="mt-3">
              <RupeeBar committed={committed} discretionary={discretionary} borrowing={0} />
            </div>
            <div className="mt-3 space-y-1 text-xs text-amber-800/70 font-serif">
              <div>Committed ({Math.round(committedRateNow * 100)}% of revenue): salaries, pensions, interest (₹41,000+ cr/yr), loans & other locked revenue expenditure — and it creeps up every turn.{world.committedAdj > 0 && <span className="text-rose-300"> The Pay Commission award has permanently deepened the lock-in.</span>}</div>
              <div>Free: {fmt(discretionary)} — the discretionary slice you'll actually allocate, before borrowing.</div>
              {cfg.era === "historical" && <div className="text-amber-800/60">The guarantee schemes sit inside your subsidies lever below — in reality they started in 2023-24 and never stopped growing.</div>}
            </div>
          </div>

          {/* The three consequence gauges: fast down, slow up. They
              move now, but their bite is priced only into the open
              years — so the historical calibration stays exact. */}
          <div className="mt-4 paper-texture rounded-sm p-5">
            <h2 className="font-serif font-bold text-amber-900">Consequence gauges</h2>
            <div className="mt-1 text-xs text-amber-800/70 font-serif">Slow to heal, quick to fall. Dr Sid Kotian reads these before every draft — the dice only price them from 2026-27.</div>
            <div className="mt-3 space-y-3">
              {([
                {
                  name: "Bond-market patience", emoji: "🏛️", v: world.gauges.patience,
                  bad: world.gauges.patience < 45, color: "#34d399",
                  proj: world.gauges.patience < 45
                    ? `IN BITE ZONE: issuance premium of ${world.gauges.patience < 25 ? "1.5% — and the auction partially fails (borrowing capped at 2.5% of GSDP)" : "0.5% on every auction, +0.3 on the rate"}`
                    : "falls −12 on a golden-rule break, −10 on a cap breach; repairs +4/yr on a clean budget",
                },
                {
                  name: "Urban momentum", emoji: "🌆", v: world.gauges.momentum,
                  bad: world.gauges.momentum < 40, color: "#34d399",
                  proj: world.gauges.momentum < 40
                    ? `IN BITE ZONE: collections soften by up to ${fmt(forecast * 0.03 * Math.max(0, 40 - world.gauges.momentum) / 40)} a year while it stays here`
                    : "falls −20 if urban capex is drafted near zero; repairs +5/yr at benchmark",
                },
                {
                  name: "Guarantee ratchet", emoji: "🤲", v: world.gauges.ratchet,
                  bad: world.gauges.ratchet > 60, color: "#c084fc",
                  proj: world.gauges.ratchet > 60
                    ? "HIGH FLOOR: every expansion past benchmark locks committed spending in permanently"
                    : "climbs +10 when subsidies pass 1.1× benchmark — each climb takes a permanent 0.5-paise bite at the committed share; rolls back only −2, rarely",
                },
              ] as const).map((g) => (
                <div key={g.name}>
                  <div className="flex justify-between text-xs">
                    <span className={g.bad ? "font-medium text-rose-300" : "text-slate-300"}>{g.emoji} {g.name}</span>
                    <span className="text-slate-400">{Math.round(g.v)}/100</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-2 rounded-full" style={{ width: `${g.v}%`, background: g.bad ? "#fb7185" : g.color }} />
                  </div>
                  <div className="mt-1 text-[10px] text-amber-800/60 font-serif">{g.proj}</div>
                </div>
              ))}
            </div>
            {cfg.era === "historical" && (
              <div className="mt-3 text-[10px] text-amber-800/60 font-serif">These move now, but their bite is priced only into the open years (2026-27 onward) — so replaying the government's real budgets still lands exactly on the CAG numbers.</div>
            )}
          </div>

          {/* Where the money comes from — the RBI Appendix I
              decomposition (real figures on historical turns; share
              estimates on future ones). Excise, mining and user
              charges are highlighted: the three heads the player's
              revenue dials twist. */}
          <div className="mt-4 paper-texture rounded-sm p-5">
            <button className="flex w-full items-center justify-between" onClick={() => setShowRev(!showRev)}>
              <h2 className="font-serif font-bold text-amber-900">Where the money comes from — FY {cfg.fy}</h2>
              <span className="text-sm text-amber-800/70 font-serif">{showRev ? "hide −" : "show +"}</span>
            </button>
            <div className="mt-1 text-xs text-amber-800/70 font-serif">
              About 76 paise of every revenue rupee is self-earned; only ~24 paise arrives from Delhi — Karnataka sends the Union more than it gets back.
              {showRev || " (Open to see the full ledger of heads.)"}
            </div>
            {showRev && (
              <div className="mt-3 space-y-1">
                {revenueRows(turn, forecast).map((r) => (
                  <div key={r.label} className={`flex justify-between text-xs ${r.hi ? "text-amber-900" : "text-slate-400"}`}>
                    <span>{r.label}</span>
                    <span className="font-medium">{fmt(r.value)}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-1.5 text-[10px] leading-relaxed text-amber-800/60">
                  {cfg.era === "historical"
                    ? "Actual figures: RBI Study of Budgets 2025-26, Appendix I — Revenue Receipts, Karnataka."
                    : "Estimated by applying FY2025-26 budget shares to your revenue forecast — model layer, not official estimates."}
                </div>
              </div>
            )}
          </div>

          {/* The year's headline: fixed for historical turns, teed up
              (but hidden) for future ones. */}
          <div className={`mt-6 paper-texture rounded-sm p-5 relative ${cfg.era === "historical" ? "ring-2 ring-blue-800/20" : "ring-2 ring-amber-700/20"}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{cfg.era === "historical" ? "📜" : "🎲"}</span>
              <h2 className="font-semibold">{cfg.era === "historical" ? "What actually happened" : "The year's dice"}</h2>
            </div>
            <div className="mt-2 font-serif font-bold text-amber-900">{cfg.era === "historical" ? HISTORICAL_EVENTS[turn].title : "Events for this year will be drawn when you commit your budget — droughts, floods, IT cycles, windfalls."}</div>
            <p className="mt-1 text-sm text-amber-900 font-serif">{cfg.era === "historical" ? HISTORICAL_EVENTS[turn].body : "In 2026-27 and 2027-28, revenue realization, execution speed and shocks are random. Budget for the world you want, not the one you hope for."}</p>
          </div>

          <div className="mt-8 flex justify-end">
            <Button size="lg" variant="brass" onClick={() => { startTurn(); setPhase("allocate"); }}>📝 Draft your budget →</Button>
          </div>
        </div>
      </div>
      </DeskScene>
    );
  }

  // -- Allocate ("The Drafting Table"): borrowing slider first (it sets
  //    the pool), then the eight bucket sliders with you-vs-government
  //    bars on historical turns. The Analyst looks over your shoulder:
  //    his commentary is derived live from the slider positions.
  if (phase === "allocate") {
    const draftAdvice = analystDrafting(turn, world, cfg, borrowing, allocs, pool, revMods, leverExtraNow);
    return (
      <DeskScene><div className="min-h-screen text-amber-100 p-6">
        <div className="mx-auto max-w-4xl">
          {/* Drafting table header with file reference */}
          <div className="mb-6">
            <div className="flex gap-1 mb-0">
              <FileFolderTab label={`DRAFT BUDGET — FY ${cfg.fy}`} active={true} />
            </div>
            <div className="paper-texture rounded-tr-lg rounded-br-lg rounded-bl-lg p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-red-800 font-serif font-bold uppercase tracking-wider">The Drafting Table</div>
                  <h1 className="text-2xl font-serif font-bold text-amber-900">Allocate {fmt(pool)}</h1>
                  <div className="text-sm text-amber-800/70 font-serif">{fmt(discretionary)} free revenue + {fmt(borrowing)} borrowing{leverText}</div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <EraBadge era={cfg.era} />
                  <Dots turn={turn} />
                </div>
              </div>
            </div>
          </div>

          {/* The Analyst over your shoulder — recomputed as sliders
              move. Advice only: he never touches the numbers. */}
          <div className="mt-4">
            <AnalystBox lines={draftAdvice} tone={borrowing > borrowCap ? "warn" : "neutral"} />
          </div>

          {/* Borrowing: the player's biggest single lever. The slider can
              exceed the KFRA 3% line up to 3.5% — over-borrowing turns
              the value red and triggers engine penalties (rate + growth). */}
          <div className="mt-4 paper-texture rounded-sm p-4">
            <div className="flex justify-between text-sm"><span className="text-slate-300 font-medium">Market borrowing</span>
              <span className={borrowing > borrowCap ? "text-rose-300 font-semibold" : "text-slate-200"}>{fmt(borrowing)}  ({pct((borrowing) / world.gsdp)} of GSDP)</span></div>
            <Slider className="mt-3" value={[borrowing]} onValueChange={(v: number[]) => setBorrowing(Math.min(v[0], maxBorrow))} max={maxBorrow} min={0} step={500} />
            <div className="mt-1 flex justify-between text-[11px] text-amber-800/60 font-serif"><span>0</span><span className="text-amber-300">KFRA cap 3% = {fmt(borrowCap)}</span><span>{fmt(maxBorrow)} ({auctionCap ? "2.5% — auction capped" : "3.5%"})</span></div>
            {auctionCap && <div className="mt-1 text-[11px] text-rose-400">Partial auction failure — the market will not absorb more than 2.5% of GSDP this year, and every rupee sold carries a 1.5% premium.</div>}
            {borrowing > borrowCap && !auctionCap && <div className="mt-1 text-[11px] text-rose-400">Over the cap: expect a rating hit and slower growth.</div>}
            {/* The golden rule, on demand — the "why" behind the slider */}
            <button onClick={() => setShowGolden(!showGolden)} className="mt-2 text-[11px] text-emerald-300/90 underline hover:text-emerald-200">
              Why does the golden rule matter? {showGolden ? "(hide)" : "(show me)"}
            </button>
            {showGolden && (
              <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-relaxed text-slate-300">
                <p><span className="font-bold text-amber-900">Borrow only to build.</span> Keep borrowing within your capital spending and every borrowed rupee funds an asset that outlives the loan — the asset's returns pay the interest.</p>
                <p className="mt-1.5">Borrow for consumption — salaries, subsidies, guarantees — and the interest compounds forever. Karnataka's interest bill is already ₹41,000+ crore a year (14.2% of revenue), and in 2024-25 it exceeded principal repayment for the first time: the debt now costs more to carry than it retires.</p>
                <p className="mt-1.5 text-slate-400">The engine judges the rule on executed capex — budgeted money that never moves doesn't count. KFRA separately caps the year's deficit at 3% of GSDP.</p>
              </div>
            )}
          </div>

          {/* The revenue dials — twist before you spend. Each dial
              multiplies a real revenue head (benchmark = the actual
              RBI figure for this year); the delta flows straight into
              the pool, bypassing the committed share, and the engine
              bills each dial's side effect to the health/equity
              ledgers at reckoning. */}
          <div className="mt-4 paper-texture rounded-sm p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-medium text-slate-300">The revenue dials — twist before you spend</div>
              <div className={`text-xs font-semibold ${leverExtraNow > 500 ? "text-emerald-300" : leverExtraNow < -500 ? "text-rose-300" : "text-slate-400"}`}>
                {leverExtraNow > 500 ? `+${fmt(leverExtraNow)} to your pool` : leverExtraNow < -500 ? `−${fmt(-leverExtraNow)} from your pool` : "dials at neutral ×1.00"}
              </div>
            </div>
            <div className="mt-1 text-[11px] text-amber-800/60 font-serif">
              Extra money bypasses the committed share — it lands whole in your pool. But every dial has a price the engine will bill later: excise past ×1.15 mostly licenses the illicit trade and dents the health ledger; user-charge hikes are regressive; the mine's money lands in Kalyana Karnataka.
            </div>
            <div className="mt-3 space-y-3">
              {REV_LEVERS.map((l) => {
                const m = revMods[l.key];
                const benchVal = benchNow[l.key];
                const effVal = l.key === "sin" ? sinEffNow : m;
                const delta = (effVal - 1) * benchVal;
                return (
                  <div key={l.key} className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{l.emoji} {l.name}</div>
                        <div className="text-[11px] text-slate-400">{l.desc}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-serif font-bold text-amber-900">×{m.toFixed(2)}</div>
                        <div className="text-[10px] text-amber-800/60 font-serif">benchmark {fmt(benchVal)}</div>
                        <div className={`text-[10px] font-medium ${delta > 100 ? "text-emerald-400" : delta < -100 ? "text-rose-400" : "text-amber-800/60"}`}>
                          {delta > 0 ? "+" : delta < 0 ? "−" : ""}{fmt(Math.abs(delta))}
                        </div>
                      </div>
                    </div>
                    <Slider className="mt-2" value={[m]} onValueChange={(v: number[]) => setRevMod(l.key, v[0])} max={l.hi} min={l.lo} step={0.05} />
                    <div className="mt-1 flex justify-between text-[10px] text-amber-800/60 font-serif"><span>×{l.lo.toFixed(2)}</span><span>{l.note}</span><span>×{l.hi.toFixed(2)}</span></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* One row per bucket. Historical turns also show the
              government's real allocation for that sector, so the
              player drafts against the actual precedent. */}
          <div className="mt-4 space-y-3">
            {BUCKETS.map((b, i) => (
              <div key={b.key} className="paper-texture rounded-sm p-4 relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{b.emoji} {b.name} {b.kind === "revenue" && <span className="text-[10px] uppercase bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 rounded">consumption</span>}</div>
                    <div className="text-[11px] text-slate-400">{b.desc}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-amber-900">{fmt(allocs[i])}</div>
                    <div className="text-[10px] text-amber-800/60 font-serif">growth ×{b.mult}</div>
                  </div>
                </div>
                <Slider className="mt-2" value={[allocs[i]]} onValueChange={(v: number[]) => setBucket(i, v[0])} max={Math.max(5000, Math.round((pool) / 50) * 50)} min={0} step={50} />
                {cfg.era === "historical" ? (
                  <>
                    <CompareBar you={allocs[i]} govt={b.actual[turn]} max={Math.max(5000, pool, b.actual[turn])} />
                    <div className="mt-1 text-[10px] text-blue-700">The sky bar is the government's real allocation: {fmt(b.actual[turn])}</div>
                  </>
                ) : (
                  <div className="mt-1 text-[10px] text-amber-800/60 font-serif">No precedent exists — this year is unwritten.</div>
                )}
              </div>
            ))}
          </div>

          {/* Sticky footer: live remainder + presets. "Match the real
              government" is the learning device — play reality first,
              then diverge. Small remainders are auto-balanced on
              confirm, so ±rounding never blocks locking the budget. */}
          <div className="sticky bottom-4 mt-5 desk-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-amber-100 font-serif">Unallocated: </span>
                <span className={Math.abs(remaining) < 100 ? "text-emerald-300 font-semibold" : "text-amber-300 font-semibold"}>{fmt(remaining)}</span>
                <span className="text-amber-800/60 text-[11px]"> (small remainders auto-balance into your largest bucket)</span>
              </div>
              <div className="flex gap-2">
                {cfg.era === "historical" && <Button variant="file" onClick={matchGovt}>📜 Match the real government</Button>}
                <Button variant="file" onClick={() => setAllocs(BUCKETS.map((b) => Math.round(((pool / BUCKETS.length) * (b.kind === "revenue" ? 0.9 : 1)) / 50) * 50))}>Split evenly</Button>
                <Button variant="brass" onClick={confirm}>🔒 Lock the budget →</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </DeskScene>
    );
  }

  // -- Results ("The Reckoning"): the year's event, then the outcomes
  //    and HDI movement, then the Analyst's verdict — and, for
  //    historical turns, the reality-check against the government's
  //    actual budget.
  if (phase === "results" && last) {
    const isHistorical = last.era === "historical";
    return (
      <DeskScene><div className="min-h-screen text-amber-100 p-6">
        <div className="mx-auto max-w-4xl">
          {/* Reckoning as an official outcome document */}
          <div className="paper-texture rounded-sm p-5 mb-6 relative">
            <div className="paper-clip" />
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-900/20">
              <div className="text-[10px] uppercase tracking-[0.2em] text-red-800 font-serif font-bold">Budget Outcome — Official Record</div>
              <div className="file-number">FY {last.fy} / RECKONING</div>
            </div>
            <h1 className="text-2xl font-serif font-bold text-amber-900">FY {last.fy}: The Reckoning</h1>
            <div className="mt-2 text-sm text-red-800 font-serif font-bold">🎲 {last.event.title}</div>
            <p className="mt-2 text-sm text-amber-900 font-serif leading-relaxed">{last.event.body}</p>
            <div className="mt-4 pt-2 border-t border-amber-900/20 flex justify-between items-center">
              <span className="text-[10px] text-amber-900/50 font-serif uppercase tracking-wider">
                Finance Department • Government of Karnataka
              </span>
              <RubberStamp text={last.goldenRule ? "Golden Rule Held" : "Rule Broken"} type={last.goldenRule ? "approved" : "rejected"} size="md" />
            </div>
          </div>

          {/* The four headline outcomes of the year */}
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <Stat label="GSDP growth" value={pct(last.growth)} tone={last.growth >= 0.09 ? "good" : last.growth >= 0.075 ? "warn" : "bad"} sub={`GSDP → ${fmtShort(last.gsdp * (1 + last.growth))}`} />
            <Stat label="Capex executed" value={fmt(last.capexExecuted)} sub={`${pct(last.execRatio)} execution ratio`} />
            <Stat label="Debt / GSDP" value={pct(last.debtRatio)} tone={last.debtRatio > DEBT_CAP ? "bad" : "good"} sub={`${fmt(last.debt)} · rating ${last.rating}`} />
            <Stat label="Golden rule" value={last.goldenRule ? "HELD ✓" : "BROKEN ✗"} tone={last.goldenRule ? "good" : "bad"} sub={`FD ${pct(last.fdPct)} of GSDP`} />
          </div>

          {/* HDI sub-indices: this year's deltas come from the engine's
              per-bucket indexDeltas, aggregated by index. */}
          <div className="mt-4 paper-texture rounded-sm p-4 text-sm">
            <div className="font-serif font-bold text-amber-900">Human development engine</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {(["health", "education", "water", "equity"] as const).map((k) => {
                const d = Object.entries(last.indexDeltas).filter(([bk]) => BUCKETS.find((b) => b.key === bk)?.hdi === k).reduce((s, [, v]) => s + v, 0) + (k === "health" ? last.revDeltas.health : k === "equity" ? last.revDeltas.equity : 0);
                return <Stat key={k} label={k} value={last.indices[k].toFixed(1)} sub={`${d >= 0 ? "+" : ""}${d.toFixed(2)} this year`} tone={d > 0.05 ? "good" : d < -0.05 ? "bad" : undefined} />;
              })}
            </div>
          </div>

          {/* The Analyst's verdict: he speaks the engine's own factual
              notes (revenue beats/misses, rule verdicts, cap breaches,
              shock costs) in narrative voice. */}
          <div className="mt-4">
            <AnalystBox lines={analystReckoning(last)} tone={last.goldenRule ? "good" : "warn"} />
          </div>

          {/* Reality check (historical turns only): side-by-side with
              the actual budget, plus that year's documented outcomes. */}
          {isHistorical && (
            <div className="mt-6 paper-texture rounded-sm p-5 ring-2 ring-blue-800/20">
              <h2 className="font-serif font-bold text-blue-900">📜 Reality check — what the government actually did in {last.fy}</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-slate-400 border-b border-white/10"><th className="text-left py-1">Sector</th><th className="text-right">You</th><th className="text-right">Government</th></tr></thead>
                  <tbody>
                    {BUCKETS.map((b, i) => (
                      <tr key={b.key} className="border-b border-white/5">
                        <td className="py-1">{b.emoji} {b.name}</td>
                        <td className="text-right text-amber-900 font-serif">{fmt(last.allocs[i])}</td>
                        <td className="text-right text-blue-900 font-serif">{fmt(b.actual[turn])}</td>
                      </tr>
                    ))}
                    <tr><td className="py-1 font-medium">Borrowing</td><td className="text-right text-amber-900 font-serif font-bold">{fmt(last.borrowing)}</td><td className="text-right text-blue-900 font-serif font-bold">{fmt(cfg.actualFD)}</td></tr>
                  </tbody>
                </table>
              </div>
              <ul className="mt-3 text-xs text-slate-300 space-y-1">
                {cfg.actualNotes.map((n, i) => <li key={i}>• {n}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Button size="lg" variant="brass" onClick={nextTurn}>{turn === 4 ? "📊 See your Karnataka →" : "Next budget →"}</Button>
          </div>
        </div>
      </div>
      </DeskScene>
    );
  }

  // -- Final scorecard: the state you built vs the real trajectory.
  if (phase === "final") {
    // Aggregate the five resolved turns into the endgame score.
    const gAvg = results.reduce((s, r) => s + r.growth, 0) / results.length;
    const idxEnd = world.indices;
    const idxStart = { health: 62, education: 58, water: 60, equity: 54 }; // must mirror initialWorld()
    const hdiStart = (idxStart.health + idxStart.education + idxStart.water + idxStart.equity) / 4;
    const hdiEnd = (idxEnd.health + idxEnd.education + idxEnd.water + idxEnd.equity) / 4;
    const finalRatio = results[results.length - 1].debtRatio;
    const goldenBreaks = results.filter((r) => !r.goldenRule).length;
    /**
     * Composite score, in interpretable units:
     *  - growth: (avg growth − 8%) × 400 → each +1pp of sustained growth ≈ +4 pts
     *  - HDI: each index point gained ≈ +3 pts (and lost symmetrically)
     *  - debt: each pp above the 25.2% cap ≈ −8 pts
     *  - golden rule: each breach ≈ −1.5 pts
     * Grade bands: A > 6, B+ > 3, B > 0, C > −3, else D.
     */
    const score = (gAvg - 0.08) * 400 + (hdiEnd - hdiStart) * 3 - Math.max(0, finalRatio - DEBT_CAP) * 800 - goldenBreaks * 1.5;
    const grade = score > 6 ? "A" : score > 3 ? "B+" : score > 0 ? "B" : score > -3 ? "C" : "D";
    const gradeNote =
      grade === "A" ? "Odisha-grade stewardship: growth, human development and the debt cap, all at once." :
      grade === "B+" ? "A strong exchequer — with one soft spot you know about." :
      grade === "B" ? "A working state, but the debt clock or the social ledger is ticking." :
      grade === "C" ? "You ran Karnataka the way recent budgets have — rich, growing, and quietly eroding its buffers." :
      "The guarantee-era trajectory, intensified: high promises, thin margins, no room for the next shock.";
    // The Analyst's closing verdict, in DM voice, for the epilogue panel.
    const epilogue = analystEpilogue(grade, finalRatio, goldenBreaks, hdiEnd - hdiStart);

    // Chart data: the player's debt path vs the actual/trend baseline,
    // both measured against the 25.2% cap line.
    const chartData = TURNS.map((t, i) => {
      const r = results[i];
      const base = BASELINE[i];
      return { fy: t.fy.replace("20", ""), player: r ? +(r.debtRatio * 100).toFixed(1) : null, actual: base.ratio, cap: 25.2 };
    });

    // GSDP path in ₹ lakh cr for the growth chart.
    const gsdpData = results.map((r, i) => ({ fy: TURNS[i].fy.replace("20", ""), gsdp: +(r.gsdp / 100000).toFixed(2) }));

    return (
      <DeskScene><div className="min-h-screen text-amber-100 p-6">
        <div className="mx-auto max-w-4xl">
          {/* Final scorecard as an official report */}
          <div className="mb-6">
            <GovtMasthead subtitle="Final Report — Five Year Plan Outcomes" />
            <div className="paper-texture rounded-b-lg p-5 -mt-1">
              <h1 className="text-2xl font-serif font-bold text-amber-900">Your Karnataka, 2028</h1>
              <p className="mt-1 text-amber-800/70 font-serif italic">Five budgets played. Here's the state you built — against the one that actually happened.</p>
            </div>
          </div>

          {/* The verdict row: grade plus its four components */}
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            <Stat label="Grade" value={grade} sub={gradeNote.length > 60 ? gradeNote.slice(0, 60) + "…" : gradeNote} />
            <Stat label="Avg growth" value={pct(gAvg)} tone={gAvg >= 0.09 ? "good" : gAvg >= 0.08 ? "warn" : "bad"} sub="nominal GSDP" />
            <Stat label="HDI proxy" value={pct(hdiEnd)} tone={hdiEnd > hdiStart ? "good" : "bad"} sub={`from ${hdiStart.toFixed(1)}`} />
            <Stat label="Debt / GSDP" value={pct(finalRatio)} tone={finalRatio <= DEBT_CAP ? "good" : "bad"} sub="cap 25.2%" />
            <Stat label="Golden rule breaks" value={String(goldenBreaks) + "/5"} tone={goldenBreaks === 0 ? "good" : goldenBreaks <= 2 ? "warn" : "bad"} />
          </div>

          {/* The Analyst's closing verdict */}
          <div className="mt-6">
            <AnalystBox lines={epilogue} tone={grade === "A" || grade === "B+" ? "good" : grade === "B" ? "neutral" : "warn"} />
          </div>

          {/* Debt trajectory: the game's central chart. If your line
              stays under the red cap while the baseline crosses it,
              you've beaten the state's own trend projection. */}
          <div className="mt-6 paper-texture rounded-sm p-4">
            <div className="font-serif font-bold text-amber-900">Debt trajectory: you vs the real path</div>
            <div className="mt-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="fy" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} unit="%" domain={[20, 32]} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
                  <Legend />
                  <ReferenceLine y={25.2} stroke="#f43f5e" strokeDasharray="6 3" label={{ value: "16th FC cap 25.2%", fill: "#f43f5e", fontSize: 10 }} />
                  <Line type="monotone" dataKey="player" name="Your budgets" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="actual" name="Actual / trend baseline" stroke="#38bdf8" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-amber-800/60 font-serif mt-1">Baseline: actual deficits 2023-26 (CAG/RBI), then the ISEC trend projection — breaching the cap within this window is exactly what the state's own debt model shows.</div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Growth you banked */}
            <div className="paper-texture rounded-sm p-4">
              <div className="font-serif font-bold text-amber-900">GSDP path (₹ lakh cr)</div>
              <div className="mt-2 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={gsdpData} margin={{ top: 5, right: 10, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="fy" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} domain={[24, "auto"]} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="gsdp" name="GSDP" stroke="#34d399" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* HDI end state vs the opening position, with signed deltas */}
            <div className="paper-texture rounded-sm p-4">
              <div className="font-serif font-bold text-amber-900">Human development, end state</div>
              <div className="mt-3 space-y-3">
                {(["health", "education", "water", "equity"] as const).map((k) => (
                  <div key={k}>
                    <div className="flex justify-between text-xs"><span className="capitalize text-slate-300">{k}</span><span className="text-slate-400">{idxEnd[k].toFixed(1)} <span className={idxEnd[k] >= idxStart[k] ? "text-emerald-400" : "text-rose-400"}>({idxEnd[k] >= idxStart[k] ? "+" : ""}{(idxEnd[k] - idxStart[k]).toFixed(1)})</span></span></div>
                    <div className="mt-1 h-2 rounded-full bg-slate-700 overflow-hidden"><div className="h-2 rounded-full" style={{ width: `${idxEnd[k]}%`, background: idxEnd[k] >= idxStart[k] ? "#34d399" : "#fb7185" }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Epilogue: what the real 2026-27 did, to anchor the open
              years back to reality after the player's divergence. */}
          <div className="mt-6 paper-texture rounded-sm p-5 text-sm ring-2 ring-blue-800/20">
            <span className="font-serif font-bold text-blue-900">📜 Epilogue — what actually happened next:</span> in the real 2026-27, Karnataka's capex <span className="italic">slowed</span> as committed expenses ballooned and revenue took a hit — the lock-in continuing. If your 2026-27 and 2027-28 look better than that, ask yourself which real-world lever you pulled that the government hasn't: user charges, the golden rule, the sinking fund, the mineral windfall, or the power-reform borrowing window.
          </div>

          <div className="mt-8 flex justify-between">
            <Button variant="secondary" onClick={restart}>🔄 Play again — different dice, different choices</Button>
          </div>
          {/* Closing provenance note */}
          <div className="mt-6 text-[11px] text-amber-800/60 font-serif">
            Sources: RBI State Finances (Appendices I & IV, Karnataka; Statement 36 Subsidies), CAG State Finances Audit Report 2024-25, ISEC Evaluation of Finances of Karnataka (16th FC), RBI marksmanship assessments. Multipliers, the HDI engine, shock probabilities, the revenue dials' side effects, the consequence gauges' dynamics and the Pay Commission card's arrears/committed-bump parameters are the game's model layer, calibrated to the evidence base — not official projections.
          </div>
        </div>
      </div>
      </DeskScene>
    );
  }

  // Should never render: the phase machine always sets one of the above.
  return null;
}
