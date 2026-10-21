# Five Budgets: Karnataka — A Fiscal Simulator

A 5-turn fiscal role-playing game for the state of Karnataka, built on real
RBI / CAG / budget data. You play the Finance Minister across FY 2023-24 to
2027-28: three historical turns replayed against the actual budgets (RBI Study
of Budgets, CAG audits), two open future turns with weighted random shocks.
Dr Sid Kotian, your Chief Economic Advisor, reads each year aloud and comments
on your drafts — advisory only, ignorable always.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## What's in the box

- `src/App.tsx` — the entire game (engine, narrative layer, UI) in one
  self-contained component, ~1,740 lines, commented section by section.
- `src/components/ui/{button,badge,slider}.tsx` — minimal shadcn-style
  primitives so the project has no UI-kit dependency. Swap them for real
  shadcn/ui components (`npx shadcn@latest init && npx shadcn@latest add
  button badge slider`) if you want the full library.
- `vite.config.ts` / `tsconfig.json` — Vite 5 + React + Tailwind CSS v4,
  with the `@/` path alias the game's imports rely on.
- Only runtime dependencies: `react`, `react-dom`, `recharts`.

## Data provenance (the realism contract)

- Turns 1–3 = FY2023-24 (Actual), 2024-25 (RE), 2025-26 (BE). Revenue,
  committed shares, sector allocations, subsidies and deficits are real
  figures from RBI State Finances — A Study of Budgets (2024-25 and
  2025-26 editions; Karnataka Appendices I & IV, Statement 36) and CAG
  State Finances Audit 2024-25. The government's actual budget is always
  shown so you can compare.
- Turns 4–5 = 2026-27, 2027-28: revenue realization, capex execution and
  shocks are randomized. GSDP/debt levels are calibrated so that playing
  the historical turns like the real government reproduces CAG actuals
  (₹28.84 lakh cr GSDP, ₹6.92 lakh cr liabilities, 2024-25).
- Model layer (labelled as such in-game): growth multipliers, execution
  ratios, HDI movement, shock probabilities, revenue-dial side effects,
  the three consequence gauges (bond-market patience, urban momentum,
  guarantee ratchet), and the Pay Commission card's arrears/committed-bump
  parameters. These are calibrated assumptions, not official forecasts.

## Engine map (see the header comment in App.tsx)

1. Formatting helpers · 2. Allocation buckets (8 levers, real actuals) ·
2b. Revenue decomposition (RBI Appendix I) + three revenue dials (excise,
mining, user charges) · 3. Events (historical + weighted future deck) ·
4. Per-turn config · 5. `resolveTurn()` — the pure fiscal engine, including
the consequence-gauge step · 6. The Analyst (Dr Sid Kotian) narrative layer ·
7. Screens: intro → briefing → drafting table → reckoning → final scorecard.

The engine is deliberately pure: one turn's outcome depends only on its
inputs, so a whole game is reproducible from its inputs.
