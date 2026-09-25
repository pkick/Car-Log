# Car-Log

A car log app that is hosted on a local NAS, letting you record fuel-ups, maintenance, and insurance/registration info for your vehicles.

## Features

- **Garage** — track multiple vehicles (year/make/model/trim, VIN, plate, purchase info, current odometer)
- **Fuel Log** — record fill-ups and track fuel economy over time
- **Maintenance** — log service records against configurable maintenance intervals
- **Documents** — track insurance/registration policy records and renewal dates
- **Dashboard & Trends** — at-a-glance stats and trends across your vehicles

## Tech stack

- **Frontend**: React 19 + Vite + Tailwind CSS (`app/`)
- **Backend**: Express + Node's built-in `node:sqlite` (`server/`)

## Project structure

```
app/       React frontend (Vite)
server/    Express API + SQLite database
design_handoff_car_tracker/   Design reference files
```

## Getting started

Requires Node.js 22.5+ (for built-in `node:sqlite` support).

### Backend

```bash
cd server
npm install
npm run dev
```

Starts the API on `http://localhost:3001`. The SQLite database is created automatically at `server/data/odometer.db` on first run.

### Frontend

```bash
cd app
npm install
npm run dev
```

Starts the Vite dev server (see terminal output for the local URL).
