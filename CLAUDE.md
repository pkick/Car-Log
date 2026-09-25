# Odometer (Car-Log)

Self-hosted car tracker for one household: fuel fill-ups, maintenance, insurance and registration.
Runs on the owner's unraid NAS. Goal: SaaS-quality polish without accounts or multi-tenancy.

## Current work

**Follow [`docs/PLAN.md`](docs/PLAN.md).** It holds the phased task list, the decisions (D1 to D13) and the
definition of done. [`docs/roadmap.html`](docs/roadmap.html) has the audit and wireframes behind it.
Before starting, find the next unchecked task group whose dependencies are merged.

## Stack and layout

- `app/`: React 19 + Vite 8 + Tailwind 3.4. Contexts in `src/context`, pages in `src/pages`,
  modals and shared pieces in `src/components`, pure logic in `src/lib`.
- `server/`: Express 4 + Node's built-in `node:sqlite`. Routes in `routes/`, schema and seed in `db.js` / `seed.js`.
- `design_handoff_car_tracker/README.md`: the original design spec (tokens, screens, behavior). Treat it as
  the source of truth for visual details unless PLAN.md says otherwise.

## Running

Requires Node 22.5+.

```bash
cd server && npm install && npm run dev   # API on :3001
cd app && npm install && npm run dev      # Vite on :5173, proxies /api to :3001
```

Dev data is disposable until PLAN.md task P2-F lands: `rm server/data/odometer.db` and restart the server to
reseed. After P2-F, schema changes must be migrations.

## Conventions

- **Dates** are local `YYYY-MM-DD` strings. Never use `toISOString()` for dates or `new Date('YYYY-MM-DD')`;
  use `app/src/lib/dates.js` (added in P1-A).
- **Tailwind opacity modifiers** like `bg-ink/42` only work if the value is in `theme.opacity`
  (steps of 5 by default). Check `tailwind.config.js` before using a new one.
- **Design tokens** live in `tailwind.config.js` (and CSS variables in `index.css` after P2-A). Use `ink`,
  `slate`, `accent`, `teal`, `amber`, `green`, `red`, `page`. Archivo for UI text, IBM Plex Mono for data and labels.
- **UI primitives** (after P2-A) live in `app/src/components/ui`. Use them; don't restyle buttons, inputs or
  modals inline.
- **Icons** go in `app/src/components/icons.jsx` on the 24px, 2px-stroke grid.
- Keep `lib/` functions pure, documented with JSDoc, and covered by tests.
- Match the surrounding code style; no comments that restate the code.

## Workflow

- One branch and one PR per task group, named as in PLAN.md (e.g. `fix/p1b-odometer`), targeting `main`.
- In the same PR: tick the task boxes in PLAN.md and add a Progress log line.
- Before opening a PR: `npm run lint`, `npm test` and `npm run build` in `app/`, `npm test` in `server/`,
  then verify the change in the running app.
