# Handoff: Odometer — Car Maintenance & Fuel Mileage Tracker

## Overview
A self-hosted, local-first web app for tracking fuel fill-ups and maintenance across multiple vehicles.
It answers four questions: what's my MPG trend, what does this car cost per mile, what maintenance is
coming due, and what has already been done. Desktop is the primary form factor; a companion mobile
layout exists for logging fill-ups at the pump.

Target deployment: self-hosted on the user's **unraid NAS**, with a data folder bind-mounted for persistence.
Target stack: **React + Vite**.

## About the Design Files
The files in this bundle are **design references authored in HTML** — prototypes that show intended
layout, styling, and behavior. They are **not production code to copy**. The task is to recreate these
designs in a React + Vite app using idiomatic components, hooks, and whatever styling approach the
project settles on (CSS modules / Tailwind / vanilla-extract are all fine). The prototype uses inline
styles purely because of the tool it was authored in — do not carry that pattern into the real codebase.

The prototype is a single streaming component file (`Tracker UI - Precision.dc.html`). Open it in a
browser to click through: the left nav switches screens, the vehicle dropdown switches cars, modals open,
selects and multi-selects are live.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and interaction states are final and should be
matched closely. The one exception is icons — see **Assets**.

A separate low-fidelity file (`Wireframes.dc.html`) documents the layout exploration that led here;
it is background context only, not a spec.

---

## Screens / Views

Navigation is a fixed 236px dark sidebar (always visible) plus a page header. Seven destinations:
Dashboard, Fuel log, Maintenance, Trends, Garage, Mobile (design reference only — not a real route),
Settings.

### 1. Dashboard
**Purpose:** one-page overview of the active vehicle.
**Layout:** vertical stack, 22px gaps, inside a max-width 1180px main column with 34px 40px 56px padding.
1. **Stat rail** — CSS grid, `repeat(4, 1fr)`, 14px gap. Each card: white, 1px `rgba(18,18,18,.1)` border,
   10px radius, 18px padding, column flex with 12px gap. Contents: uppercase 9px mono label (letter-spacing
   .13em, `rgba(18,18,18,.45)`), delta chip right-aligned (10px mono, green `oklch(.5 .14 150)` for good,
   red `oklch(.55 .17 28)` for bad), 34px Archivo 600 value with a small mono unit, then a 3px progress
   hairline (`rgba(18,18,18,.09)` track, blue `oklch(.56 .19 258)` fill).
   - Fuel-tracked vehicle: Avg MPG 31.4 (+2.1%), Cost / mile $0.14 (−4.0%), Fuel spend $132 (+8.2%), Services 3 due (1 overdue).
   - Maintenance-only vehicle: Services due 3, Last service Aug 12, Service spend $514, Since oil 3.1k mi.
2. **Chart + reminders row** — grid `1.5fr 1fr`, 22px gap, stretch aligned.
   - *Fuel economy* (white card, 22px 24px 18px padding): title "Fuel economy" (Archivo 600 22px, -.03em),
     right-aligned "LAST 10 FILLS", then 46px value 31.4 + "mpg avg" + green pill "+2.1% vs last 10"
     (`rgba(45,120,80,.1)` background). Bar chart: flex row, 7px gap, min-height 150px, bars `flex:1`
     with 6px 6px 3px 3px radius, blue except the newest which is slate `#1b1e24`; value label above
     (9px mono) and fill index below (8px mono). Footer button "All trends" (full width, 1px border, 12px radius).
     If the vehicle does not track fuel, this card is replaced by a dashed-border panel: pump icon,
     "Fuel tracking is off for {nickname}", explanatory line, and a dark "Enable fuel tracking" button.
   - *Coming up* (dark `#1b1e24`, `#f1f1ef` text, 10px radius, 22px 24px): title + blue "3 DUE" chip.
     Each item: 28px icon tile (`rgba(241,241,239,.1)`, 9px radius), name (Archivo 500 14px, nowrap),
     right-aligned remaining distance in the item's status color, 4px progress bar, 10px mono detail line
     ("Due at 84,630 mi · every 5,000 mi"). Footer "Log service" outline button pinned to the bottom.
3. **Recent activity** — full-width white card, header with title + segmented filter (All / Fuel / Service;
   3px padding pill group, `rgba(18,18,18,.06)` background, active segment slate with light text).
   Table header row and body rows share
   `grid-template-columns: 44px minmax(190px,1.5fr) minmax(210px,1.6fr) minmax(86px,.7fr) minmax(78px,.6fr)`,
   14px gap, 24px horizontal padding. Body scrolls inside `max-height:296px`. Each row: 32px icon tile
   tinted by kind, title + kind label (FUEL / SERVICE), mono detail string, date, right-aligned cost.
   Row hover `rgba(18,18,18,.03)`.

### 2. Fuel log
**Purpose:** full fill-up history plus add/edit.
**Layout:** grid `1fr 320px`, 22px gap.
- **Table** (white card, `min-width:560px`, overflow hidden). Columns:
  `minmax(112px,1.1fr) minmax(78px,.8fr) minmax(64px,.8fr) minmax(64px,.8fr) minmax(72px,.9fr) minmax(56px,.7fr) minmax(96px,.8fr)`
  = Date, Odometer, Gallons, $/gal, Total, MPG (+ FULL/PARTIAL tag beneath), Actions (EDIT / DEL buttons,
  6px 9px, 7px radius, 9px mono). Header row has `rgba(18,18,18,.025)` background. Partial fills render
  MPG in `rgba(18,18,18,.45)` with an amber PARTIAL tag; full fills use ink (green when ≥32 mpg).
- **Side panel** — "New fill-up" / "Edit fill-up". Fields: Vehicle (disclosure row), Date + Odometer
  (2-col), Gallons + $/gal (2-col), Full tank / Partial toggle pair, validation callout (see Interactions),
  dark "Calculated" card showing live MPG (large, `oklch(.76 .14 258)`) and total cost, primary
  "Save fill-up" / "Save changes" button. In edit mode, a Cancel + "Delete entry" row appears
  (delete styled with red border/text, no fill).

### 3. Maintenance
**Purpose:** what's due, and everything already done.
- **Due cards** — grid `repeat(3,1fr)`, 14px gap. Each: 34px icon tile, name, status chip
  (overdue = `rgba(200,60,30,.12)` bg / red text; otherwise neutral), 4px progress bar in the status color,
  mono detail line, then two buttons: "Mark done" (outline) and "Log now" (blue tint
  `rgba(47,107,216,.1)`, text `oklch(.48 .19 258)`).
- **Service history** — white card. Header with title + dark "+ Add service" button. Rows:
  `34px 1fr 130px 110px 90px 104px` = icon, name + shop/DIY, date, odometer, cost, EDIT/DEL actions,
  separated by 1px `rgba(18,18,18,.08)` top borders.

### 4. Trends
**Purpose:** the analysis layer.
1. **Fuel economy over time** — white card, 24px padding. Header + range segmented control (12 fills / 6 mo / 1 yr).
   230px-tall bar chart, 9px gaps, value label above each bar, bottom axis labels below a 1px baseline.
   Record-best bar is slate; the rest blue.
2. **Three-card row** (`1fr 1fr 1fr`, 22px):
   - *Cost per mile* (dark card): title + **rolling-window `<select>`** (Rolling 90 days / 6 months / 1 year /
     All time, transparent with `rgba(241,241,239,.24)` border). 42px value, delta, then a mono caption naming
     the exact window and mileage, e.g. "ROLLING 90 DAYS · JUN 1 – AUG 30, 2026 · 3,090 MI". Values by window:
     $0.14/−4.0%, $0.15/−1.8%, $0.16/+2.4%, $0.17/+6.1%. Below: Fuel vs Maintenance split bars (78% / 22%).
   - *Records* — Best fill 36.2 mpg, Worst fill 24.8 mpg, Cheapest gal $3.29, Total logged 46,880 mi.
   - *Monthly spend* — stacked bars per month (blue = fuel on top, teal = service below), 130px tall, with a legend.
3. **Second row** (`1.25fr 1fr`, 22px):
   - *Price paid per gallon* — "LAST 12 FILL-UPS", $3.46 avg with "low $3.29 · high $3.61", 96px bar chart
     colored by band (red ≥$3.55, green ≤$3.32, blue otherwise), and three footer stats
     (Spend / month $132, Gal / month 38.2, Cheapest stop Costco · 3rd St).
   - *Looking ahead* — four projection rows (icon tile, title, mono explanation, right-aligned value):
     Next oil change "in ~2 wks" (amber), Next tire rotation "in ~7 wks" (teal), Brake fluid "overdue" (red),
     Fuel cost next 90 days "~$396" (blue). Footer tinted block: "Driving rate — 1,030 mi/mo over the last
     6 months · 12,360 mi/yr projected · 27 fill-ups/yr at this rate".

### 5. Garage
Grid `1fr 1fr`, 22px. Each vehicle card: 180px striped placeholder photo area
(`repeating-linear-gradient(135deg, rgba(18,18,18,.055) 0 9px, rgba(18,18,18,.02) 9px 18px)`),
then 26px Archivo nickname, status badge, mono sub-line (VIN · plate · miles), three mini stat tiles
(Avg MPG, $ / mi, Fills), and "Set active" + "Edit vehicle" buttons. A dashed "Add vehicle" tile
closes the grid and opens the vehicle modal.

### 6. Settings
Single 640px column of rows: label + hint on the left, value pill on the right.
Units (MPG · gal · mi), Currency (USD $), Reminders (default warn-at, overridable per interval),
Storage (This device), Fill-up defaults (Full tank; partials tagged, not averaged), Export (Export CSV).

### 7. Mobile set (design reference)
Seven 352px frames inside 9px `#1b1e24` bezels, 40px radius, each with a 32px status bar and a bottom
tab bar (HOME / FUEL / SERVICE / MORE) plus a 52px blue floating "+" that overlaps the bar by 26px.
- **M1 Home** — vehicle pill, two stat cards, dark "Coming up" card, recent list.
- **M2 Quick-add fill-up** — two oversized fields (Gallons, Total paid), prefilled editable odometer
  ("prefilled from last + 820 mi"), Full/Partial pair, live blue MPG preview card, full-width Save,
  caption "Saved on this device · syncs to your NAS when home". No FAB on this screen.
- **M3 Fuel log** — filter chips (ALL / FULL / PARTIAL) and one card per fill-up with MPG, tag, and total.
- **M4 Log service (step 1)** — 2-column category grid with icons and count badges, then subcategory chips,
  then "Next — cost & notes".
- **M5 Maintenance** — one card per due item with progress, detail, and MARK DONE / LOG NOW.
- **M6 Trends** — MPG sparkline (own 76px scale), dark cost-per-mile card with window selector, projections list.
- **M7 Garage** — vehicle cards with tracking labels and SET ACTIVE / EDIT, plus dashed Add vehicle.

All tap targets are ≥44px.

### Modals
Centered overlay: `rgba(18,18,18,.42)` scrim, 56px 20px padding, scrollable; card 604px wide, 14px radius,
`0 40px 90px -30px rgba(18,18,18,.6)` shadow, `#f1f1ef` body, dark 20px 24px title bar with a 28px × close button.

**Log service**
- Category chips (Oil, Brakes, Tires, Filters, Fluids, Electrical, Drivetrain, Suspension, Other) — each with
  its icon and a count badge when that category has selections; active chip is slate-filled.
- Subcategory panel (tinted `rgba(18,18,18,.035)`, 1px border): label "{Category} — pick what was done" plus
  multi-select chips.
- Selected chips summary (blue tint, "×" to remove).
- Date / Odometer / Cost (3-col), Performed by (Shop / DIY) + Shop name, Parts used, Notes textarea,
  receipt drop zone (dashed, striped background, "Stored on this device · JPG, PNG, HEIC").
- "Next due" callout: blue tint, next milestone plus the interval rule it came from.
- Footer: "Save service" (disabled styling when invalid) + Cancel.

**Edit vehicle**
- Nickname + Year (2-col); Make / Model / Trim (3-col); VIN + Plate; Purchase date + Odometer at purchase;
  Registration renewal + Insurance renewal.
- **What to track on this vehicle** — two switch rows (Fuel & mileage, Maintenance). 38px × 22px pill switch,
  blue when on, 16px white knob with a soft shadow.
- **Service intervals** table — columns Item / Track by / Miles / Months / Warn at at
  `1.25fr .78fr .8fr .78fr .9fr`. "Track by" is a select (Miles / Time / Both). Miles select options:
  2,500 / 3,000 / 5,000 / 7,500 / 10,000 / 15,000 / 20,000 / 30,000 / 60,000. Months: 3 / 6 / 12 / 24 / 36 / 48.
  Warn at: 250 mi / 7 d · 500 mi / 14 d · 750 mi / 21 d · 1,000 mi / 30 d · 2,000 mi / 60 d.
  Selecting "Miles" greys the Months select; "Time" greys Miles (disabled styling:
  `rgba(18,18,18,.04)` background, `rgba(18,18,18,.35)` text, `cursor:not-allowed`).
  "+ Add interval" below.
- Footer: "Save vehicle" + Cancel.

### Empty & first-run states
- **First run** (no vehicles): centered column, large car mark, "Add your first vehicle", explanatory line
  ("Everything is stored locally on this device. Log two fill-ups and mileage trends start appearing."),
  Add vehicle + Import CSV buttons, and a 3-step strip (Add the vehicle / Set intervals / Log a fill-up).
  The page header is hidden in this state.
- **Empty** (vehicle exists, no logs): stat rail shows em-dashes with hints ("needs 2 fill-ups"), then two
  invitation cards — "No fill-ups yet" (primary CTA) and "No service history" (secondary CTA).

---

## Interactions & Behavior

**Navigation** — sidebar sets the active screen; active item gets `rgba(241,241,239,.16)` background,
light text, and a blue dot. Inactive items `rgba(241,241,239,.62)`, hover `rgba(239,236,230,.14)`.

**Vehicle switcher** (top-left of header) — button shows car mark, nickname, and "{year make model} · {odo} mi".
Click opens a 328px dropdown 9px below it (`0 22px 48px -18px rgba(18,18,18,.34)` shadow, 18px radius): a
"Your garage" label, one card per vehicle (car mark left; nickname, year/make/model, mileage, and tracking
labels right-aligned), and a dashed "Add vehicle" row. Active card gets a near-black border and tinted
background. Selecting a car closes the menu and re-renders every screen against that car.

**Per-vehicle tracking gates** — when `tracksFuel` is false: Fuel log and Trends are removed from the nav,
the header's "Log fill-up" button is hidden (only "Log service" remains), the stat rail switches to the
maintenance set, the activity feed filters out fill-ups, the Fuel filter disappears, and the dashboard chart
becomes the "Fuel tracking is off" panel. If the active screen was one of the hidden ones, fall back to
Dashboard. Symmetric behavior for `tracksService` (Maintenance hidden).

**Service multi-select** — subcategory chips toggle independently; the modal title becomes "Log 2 services"
when more than one is chosen. Selecting any "Other" subcategory reveals a **required** free-text field:
while empty it shows a "REQUIRED" hint in red, a red-tinted border, and the Save button renders disabled
(`rgba(18,18,18,.12)` background, `cursor:not-allowed`). Save enables once text is entered.

**Fill-up validation**
- Gallons greater than tank size (15.9 gal for the sample car) → red callout "Gallons exceed tank size",
  body "The Wagon's tank holds 15.9 gal. Save anyway if the pump receipt says otherwise." Warning, not a block.
- Editing a partial fill → callout "Partial fill — tagged, not averaged", explaining the entry's MPG is greyed
  and excluded from the rolling average until the next full tank.
- Real implementation should also block a **lower-than-previous odometer** (unless the user marks a reset)
  and flag a suspiciously large odometer jump as a possible missed fill-up.

**MPG rule (product decision)** — computed from odometer deltas. Partial fills are recorded and **tagged**,
displayed in grey, and excluded from the rolling average until the next full tank closes the interval.

**Reminder rule (product decision)** — each interval is tracked by miles, time, or both; due-ness is whichever
threshold hits first. Warn-at is set per interval (default 500 mi / 14 days) and drives the amber "coming up"
state; past due is red.

**Motion** — screens and modals fade/slide in with `@keyframes rise` (opacity 0→1, translateY 8px→0);
0.3s ease for screens, 0.18s for modals and the dropdown. Hover transitions are instant background swaps.

**Responsive** — desktop layout assumes ≥1240px. Below that, collapse the 4-up stat rail to 2-up, stack the
chart/reminders row, and let the activity table scroll horizontally. Below 900px, switch to the mobile
patterns in M1–M7 (sidebar → bottom tabs).

---

## State Management

Client state in the prototype (translate to React state/store):
- `screen` — active route; auto-falls back to `dash` when the current screen is gated off.
- `activeVehicleId` — drives every screen.
- `vehicleMenuOpen` — dropdown visibility.
- `modal` — `null | 'service' | 'vehicle'`.
- `editingFillId` — `null` for create, otherwise edit mode with delete affordance.
- `activityFilter` — All | Fuel | Service.
- `serviceCategory` — active category tab in the service modal.
- `selectedServices[]` — multi-select subcategory labels.
- `otherDescription` — required when an "Other" subcategory is selected.
- `performedBy` — Shop | DIY.
- `cpmWindow` — 90 days | 6 months | 1 year | all time.
- `trendRange` — 12 fills | 6 mo | 1 yr.
- `tracking[vehicleId]` — `{ fuel: boolean, service: boolean }`.
- `intervals[vehicleId][itemKey]` — `{ mode: 'miles'|'time'|'both', miles, months, warnAt }`.

### Suggested data model (SQLite)
```sql
CREATE TABLE vehicle (
  id INTEGER PRIMARY KEY,
  nickname TEXT NOT NULL,
  year INTEGER, make TEXT, model TEXT, trim TEXT,
  vin TEXT, plate TEXT,
  purchase_date TEXT, purchase_odometer INTEGER,
  tank_size_gal REAL,
  registration_renewal TEXT, insurance_renewal TEXT,
  tracks_fuel INTEGER NOT NULL DEFAULT 1,
  tracks_service INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE fill_up (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  filled_at TEXT NOT NULL,
  odometer INTEGER NOT NULL,
  gallons REAL NOT NULL,
  price_per_gal REAL,
  total_cost REAL,
  is_full_tank INTEGER NOT NULL DEFAULT 1,
  station TEXT, notes TEXT
);
CREATE INDEX idx_fill_vehicle_odo ON fill_up(vehicle_id, odometer);

CREATE TABLE service_category (          -- seeded, two levels
  id INTEGER PRIMARY KEY,
  parent_id INTEGER REFERENCES service_category(id),
  label TEXT NOT NULL,
  icon_key TEXT NOT NULL
);

CREATE TABLE service_event (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  performed_at TEXT NOT NULL,
  odometer INTEGER NOT NULL,
  cost REAL,
  performed_by TEXT,                     -- 'shop' | 'diy'
  shop TEXT, parts TEXT, notes TEXT,
  other_description TEXT                 -- required when an 'Other' item is attached
);

CREATE TABLE service_event_item (        -- multi-select: one event, many subcategories
  service_event_id INTEGER NOT NULL REFERENCES service_event(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES service_category(id),
  PRIMARY KEY (service_event_id, category_id)
);

CREATE TABLE receipt (
  id INTEGER PRIMARY KEY,
  service_event_id INTEGER REFERENCES service_event(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,               -- relative to the mounted data dir
  mime TEXT
);

CREATE TABLE interval_rule (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES service_category(id),
  mode TEXT NOT NULL,                    -- 'miles' | 'time' | 'both'
  miles INTEGER, months INTEGER,
  warn_miles INTEGER, warn_days INTEGER,
  UNIQUE (vehicle_id, category_id)
);
```

### Derived values (compute, never store)
- **MPG per fill** = (odometer − previous full-tank odometer) ÷ gallons, only when both tanks are full.
- **Rolling average MPG** = mean of the last N full-tank fills.
- **Cost per mile** = (fuel + service spend within the window) ÷ miles driven in the window; the window is the
  user's `cpmWindow` selection, and the UI must print the exact date range and mileage it used.
- **Due status** = for each interval rule, miles remaining and/or days remaining; the smaller wins.
  `remaining ≤ 0` → overdue (red); `remaining ≤ warn threshold` → coming up (amber); else on track (teal).
- **Projections** = miles/day from the last 6 months of odometer readings, used for "in ~2 wks" style estimates
  and the 90-day fuel cost forecast.

### Deployment notes (unraid)
- Ship one container serving the built Vite bundle plus a small API (Express/Fastify + better-sqlite3, or Hono).
- Bind-mount a host folder to `/data`; keep `odometer.db` and `receipts/` inside it so appdata backups cover both.
- No auth was designed. If the app is reachable beyond the LAN, put it behind your existing reverse proxy auth.
- Mobile writes should queue locally (IndexedDB) and flush to the API when the device is back on the network.

---

## Design Tokens

### Colors
| Token | Value | Use |
|---|---|---|
| Page background | `#f1f1ef` | app canvas, modal body |
| Surface | `#ffffff` | cards, tables, inputs |
| Ink | `#121212` | primary text |
| Slate | `#1b1e24` | sidebar, dark panels, primary buttons, newest-bar accent |
| Border | `rgba(18,18,18,.10)` | card borders |
| Hairline | `rgba(18,18,18,.06–.09)` | row separators, chart tracks |
| Muted text | `rgba(18,18,18,.45–.60)` | labels, secondary copy |
| On-dark text | `#f1f1ef` / `rgba(241,241,239,.45–.5)` | dark panels |
| Accent blue | `oklch(.56 .19 258)` (~`#2f6bd8`) | fuel, primary accent, charts |
| Blue hover | `oklch(.48 .19 258)` | pressed/hover |
| Blue on dark | `oklch(.76 .14 258)` | large numbers on slate |
| Blue tint | `rgba(47,107,216,.07–.18)` | secondary buttons, callouts |
| Teal | `oklch(.56 .13 195)` | tires, maintenance, service spend |
| Amber | `oklch(.66 .14 68)` | oil, warn state |
| Green | `oklch(.5 .14 150)` / on dark `oklch(.82 .15 150)` | positive delta |
| Red | `oklch(.55 .17 28)` | overdue, destructive, validation |

### Typography
- **Archivo** (400/500/600/700) — UI text and display numbers. Display uses 600 with `letter-spacing:-.03em`
  (sizes 46 / 42 / 34 / 30 / 26 / 22 / 19px); body 500 at 15 / 14 / 13 / 12px.
- **IBM Plex Mono** (400/500) — all data, labels, and captions. Labels: 9px 500, `letter-spacing:.13em`,
  uppercase. Values: 11–15px. Small captions: 8–10px.
- Line-height 1 for display numbers, 1.5–1.6 for prose.

### Spacing
4 / 5 / 6 / 7 / 9 / 10 / 12 / 14 / 16 / 18 / 22 / 24 / 26 / 34 / 40 / 56 px.
Card gaps 22px between sections, 14px within grids, 9–12px inside cards.

### Radius
2 / 5 / 7 / 8 / 9 / 10 / 12 / 14 / 17 / 40px (mobile bezel) / 999px (switch track).
Cards 10px, modals 14px, inputs and buttons 8px, icon tiles 8–11px.

### Shadow
- Primary button: `0 8px 20px -10px rgba(18,18,18,.6)`
- Dropdown: `0 22px 48px -18px rgba(18,18,18,.34)`
- Modal: `0 40px 90px -30px rgba(18,18,18,.6)`
- Phone frame: `0 26px 60px -32px rgba(18,18,18,.5)`
- FAB: `0 12px 24px -12px rgba(47,107,216,.8)`
- Switch knob: `0 1px 3px rgba(18,18,18,.3)`

---

## Assets

**Icons — replace these.** The prototype draws every service symbol with layered CSS boxes (a base div plus one
or two absolutely-positioned children) because the authoring tool had no icon library. They are intentionally
"dashboard warning lamp" style: single color, ~17px, 2–3px strokes. In the real build use **Lucide** —
droplet (oil), disc (brakes/rotor), fuel (pump), filter/wind (air filter), thermometer (coolant),
battery, cog (drivetrain), zap (spark plugs), wrench (other) — and draw **2–3 custom SVGs** on the same
2px stroke grid for tire (double ring with tread) and brake-fluid `(!)`. Keep the color mapping:
fuel = blue, oil = amber, tires/filters = teal, brake = red, drivetrain/other = slate.

**Vehicle photos** — striped placeholder in the design; real build should accept an uploaded image per vehicle,
stored under the mounted data dir (`receipts/` sibling, e.g. `vehicles/`).

**Car mark** — the small car glyph in the switcher and first-run screen is CSS boxes (body, roof, two wheels).
Replace with a single SVG.

**Fonts** — Archivo and IBM Plex Mono, both on Google Fonts; self-host them for a NAS deployment so the app
works without internet.

---

## Files
| File | What it is |
|---|---|
| `Tracker UI - Precision.dc.html` | **The spec.** Hi-fi interactive prototype: all desktop screens, both modals, empty/first-run states, and the M1–M7 mobile set. Open in a browser and click through. |
| `Wireframes.dc.html` | Low-fi exploration of five dashboard layouts (context only). |
| `support.js` | Runtime for the prototype format. Not part of the design; do not port. |

The prototype also carries two demo controls (a data-state switch for populated / empty / first-run, and a
default warn-at mileage). They exist to demo states — they are not product features.
