# Odometer (Car-Log)

Self-hosted car tracker for one household: fuel fill-ups, maintenance, insurance and registration.
Runs on the owner's unraid NAS. Goal: SaaS-quality polish without accounts or multi-tenancy.

## Current work

**Follow [`docs/PLAN.md`](docs/PLAN.md).** It holds the phased task list, the decisions (D1 to D17) and the
definition of done. [`docs/roadmap.html`](docs/roadmap.html) has the audit and wireframes behind it.
Before starting, find the next unchecked task group whose dependencies are merged.

## Stack and layout

- `app/`: React 19 + Vite 8 + Tailwind 3.4 + `react-router` 7 (library mode). Contexts in `src/context`, pages in
  `src/pages`, modals and shared pieces in `src/components`, pure logic in `src/lib`. Routes live in `App.jsx`
  (URL helpers in `lib/routes.js`); pages receive the route's `vehicle` as a prop.
- `server/`: Express 4 + `node:sqlite`. Routes in `routes/`, schema in `migrations/` (run by `migrate.js` from `db.js`),
  demo data in `seed.js`. `index.js` starts the server; `docker-entrypoint.js` is the container's start command.
- `design_handoff_car_tracker/README.md`: the original design spec (tokens, screens, behavior). Treat it as
  the source of truth for visual details unless PLAN.md says otherwise.

## Running

Requires Node 22.13+ (`node:sqlite` needs a flag before that).

```bash
cd server && npm install && npm run dev   # API on :3001
cd app && npm install && npm run dev      # Vite on :5173, proxies /api to :3001
```

`npm run dev` in `server/` sets `SEED_DEMO=1`, so an empty dev DB gets the two demo vehicles; `npm start` starts
empty. Data lives in `DATA_DIR` (default `server/data`). For a clean slate: stop the server,
`rm server/data/odometer.db`, and start it again. For production (Docker, unraid, backups, upgrades) see README.md.

## Conventions

- **Dates** are local `YYYY-MM-DD` strings. Never use `toISOString()` for dates or `new Date('YYYY-MM-DD')`;
  use `app/src/lib/dates.js` (added in P1-A).
- **Tailwind opacity modifiers** like `bg-ink/42` only work if the value is in `theme.opacity`
  (steps of 5 by default). Check `tailwind.config.js` before using a new one.
- **Design tokens** are CSS variables in `index.css`, read by `tailwind.config.js` (see [UI primitives](#ui-primitives)).
  Use `page`, `surface`, `ink`, `slate`, `accent`, `teal`, `amber`, `green`, `red`. Archivo for UI text, IBM Plex
  Mono for data and labels.
- **UI primitives** live in `app/src/components/ui`; see [UI primitives](#ui-primitives) below.
- **Icons** go in `app/src/components/icons.jsx` on the 24px, 2px-stroke grid.
- **Shared form pieces:** `components/FillUpForm.jsx` (fill-up fields, preview and save, used by the modal and the
  Fuel panel) and `components/FormActions.jsx` (save error line plus Save and Cancel for every form footer).
- **Schema changes are migrations** (D2 flipped at P2-F). Add `server/migrations/NNN_name.sql` with the next number
  and never edit one that has shipped. Each runs once, in its own transaction, with foreign keys off, and
  `foreign_key_check` must pass. Don't put `BEGIN`/`COMMIT` in a migration. If a new column belongs in backups,
  update `routes/backup.js` (it inserts every column explicitly) and extend `tests/backup.test.js`.
- **Server tests** run against `:memory:` with `SEED_DEMO=1`. Each test file runs in its own process, so a file can
  set `process.env` (e.g. `STATIC_DIR`) before importing `./helpers.js`.
- Keep `lib/` functions pure, documented with JSDoc, and covered by tests.
- Match the surrounding code style; no comments that restate the code.

## UI primitives

Build screens from `app/src/components/ui` (`import { Button, Field } from '../components/ui'`). To see every
primitive in every state, run the dev server and open http://localhost:5173/dev/ui (dev only; never in the build).

- `Button`: every text button. `primary` (slate) for the main action, `secondary` (accent tint) for a lighter one,
  `ghost` (hairline border) for Cancel and neutral actions, `danger` to confirm a delete, `dashed` for "add"
  tiles, and borderless `link` / `link-muted` / `link-danger` for row actions. `sm` / `md`, `loading` while saving,
  `tone="dark"` on slate panels.
- `IconButton`: icon-only buttons; `aria-label` is required. Its `danger` is the neutral-until-hover row delete.
- `Field`: label plus hint or error around one control; wires `id`, `aria-describedby` and `aria-invalid`.
- `Input`, `Textarea`, `Select`: text, multi-line and native select controls (`Select` has `size="sm"` and
  `tone="dark"` for dark cards). A width class such as `w-24` works on all of them.
- `NumberInput`: every numeric field (`type="text"`, `inputMode`, optional `unit`); the value stays a string.
- `Segmented`: pick one of a few (filters, ranges, $/gal vs total, Shop / DIY). `sm` sits in a label row, `md`
  is the filter track; `fullWidth`, `tone="dark"`.
- `Chip`: toggle chips for multi-select pickers (service categories and services), with an optional icon.
- `Switch`: on / off settings, with an optional label and description.
- `Badge`, `StatusChip`: small labels. `Badge` variants `tag` (tinted), `solid` (counts such as "4 DUE") and `pill`
  (deltas). `StatusChip` maps an interval `status` to green, amber or red.
- `Card`: any bordered surface; `padding` none / sm / md / lg; `tone` `dark` (slate panels), `muted` (sunken rows),
  `accent` (callouts) or `red` (warnings, overdue).
- `PageHeader`: eyebrow, title, optional subtitle and the page's primary action; every page starts with one.
- `EmptyState`: "nothing here yet" and "turned off" panels with one action.
- `StatTile`: one stat-rail number with unit, delta and `deltaTone` (good / bad / neutral news).
- `Modal`, `Drawer`: every dialog. Focus trap, Esc and backdrop close, focus return, sticky header and footer.
  Modal `sm` 440 / `md` 600 / `lg` 760px; Drawer slides in from the right at 400 / 480 / 640px.

**No one-off styling** of buttons, inputs, selects, toggles, cards or modals outside `components/ui`. If a
primitive doesn't fit, extend it with a variant or prop (and show it in `src/dev/UiGallery.jsx`). `className`
on a primitive is for layout only: width, flex, margins.

**Colors** are CSS variables holding RGB channels on `:root` in `app/src/index.css` (`--accent: 26 111 225`),
and Tailwind reads them as `rgb(var(--accent) / <alpha-value>)`. So every token takes an opacity modifier
(`bg-accent/12`), as long as the value is in `theme.opacity`. Don't put hex, `rgba()` or `oklch()` in class
names; use a token, or add one in both files. Radii: `rounded-control` 8px, `rounded-card` 10px,
`rounded-modal` 14px. Shadows: `shadow-button`, `shadow-dropdown`, `shadow-modal`, `shadow-drawer`, `shadow-knob`.

## Workflow

- One branch and one PR per task group, named as in PLAN.md (e.g. `fix/p1b-odometer`), targeting `main`.
- In the same PR: tick the task boxes in PLAN.md and add a Progress log line.
- Before opening a PR: `npm run lint`, `npm test` and `npm run build` in `app/`, `npm test` in `server/`,
  then verify the change in the running app.
