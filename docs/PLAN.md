# Odometer polish plan

The working plan for taking Odometer from a working tracker to a polished, SaaS-quality self-hosted app.
The visual companion with wireframes is [`roadmap.html`](roadmap.html) (open it in a browser).

**How to use this file**

- Work happens in **task groups** (e.g. `P1-B`). Each group is one branch and one pull request.
- Tick a task's box in the same PR that completes it, and add a line to the [Progress log](#progress-log).
- Every group lists its acceptance checks. A group is done only when all of them pass and the
  [Definition of done](#definition-of-done) is met.
- Every phase is specified as task groups. Phase 4 was expanded from scoped epics on 2026-09-25.
- Decisions below are defaults. To change one, edit it here with the date and the reason.

---

## Decisions

| ID | Decision | Notes |
|----|----------|-------|
| D1 | **Personal, self-hosted, single household.** No sign-in, no multi-tenancy. | Keep all data access behind the REST API so accounts stay possible later. Decided 2026-09-24. |
| D2 | **Dev data is disposable until P2-F.** Schema changes may drop and reseed the DB (`rm server/data/odometer.db`). | From P2-F on, every schema change ships as a numbered migration. Decided 2026-09-24. |
| D3 | **One branch + PR per task group.** Branch names: `fix/p1b-odometer`, `feat/p2a-primitives`, etc. PRs target `main`. | Decided 2026-09-24. |
| D4 | **Stay on Tailwind 3.4.** Extend the opacity scale in P1-F; move color tokens to CSS variables in P2-A. | Tailwind 4 would fix opacity natively but is a large migration with no user-facing gain. Revisit after Phase 3. |
| D5 | **Tests:** Vitest for `app/src/lib` (pure logic, run with `TZ=America/Los_Angeles`); `node:test` for server routes against an in-memory DB. | No component-test framework until a bug justifies one. |
| D6 | **Routing:** `react-router` v7 in library mode (P2-C). URLs: `/v/:vehicleId/{overview,fuel,maintenance,documents,trends}`, `/garage`, `/settings`. | Active vehicle comes from the URL; localStorage only remembers the last one. |
| D7 | **JavaScript with JSDoc**, no TypeScript migration for now. | Add JSDoc types to every `lib/` export. |
| D8 | **Dates are `YYYY-MM-DD` strings in local time** end to end. Never pass them through `new Date(str)` or `toISOString()`; use `lib/dates.js`. | Fixes the off-by-one-day bugs. |
| D9 | **Odometer source of truth:** the server keeps `vehicles.odometer = MAX(purchaseOdometer, all fill-up odometers, all service odometers)`, recomputed on every write. | The client never sets it directly except when adding a vehicle. |
| D10 | **Intervals match on service names**, not categories. Each interval stores `services: string[]`. | A record resets an interval if any of its services is in that list. |
| D11 | **Charts are hand-rolled SVG components** (Sparkline, LineChart, BarChart, ProgressTrack). | Small bundle, full control, matches the design language. |
| D12 | **Command palette uses `cmdk`.** | Fall back to a hand-rolled list if it conflicts with React 19. |
| D13 | **Keep the custom icon set** in `components/icons.jsx`. Add new icons there on the same 24px, 2px-stroke grid. | |
| D14 | **Offline and install need HTTPS.** Service workers only register on `https://` or `localhost`, so P4-B's offline mode and install prompt work when the NAS is reached through a reverse proxy with a certificate (e.g. Nginx Proxy Manager, SWAG or Tailscale Serve). Plain `http://nas:3001` keeps working without them. | Decided 2026-09-25 while expanding Phase 4. |
| D15 | **Background jobs run inside the API process** (a timer aligned to local time), not a separate cron container. | One container stays the deploy unit. Decided 2026-09-25. |
| D16 | **Logic the server also needs lives in `shared/`** (plain ESM, no React), imported by `app/` and `server/` and copied into the image. Start with the due-soon math when P4-D needs it. | Decided 2026-09-25. |
| D17 | **Uploads are files under `DATA_DIR/receipts`**, never blobs in SQLite. Thumbnails are made in the browser (canvas) for JPEG, PNG and WebP; HEIC and PDF get a file tile. No native image libraries. | Keeps the image small and appdata backups simple. Decided 2026-09-25. |

---

## Definition of done

Applies to every task group.

- [ ] `npm run lint` passes in `app/`.
- [ ] `npm test` passes in `app/` and `server/` (once P1-A and P1-B add them).
- [ ] `npm run build` passes in `app/`.
- [ ] The change is verified in the running app (server on :3001, Vite on :5173) at desktop width, and at 390px once P4-A has landed.
- [ ] No new one-off styling once the P2-A primitives exist: use `components/ui`.
- [ ] Boxes ticked here and a Progress log line added in the same PR.
- [ ] PR description lists what changed, how it was verified, and any follow-ups.

---

## Phase 1 · Trust the numbers

Goal: every number the app shows is correct, every flow that looks usable works, and nothing
fails silently. No redesign yet.

### P1-A · Test harness and local dates
Branch `fix/p1a-dates`. Depends on nothing.

- [x] **P1-A1** Add Vitest to `app/` with a `test` script that runs under `TZ=America/Los_Angeles`.
      Add baseline tests that lock in `computeFillMpg` (partial fills accumulate, first full fill has no MPG).
- [x] **P1-A2** Create `app/src/lib/dates.js` with JSDoc and tests: `todayISO()`, `parseISODate(str)` (local
      midnight), `addMonths(iso, n)` (calendar months, clamps day 31), `daysBetween(a, b)`, `monthKey(iso)`,
      `isWithinDays(iso, n, today)`.
- [x] **P1-A3** Replace every `toISOString()` default and every `new Date('YYYY-MM-DD')` parse (14 call sites in
      11 files: `LogFillupModal`, `AddVehicleModal`, `LogServiceModal`, `LogPolicyModal`, `vehicleStats`,
      `exportCsv`, `Documents`, `Trends`, `FuelLog`, `Settings`, `Dashboard`). `grep -rn "new Date(" app/src` must
      only show `new Date()` for "now" inside `dates.js`.
- [x] **P1-A4** Replace `interval.months * 30` in `getDueSoonItems` with `addMonths` so due dates land on real
      calendar dates.

Acceptance
- Forms default to the local date at 11 pm Pacific (test covers it by mocking the clock).
- Trends' cost-per-mile caption shows `SEP 1` for a `2026-09-01` fill-up.
- A 12-month interval last done Jan 31 is due Jan 31 of the next year, not Jan 26.

### P1-B · Odometer integrity
Branch `fix/p1b-odometer`. Depends on P1-A.

- [x] **P1-B1** Make the server testable: `db.js` reads `DB_PATH` (default `server/data/odometer.db`, `:memory:`
      in tests); split `index.js` into `app.js` (exports the Express app) and `index.js` (listens). Add
      `node --test` as `npm test` in `server/`.
- [x] **P1-B2** Add `recomputeOdometer(vehicleId)` in the server, called after every fill-up and service
      insert, update and delete (D9). Responses for those routes include the updated `vehicle`.
- [x] **P1-B3** Validate fill-up odometers on POST and PATCH: the reading must be greater than the closest
      earlier fill-up (by date) and less than the closest later one. Return `422 { error, field: 'odometer' }`
      with a message that names the conflicting fill-up.
- [x] **P1-B4** Client: `RecordsContext` mutations merge the returned `vehicle` into `VehicleContext`, so the
      header and due-soon math update immediately.
- [x] **P1-B5** Fill-up and service forms stop prefilling the odometer. Show `Last: 84,210 on Aug 28` as the
      hint and render server validation errors inline under the field.
- [x] **P1-B6** Route tests: odometer recompute on add, edit and delete; rejection of lower and equal readings;
      backdated fill-up between two existing ones is accepted.
- [x] **P1-B7** Reset the dev DB (removes the 0 mpg fill-up #25).

Acceptance
- Logging a fill-up at 84,700 changes the header to 84,700 without a reload.
- A second fill-up at 84,600 is rejected with an inline message.
- Deleting the newest fill-up brings the odometer back down.
- Dashboard shows no 0 mpg bar; the average is ~31.4.

### P1-C · Service interval matching
Branch `fix/p1c-intervals`. Depends on P1-A.

- [x] **P1-C1** Add `services: string[]` to each interval (D10). Defaults: Oil + filter → `['Oil + filter change']`,
      Tire rotation → `['Tire rotation']`, Brake fluid → `['Brake fluid']`, Cabin air filter → `['Cabin air filter']`.
      Update `DEFAULT_INTERVALS` in both `server/seed.js` and `VehicleContext.jsx` (then remove the client copy;
      the server owns defaults and exposes them via `GET /api/defaults/intervals`).
- [x] **P1-C2** `getDueSoonItems` matches `record.services` against `interval.services`. Intervals with an
      empty list fall back to "any service in `interval.categoryId`".
- [x] **P1-C3** Add `progress` (0 to 1+, for bars) and `dueDate` / `dueOdometer` to each due item.
- [x] **P1-C4** Edit vehicle › Service intervals: editable name, a multi-select of which services satisfy the
      interval, and a delete button per row. "+ Add interval" starts with an empty service list and focuses the name.
- [x] **P1-C5** Record `categoryId` becomes derived: set it to the category of the first service on save and
      stop reading it for matching anywhere. Activity and history icons already derive categories from services.
- [x] **P1-C6** Tests: brake pads don't reset Brake fluid; a record with Brake pads + Tire rotation resets
      Tire rotation; Air filter doesn't reset Cabin air filter; empty-list fallback works.
- [x] **P1-C7** Reset and reseed the dev DB with the new interval shape.

Acceptance
- Logging "Brake pads" leaves Brake fluid's status unchanged.
- Logging one record with brakes and a tire rotation clears the Tire rotation overdue state.

### P1-D · Fuel logging and honest stats
Branch `fix/p1d-fuel-stats`. Depends on P1-B.

- [x] **P1-D1** Full / Partial toggle in `LogFillupModal` and the Fuel page panel. The MPG preview respects it
      and shows "Partial fills aren't averaged until the next full tank" when partial is selected.
- [x] **P1-D2** Tank-size warning in both forms (currently only the modal has it).
- [x] **P1-D3** `getFuelStats`: compare month-to-date spend with the same number of days last month. Return
      `null` delta when last month has no data; the tile then shows no delta instead of "−100%".
- [x] **P1-D4** Trends "price paid" card: plot price per fill-up over time for the last 12 fill-ups, colored
      relative to the vehicle's own average (±3%). Delete `getPricePaidBuckets` and the hard-coded $3.55 / $3.32.
- [x] **P1-D5** Trends footer stats: "Spend / month" becomes the average monthly fuel spend over the last
      6 months; "Gal / month" uses real gallons, not miles ÷ MPG.
- [x] **P1-D6** Trends "Looking ahead": list every interval from `getDueSoonItems` instead of hard-coded oil,
      tires and brakes.
- [x] **P1-D7** Tests for the new stat functions.

Acceptance
- On the 3rd of a month with one fill-up, the spend tile compares against the 1st to 3rd of last month.
- The price chart's bars are in date order and change color only relative to your average.

### P1-E · Safe writes and server validation
Branch `fix/p1e-safe-writes`. Depends on P1-B.

- [x] **P1-E1** Every modal awaits its mutation, disables Save while pending, stays open on failure and shows the
      server's message inline. No unhandled promise rejections.
- [x] **P1-E2** Server validation helper for all POST/PATCH routes: required fields, numeric types, positive
      amounts, valid `YYYY-MM-DD`. Return `400 { error, field }`.
- [x] **P1-E3** Turn on `PRAGMA foreign_keys = ON` and recreate tables with `ON DELETE CASCADE` for fill-ups,
      services and policy records (D2 allows the reset). Remove the manual deletes in `routes/vehicles.js`.
- [x] **P1-E4** Replace `alert()` in `AddVehicleModal` with inline field errors.
- [x] **P1-E5** Zero-vehicle safety: `Header`, `Sidebar` and pages render without a vehicle (temporary
      "Add your first vehicle" panel until P4-G builds the real first run). The server stops blocking deletion
      of the last vehicle.
- [x] **P1-E6** Route tests for validation errors and cascade delete.

Acceptance
- Stopping the server and saving a fill-up shows an error in the modal; restarting and saving again works.
- Deleting a vehicle removes its payments.
- Deleting the last vehicle leaves a usable app.

### P1-F · Visual bugs, placeholders and tracking toggles
Branch `fix/p1f-visual`. Depends on nothing (can run in parallel with P1-B to P1-E).

- [x] **P1-F1** Extend `theme.extend.opacity` in `tailwind.config.js` with every off-scale value in use:
      `2.5 3 4 4.5 6 8 9 12 14 16 18 24 42 52 62`. Add a comment explaining why. Verify the sidebar active
      state, modal backdrop and the Trends cost-per-mile `<select>` (make it dark with light text).
- [x] **P1-F2** Remove the hard-coded 70% bars from the dashboard stat tiles. Drive the "Coming up" bars from
      `progress` (P1-C3), colored by status.
- [x] **P1-F3** Replace the static "SAVED LOCALLY" badge with a connection indicator that pings `/api/health`
      every 30 s: "Connected" (green) or "Can't reach server" (red).
- [x] **P1-F4** Add Wipers subcategories: Front wiper blades, Rear wiper blade, Washer fluid.
- [x] **P1-F5** Hide placeholders until their feature exists: receipt drop zone (P4-C), Mobile nav item (P4-A),
      Reminders row (P4-D). Units and Currency render as read-only info, not controls. "Mark done" on due cards
      is removed until P3-D implements it; "Log now" stays.
- [x] **P1-F6** Honor `tracksFuel` / `tracksService` per the design handoff: hide Fuel and Trends (or
      Maintenance) nav items, header buttons, stat tiles and activity filters; redirect to Dashboard if the
      current page gets hidden; show the "Fuel tracking is off" panel on the dashboard.
- [x] **P1-F7** Small fixes: header odometer uses `toLocaleString()`; `index.html` title "Odometer"; the main
      scroll container resets to top on page change; replace the 🔧 emoji in Edit vehicle with `WrenchIcon`.

Acceptance
- The current page is highlighted in the sidebar; modals dim the page behind them.
- A vehicle with fuel tracking off shows no fuel UI anywhere.
- No control in the app does nothing when clicked.

---

## Phase 2 · Foundations

Goal: one consistent component system, feedback on every action, real URLs, and a build that is ready
to hold real data on the NAS.

### P2-A · Design tokens and UI primitives
Branch `feat/p2a-primitives`. Depends on Phase 1.

- [x] **P2-A1** Move colors to CSS variables in `index.css` as RGB channels and reference them from Tailwind
      (`ink: 'rgb(var(--ink) / <alpha-value>)'`), so any opacity works and dark mode (P2-G) is a token swap.
- [x] **P2-A2** Build `app/src/components/ui/`: `Button` (primary, secondary, ghost, danger; sm, md; `loading`),
      `IconButton` (requires `aria-label`), `Field` (label, hint, error), `Input`, `NumberInput` (unit suffix,
      tabular numerals, `inputMode="decimal"`), `Select`, `Segmented`, `Switch`, `Badge` / `StatusChip`, `Card`,
      `EmptyState`, `StatTile`, `Modal` and `Drawer` (shared base: Esc and backdrop close, focus trap, returns
      focus, sticky header and footer, sizes sm 440 / md 600 / lg 760, `aria-modal`).
- [x] **P2-A3** Dev-only gallery at `/dev/ui` showing every primitive in every state.
- [x] **P2-A4** Document the primitives and the rule "no one-off styles" in `CLAUDE.md`.

Acceptance
- Gallery renders all components; keyboard-only use of Modal and Drawer works (Tab cycles inside, Esc closes).

### P2-B · Migrate screens onto primitives
Branch `refactor/p2b-migrate-ui`. Depends on P2-A.

- [x] **P2-B1** Migrate all six modals. Modal widths collapse to the three sizes.
- [x] **P2-B2** Migrate all pages. Unify the segmented controls (Dashboard, Documents, Trends, fuel price mode,
      Shop/DIY, Insurance/Registration) onto `Segmented`.
- [x] **P2-B3** `PageHeader` component (eyebrow, title, primary action slot) on every page; Maintenance gets
      "Log service", Documents "Log payment", Fuel "Log fill-up", Garage "Add vehicle".
- [x] **P2-B4** Delete dead classes and duplicated form code (the Fuel page panel and the modal share one form
      component until P3-C replaces both).

Acceptance
- `grep -rn "rounded-lg text-sm focus:outline-none" app/src` returns nothing outside `components/ui`.

### P2-C · Routing
Branch `feat/p2c-routing`. Depends on P2-B.

- [x] **P2-C1** Add `react-router` with the URL scheme in D6. The sidebar uses `NavLink`.
- [x] **P2-C2** Active vehicle comes from the URL; switching vehicles keeps the current section.
- [x] **P2-C3** Scroll restoration per route, 404 page, redirect away from sections the vehicle doesn't track.
- [x] **P2-C4** Vite dev server and the production server both fall back to `index.html` for client routes.

Acceptance
- Refreshing `/v/2/trends` stays on The Truck's Trends; back and forward work.

### P2-D · Feedback: toasts, undo, loading
Branch `feat/p2d-feedback`. Depends on P2-A.

- [x] **P2-D1** `ToastProvider` with success, error and undo variants; max three stacked; bottom-right.
- [x] **P2-D2** Undo delete for fill-ups, services and payments: hide optimistically, send DELETE after 5 s,
      restore on Undo or on server error.
- [x] **P2-D3** Success toasts with a useful detail ("Fill-up saved · 32.2 mpg").
- [x] **P2-D4** Load vehicles and records in parallel (one bootstrap request or `Promise.all` across providers).
      Replace the full-screen "Loading…" with skeletons. Add a top-level error boundary with a retry button.

Acceptance
- Deleting then clicking Undo leaves the record intact on the server.
- Only one loading state appears on a cold load.

### P2-E · Formatting and accessibility
Branch `feat/p2e-format-a11y`. Depends on P2-B.

- [ ] **P2-E1** `app/src/lib/format.js` with tests: `formatDate` ("Sep 1, 2026"), `formatShortDate` ("Sep 1"),
      `formatRelative` ("3 days ago"), `formatMiles`, `formatMoney`, `formatMpg`, `formatPerMile`. Replace every
      raw ISO date and unformatted number in the UI.
- [ ] **P2-E2** Tabular numerals on all numeric columns; currency right-aligned.
- [ ] **P2-E3** Raise muted label contrast to at least 4.5:1 (ink ≥ 60% on white); visible `focus-visible`
      rings on every interactive element; `aria-label` on every icon-only button.
- [ ] **P2-E4** Keyboard shortcuts registry: `F` log fill-up, `S` log service, `?` shortcuts dialog,
      `G` then `D/F/M/T/G/S` to navigate. Ignored while typing in inputs.

Acceptance
- No `YYYY-MM-DD` string is visible anywhere in the UI.
- The whole log-fill-up flow can be done with the keyboard alone.

### P2-F · Ready for real data (deployment)
Branch `feat/p2f-deploy`. Depends on P1-E. **After this merges, D2 flips: no more DB resets.**

- [x] **P2-F1** `DATA_DIR` env (default `server/data`) for the DB and future uploads.
- [x] **P2-F2** Migration runner: `schema_migrations` table and numbered files in `server/migrations/`, run on
      start. Migration `001` is the full current schema. Remove the ad hoc `ALTER TABLE` in `db.js`.
- [x] **P2-F3** Seed only when `SEED_DEMO=1`; otherwise start empty (first-run panel from P1-E5).
- [x] **P2-F4** Full JSON export and import (all tables) in Settings, alongside the existing CSV export.
- [x] **P2-F5** Production serving: Express serves the built `app/dist` with SPA fallback.
- [x] **P2-F6** Multi-stage `Dockerfile`, `docker-compose.yml`, and an unraid template; `/data` volume; health check.
- [x] **P2-F7** Self-host fonts with `@fontsource/archivo` and `@fontsource/ibm-plex-mono`; remove the Google
      Fonts `@import`.
- [x] **P2-F8** README: deploy, backup and upgrade instructions.

Acceptance
- `docker compose up` on a clean machine serves the app on one port with an empty DB and no internet.
- Upgrading the image keeps existing data.

### P2-G · Dark mode
Branch `feat/p2g-dark-mode`. Depends on P2-A.

- [ ] **P2-G1** Dark token set (slate surfaces, brighter accent, adjusted status colors) that passes contrast.
- [ ] **P2-G2** Settings: Appearance (System / Light / Dark), stored in localStorage, applied before first paint
      in `index.html` (same approach as the text-size script).

Acceptance
- Every page and modal is legible in both themes; no hard-coded light-only colors remain.

---

## Phase 3 · Signature flows

Goal: the wireframed features in [`roadmap.html`](roadmap.html) sections 3A to 3D, plus a Trends rebuild.

### P3-A · Chart kit
Branch `feat/p3a-charts`. Depends on P2-A.

- [x] **P3-A1** `components/charts/`: `Sparkline`, `LineChart` (y-axis ticks from a nice-number scale, average line,
      hollow markers for partial fills, hover tooltip), `BarChart` (stacked option), `ProgressTrack` (last-done
      marker, due tick, "now" marker, overdue overflow). Colors from tokens only.
- [x] **P3-A2** Scale and tick helpers in `lib/chartScale.js` with tests.
- [x] **P3-A3** Add the chart kit to the `/dev/ui` gallery.

### P3-B · Dashboard 2.0
Branch `feat/p3b-dashboard`. Depends on P3-A, P2-C, P2-D. Wireframe: roadmap 3A.

- [ ] **P3-B1** Vehicle switcher moves to the top of the sidebar; header holds search trigger, connection status,
      Log service and Log fill-up.
- [ ] **P3-B2** Attention banner: the single most urgent item across overdue services and renewals, with its
      action and "Snooze 2 wks" (stored per item). Hidden when nothing is due.
- [ ] **P3-B3** Stat tiles with sparklines: Avg MPG (last 5 vs previous 5 full tanks), Cost per mile all-in for
      the selected range, Spent this month (vs same days last month, split fuel / service), Driving pace (mi/mo).
- [ ] **P3-B4** Range selector (90 days / 1 year / All time) drives the tiles and chart.
- [ ] **P3-B5** MPG line chart with average and partial markers.
- [ ] **P3-B6** Up next: top three intervals with `ProgressTrack`, status color and projected date.
- [ ] **P3-B7** Activity timeline grouped by month, including documents, with Edit and More on hover.

### P3-C · Smart fill-up drawer
Branch `feat/p3c-fillup-drawer`. Depends on P2-D, P2-E. Wireframe: roadmap 3B.

- [ ] **P3-C1** Schema: add `station TEXT` and `notes TEXT` to `fill_ups` (migration). `GET /api/stations?vehicleId=`
      returns recent distinct stations.
- [ ] **P3-C2** One `FillUpDrawer` opened from the header, the Fuel page, `F`, and ⌘K; also used for editing
      (row click on the Fuel table). Delete the old modal and the Fuel page side panel.
- [ ] **P3-C3** Odometer first with last-reading hint and live "+490 mi" delta.
- [ ] **P3-C4** Any two of gallons, price per gallon and total; the third is calculated and marked "auto".
      Pure function `solveFillUp()` with tests.
- [ ] **P3-C5** Full / Partial, date (defaults to today), station with suggestions.
- [ ] **P3-C6** Live validation: lower odometer (blocks), likely missed fill-up when the distance exceeds
      1.5 × tank size × average MPG (warns, offers "Add missed fill-up"), gallons over tank size (warns).
- [ ] **P3-C7** Result card: MPG vs your average, cost per mile this tank, estimated range.
- [ ] **P3-C8** Enter saves; "Save & add another" keeps the drawer open and clears the amounts.

### P3-D · Maintenance schedule
Branch `feat/p3d-maintenance`. Depends on P3-A, P1-C, P2-D. Wireframe: roadmap 3C.

- [x] **P3-D1** `lib/projections.js`: driving pace (mi/day over the last 6 months of readings) and
      `projectDueDate(interval, lastService, pace)`, with tests.
- [x] **P3-D2** Schedule rows with `ProgressTrack`, rule text, status chip, projected date.
- [x] **P3-D3** Status summary chips that filter the schedule.
- [x] **P3-D4** One-click "Mark done": creates a record with the interval's first service at the current odometer
      and today's date, then an undo toast.
- [x] **P3-D5** "Set last done" for intervals with no history: stores a baseline date and odometer on the
      interval, used until a real record exists.
- [x] **P3-D6** History with search (services, shop, parts, notes), category chips, and a yearly spend card by
      category.
- [x] **P3-D7** Log service modal rebuilt on primitives; keeps the category and subcategory chips.

### P3-E · Command palette
Branch `feat/p3e-command-palette`. Depends on P2-C, P2-E. Wireframe: roadmap 3D.

- [ ] **P3-E1** ⌘K / Ctrl+K palette with `cmdk` (D12): groups for Vehicles, Go to, Actions, Records.
- [ ] **P3-E2** Fuzzy search across navigation, actions, vehicles and all records (services, shops, notes, dates).
- [ ] **P3-E3** Each action shows its shortcut from the P2-E4 registry.

### P3-F · Trends rebuild
Branch `feat/p3f-trends`. Depends on P3-A, P1-D.

- [x] **P3-F1** MPG over time as a `LineChart` with the range control.
- [x] **P3-F2** Monthly spend as stacked bars for 12 months (fuel, service, insurance, registration).
- [x] **P3-F3** Cost per mile card keeps the window selector and caption, now all-in.
- [x] **P3-F4** Station insights: average price per station, cheapest station.
- [x] **P3-F5** Records card and Looking ahead card on the new components.

### P3-G · Garage and Documents polish
Branch `feat/p3g-garage-docs`. Depends on P2-B.

- [x] **P3-G1** Garage cards: tracking labels, due-count badge, whole card clickable (opens the vehicle's
      overview until P4-F adds a profile page).
- [x] **P3-G2** Documents: renewal cards with countdown and status, payment history on primitives, renewals feed
      the dashboard attention banner.

---

## Phase 4 · Reach

Goal: use it at the pump, keep documents with the records, get reminded, and bring history in from other apps.
Expanded from the original epics on 2026-09-25 (docs-only change, as this file requires).

### P4-A · Responsive layout
Branch `feat/p4a-responsive`. Depends on P3-B, P3-C, P3-D. Reference: handoff "Mobile set" M1 to M7, roadmap 4A.

- [ ] **P4-A1** Breakpoints in `tailwind.config.js`: `compact` 900px and `desktop` 1240px. The app shell switches
      between sidebar (≥1240), compact (900 to 1240: icon-only sidebar with tooltips) and phone (<900).
- [ ] **P4-A2** Compact layout: stat tiles 2-up, two-column cards stack, tables scroll inside their card, modals
      and drawers use the full width minus 16px gutters.
- [ ] **P4-A3** Phone shell: bottom tab bar HOME / FUEL / SERVICE / MORE with a 52px center + button that overlaps
      the bar and opens an action sheet (Log fill-up, Log service, Log payment). MORE opens Trends, Documents,
      Garage and Settings. The header shrinks to the vehicle pill. Respect safe-area insets.
- [ ] **P4-A4** Phone versions of Home (M1), Fuel log cards with ALL / FULL / PARTIAL chips (M3), Maintenance
      cards (M5), Trends (M6) and Garage (M7), as responsive variants of the existing pages, not separate ones.
- [ ] **P4-A5** Quick-add fill-up (M2): below 900px the `FillUpDrawer` becomes a full-screen sheet with oversized
      Gallons and Total paid, the decimal keypad, Full / Partial and the live MPG card. The odometer stays
      unprefilled (P1-B5 wins over the handoff) and shows the last reading and the live "+N mi" delta.
- [ ] **P4-A6** Log service on a phone is two steps (M4): category grid with count badges, then cost and notes.
- [ ] **P4-A7** Tap targets ≥ 44px; no horizontal page scroll at 390px; Playwright checks at 390, 1024 and 1400
      wide for every page. From here on the Definition of done includes the 390px check.

Acceptance
- Every page is usable at 390px with no horizontal scroll.
- Logging a full fill-up on a phone takes: +, Fill-up, three fields, Save.

### P4-B · PWA and offline
Branch `feat/p4b-pwa`. Depends on P4-A, P2-D. See D14.

- [ ] **P4-B1** `vite-plugin-pwa`: manifest (name, icons 192/512/maskable from the app mark, slate theme color,
      standalone), precached app shell, network-first runtime caching for `GET /api/*`.
- [ ] **P4-B2** Offline reads: the app opens offline with the last synced data and an "Offline · data from 9:41 AM"
      banner.
- [ ] **P4-B3** Server idempotency: records get `clientId TEXT UNIQUE` and `updatedAt` (migration). A POST that
      repeats a `clientId` returns the existing record instead of inserting a duplicate.
- [ ] **P4-B4** Outbox: writes made offline go to an IndexedDB outbox with client ids and show immediately with a
      "Waiting to sync" marker. Pure outbox logic (ordering, temp-id mapping, retries) lives in `lib/` with tests.
- [ ] **P4-B5** Sync on reconnect (online event plus the health ping): flush in order, last write wins. A write the
      server rejects (400/422) stays in the outbox with its message so it can be fixed or discarded.
- [ ] **P4-B6** Settings › Install: shows the install button when the browser offers it, iOS instructions
      otherwise, and the HTTPS note from D14 when the page isn't secure.

Acceptance
- With the server stopped, a fill-up logged on the phone shows as waiting; after the server is back it syncs once,
  with no duplicate.
- The app installs from Chrome over HTTPS.

### P4-C · Receipts and documents
Branch `feat/p4c-receipts`. Depends on P2-F, P3-D, P3-G. See D17.

- [ ] **P4-C1** Migration: `receipts` table (`id, recordType, recordId, storedName, filename, mimeType, size,
      thumbName, createdAt`). `recordType` is `service`, `policy` or `vehicle`.
- [ ] **P4-C2** API with `multer`: `POST /api/receipts` (10 MB limit; JPEG, PNG, WebP, HEIC, PDF), `GET
      /api/receipts/:id` and `/thumb`, `DELETE`. Files get random names under `DATA_DIR/receipts`.
- [ ] **P4-C3** Drop zone back in Log service and on Log payment: drag and drop, click, paste; upload progress;
      remove. The browser makes the thumbnail before upload.
- [ ] **P4-C4** Thumbnails on service history and payment rows; a viewer (Modal lg) with next / previous, PDFs
      embedded, and a download link.
- [ ] **P4-C5** Documents page: vehicle documents not tied to a payment (insurance card, registration).
- [ ] **P4-C6** Deleting a record, vehicle or receipt removes its files. JSON backup includes receipt metadata;
      README says files are covered by the appdata backup, not by the JSON export.
- [ ] **P4-C7** Route tests: type and size limits, cascade file removal, missing file handling.

Acceptance
- A photo attached to a service shows as a thumbnail in history and opens in the viewer.
- Deleting the record removes the file from disk.

### P4-D · Reminders
Branch `feat/p4d-reminders`. Depends on P2-F, P3-D, P3-G. See D15 and D16.

- [ ] **P4-D1** Move the due-soon and renewal math into `shared/` (D16) and import it from the app and the server.
- [ ] **P4-D2** Settings › Notifications: ntfy (server, topic, token), Pushover (user key, app token) and SMTP
      email (host, port, TLS, user, password, from, to). Stored server-side in a `settings` table (migration);
      secrets are write-only in the API. "Send test" per channel.
- [ ] **P4-D3** Daily check at a configured local time (default 8:00): one message per interval or renewal when it
      becomes due soon and again when it becomes overdue, deduplicated through a `notification_log` table.
- [ ] **P4-D4** Weekly digest on a configured day: what's coming up and this month's spend.
- [ ] **P4-D5** Default warn-at values (miles and days) in Settings, used for new intervals and for renewals
      (currently a fixed 30 days).
- [ ] **P4-D6** Tests: the pure "what to send today" function, dedupe, message text, and each channel against a
      local mock (ntfy and Pushover over HTTP, SMTP through `nodemailer`'s stream transport).

Acceptance
- With ntfy configured, an overdue interval sends exactly one notification per state change.
- "Send test" succeeds for every configured channel and shows the provider's error when it fails.

### P4-E · CSV import
Branch `feat/p4e-csv-import`. Depends on P2-F, P2-D.

- [ ] **P4-E1** Upload a CSV in Settings (and from first run, P4-G); parse in the browser with `papaparse`.
- [ ] **P4-E2** Mapping step: pick the target vehicle, map columns to date, odometer, gallons, price per gallon,
      total, full / partial, station and notes; preview the first 10 rows as they will be saved.
- [ ] **P4-E3** Presets that auto-map Fuelly and Drivvo exports and this app's own CSV export.
- [ ] **P4-E4** Row checks in `lib/` with tests: invalid rows with reasons, duplicates (same vehicle, date and
      odometer), and odometer order across existing plus imported fill-ups.
- [ ] **P4-E5** `POST /api/import/fill-ups`: one transaction, the same validation as single writes, returns
      per-row results; the odometer is recomputed once at the end.

Acceptance
- A Fuelly export imports with the same MPG Fuelly showed, and importing it twice adds nothing.

### P4-F · Vehicle profile and cost of ownership
Branch `feat/p4f-vehicle-profile`. Depends on P2-C, P3-A, P3-G, P4-C.

- [ ] **P4-F1** Route `/v/:vehicleId/profile`, opened from the Garage card and the vehicle switcher.
- [ ] **P4-F2** Specs, purchase details and a photo (stored as a `vehicle` receipt from P4-C), shown on the Garage
      card and in the switcher.
- [ ] **P4-F3** Optional purchase price (migration), shown with total spent since purchase.
- [ ] **P4-F4** `getCostOfOwnership()` in `lib/` with tests: fuel, service, insurance and registration by month,
      all-in cost per mile and per month for a range.
- [ ] **P4-F5** Profile shows the breakdown as stacked bars (P3-A) and the all-in cost per mile.

Acceptance
- All-in cost per mile includes insurance and registration and matches a hand calculation in the tests.

### P4-G · First-run onboarding
Branch `feat/p4g-first-run`. Depends on P2-B; the Import button appears once P4-E lands.

- [x] **P4-G1** Replace `FirstVehiclePanel` with the handoff first-run screen: car mark, title, one line of copy
      (about the NAS, not "this device"), Add vehicle and Import CSV, and a 3-step strip (Add the vehicle, Set
      intervals, Log a fill-up) that ticks off as each is done. The page header is hidden.
- [x] **P4-G2** Empty vehicle: stat rail with em-dashes and hints ("needs 2 fill-ups") and two invitation cards,
      "No fill-ups yet" and "No service history".
- [x] **P4-G3** Opt-in demo data: "Explore with demo data" calls `POST /api/demo` (empty DB only); a banner offers
      "Clear demo data" (`DELETE /api/demo`). Demo rows are flagged (migration).
- [x] **P4-G4** Route tests for the demo endpoints.

Acceptance
- A fresh install shows the first-run screen; demo data can be loaded and cleared, leaving an empty database.

### P4-H · VIN decode
Branch `feat/p4h-vin`. Depends on P2-B.

- [x] **P4-H1** VIN check in `lib/` with tests: 17 characters, no I, O or Q, valid check digit.
- [x] **P4-H2** `GET /api/vin/:vin` proxies NHTSA vPIC `DecodeVinValues` with a 5-second timeout and an in-memory
      cache.
- [x] **P4-H3** Add and Edit vehicle: "Decode" next to VIN fills year, make, model and trim (asks before
      overwriting typed values); failures show inline and the form keeps working.
- [x] **P4-H4** Route tests with a mocked fetch: success, unknown VIN, timeout.

Acceptance
- A valid VIN fills the fields; with no internet the form still saves.

### P4-I · Year in review
Branch `feat/p4i-year-review`. Depends on P3-A, P4-F.

- [ ] **P4-I1** `getYearInReview()` in `lib/` with tests: miles, fuel cost and gallons, best and worst tank,
      service spend by category, insurance and registration, all-in cost per mile, most-used station.
- [ ] **P4-I2** Page `/v/:vehicleId/year/:year` plus an all-vehicles view, built from the chart kit.
- [ ] **P4-I3** Export as PDF through a print stylesheet and the browser's print dialog (no PDF library).

Acceptance
- Last year's totals match hand totals in the tests; printing gives a clean one- or two-page PDF.

Backlog (not scheduled): units and currency settings (L/100 km, km, liters), household accounts (see D1).

---

## Progress log

Newest first. One line per merged PR: date, group, PR link, one-sentence summary.

- 2026-09-25 · P1-C · Intervals list the services that reset them (D10); the server owns the defaults (`GET /api/defaults/intervals`); due items carry `progress`, `dueDate` and `dueOdometer`, labels follow whichever limit is closer, and the Coming up bars use `progress` (finishes P1-F2). Needs a dev DB reset.
- 2026-09-26 · P3-D · Maintenance schedule: progress tracks, status filter chips, projected due dates from the driving pace (`lib/projections.js`), one-click Mark done with Undo, Set last done baselines for intervals with no history, searchable history with category chips and a yearly spend card; Log service shows the next milestone.
- 2026-09-26 · P4-G · First-run screen (no header, 3-step strip that keeps guiding on the Dashboard until set up), empty-vehicle Dashboard with em-dash tiles and invitation cards, and opt-in demo data (`POST`/`DELETE /api/demo`, migration `002_demo_flag`, a Clear demo data banner). The Import CSV button joins the first-run screen with P4-E.
- 2026-09-26 · P2-D · Toasts (success, error, undo; max three, bottom-right, announced); deleting a fill-up, service or payment hides it with a 5-second Undo before the DELETE is sent (flushed on page close); success toasts carry a detail such as the MPG; vehicles and records load together behind one skeleton, with an error boundary and Retry.
- 2026-09-26 · P3-G · Garage cards show tracking badges and a due count, open the vehicle on click (stretched `CardLink`) and the Add vehicle tile is a real button; Documents has renewal cards with countdowns, status and the last payment, from a tested `lib/renewals.js` that P3-B's attention banner will use.
- 2026-09-26 · P2-C · `react-router` v7 in library mode: `/v/:vehicleId/{overview,fuel,maintenance,documents,trends}`, `/garage`, `/settings`, a 404 page; the active vehicle comes from the URL, switching vehicles keeps the section, untracked sections redirect, and back/forward restore scroll. Deep links work in dev and from the production server.
- 2026-09-26 · P3-F · Trends rebuilt on the chart kit: MPG per tank (hollow when partial fills went in), 12 months of stacked spend (fuel, service, insurance, registration), all-in cost per mile, station insights (empty until P3-C adds stations), price per gallon, records, and Looking ahead with progress tracks.
- 2026-09-26 · P4-H · VIN check digit in `lib/vin.js`; `GET /api/vin/:vin` proxies NHTSA vPIC (5 s timeout, cache, 502 with a clear message when unreachable); Add and Edit vehicle have a Decode button that fills blanks and asks before replacing typed values.
- 2026-09-26 · P2-B · Every modal and page is built from `components/ui` (modals collapse to sm / md / lg), all segmented controls use `Segmented`, `PageHeader` with the primary action on every page, one `FillUpForm` shared by the modal and the Fuel panel, and no arbitrary `oklch()` classes outside Settings (migrated with P2-G). New primitives: `Chip`, `PageHeader`; new variants on Button, Badge, Card and Select.
- 2026-09-26 · P3-A · `components/charts`: Sparkline, LineChart (nice-number axis, average line, hollow partial fills, hover and keyboard tooltip), BarChart (grouped or stacked), ProgressTrack (due tick, now marker, overdue overflow); `lib/chartScale.js` with 41 tests; charts in the `/dev/ui` gallery.
- 2026-09-26 · P2-F · `DATA_DIR`, numbered SQL migrations (`001_initial`), demo data only with `SEED_DEMO=1`, JSON backup and restore in Settings, Express serves the built app with SPA fallback, Dockerfile / compose / unraid template (verified: build, health check, data survives a rebuild, works with no internet), self-hosted fonts. **D2 has flipped: schema changes are migrations from here on.**
- 2026-09-26 · P2-A · Color tokens are CSS variables (RGB channels, so any scale opacity works on every color); `components/ui` has Button, IconButton, Field, Input, Textarea, Select, NumberInput, Segmented, Switch, Badge, StatusChip, Card, EmptyState, StatTile, Modal and Drawer; gallery at `/dev/ui` (dev only).
- 2026-09-25 · Plan · Expanded the Phase 4 epics into task groups P4-A to P4-I (47 tasks) and added decisions D14 to D17.
- 2026-09-25 · P1-E · `400 { error, field }` validation on every write, `ON DELETE CASCADE` for records (startup warns about an old DB); every form awaits its save and shows the server's message inline ("Can't reach the server" when it's down); no `alert()`; the last vehicle can be deleted and the app shows an "Add your first vehicle" panel. **Phase 1 complete.**
- 2026-09-25 · P1-D · Full / Partial toggle, tank warning in both forms, month-to-date spend vs the same days last month, a 12-fill price chart around the vehicle's own average, real 6-month spend and gallon averages, and Looking ahead for every interval.
- 2026-09-25 · P1-F · Opacity scale extended, connection indicator, Wipers subcategories, placeholders hidden, `tracksFuel` / `tracksService` honored (including Garage cards), title, scroll reset and wrench icon. P1-F2 is half done: the fake 70% tile bars are gone; the Coming up bars wait for `progress` from P1-C3.
- 2026-09-25 · P1-B · Server owns the odometer (recomputed on every write, D9) and rejects out-of-order fill-up readings with an inline 422; route tests via `node --test`. Fill-ups sharing a date are ordered by entry, so a new one must be the day's highest reading. Existing dev DBs still need `rm server/data/odometer.db` once (P1-B7).
- 2026-09-25 · P1-A · Vitest harness and `lib/dates.js`; every date default, parse, sort and interval calculation now uses local `YYYY-MM-DD` strings.
- 2026-09-24 · Plan · Added this plan, `roadmap.html` and `CLAUDE.md`.
