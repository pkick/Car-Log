# Car-Log

A car log app that is hosted on a local NAS, letting you record fuel-ups, maintenance, and insurance/registration info for your vehicles.

## Features

- **Garage** — track multiple vehicles (year/make/model/trim, VIN, plate, purchase info, current odometer)
- **Fuel Log** — record fill-ups and track fuel economy over time
- **Maintenance** — log service records against configurable maintenance intervals
- **Documents** — track insurance/registration policy records and renewal dates
- **Dashboard & Trends** — at-a-glance stats and trends across your vehicles
- **Export and backup** — CSV export for spreadsheets, plus a full JSON backup you can restore

## Tech stack

- **Frontend**: React 19 + Vite + Tailwind CSS (`app/`), with self-hosted fonts (no requests to Google Fonts)
- **Backend**: Express + Node's built-in `node:sqlite` (`server/`)

## Project structure

```
app/                          React frontend (Vite)
server/                       Express API + SQLite database
server/migrations/            Numbered schema migrations, applied on start
server/notify/                Reminders: the daily check, digest and ntfy / Pushover / email senders
shared/                       Logic both sides use: dates, due-soon math, renewals, service catalog
unraid/odometer.xml           unraid Docker template
Dockerfile, docker-compose.yml
design_handoff_car_tracker/   Design reference files
```

## Getting started (development)

Requires Node.js 22.13+ (the first 22.x release where the built-in `node:sqlite` works without a flag).

### Backend

```bash
cd server
npm install
npm run dev
```

Starts the API on `http://localhost:3001`. The database is created at `server/data/odometer.db` on first run, and
`npm run dev` fills an empty database with two demo vehicles (`SEED_DEMO=1`). `npm start` doesn't, so it starts
empty.

### Frontend

```bash
cd app
npm install
npm run dev
```

Starts the Vite dev server on `http://localhost:5173`. It proxies `/api` to the backend on port 3001.

### Tests

```bash
cd server && npm test                                  # API routes and migrations, against an in-memory database
cd app && npm test && npm run lint && npm run build
```

### Changing the schema

Every schema change is a new file in `server/migrations/`, named with the next number: `002_add_station.sql`.
The server applies new files in order when it starts, each in its own transaction, and records them in
`schema_migrations`. Never edit a migration that has shipped. Don't put `BEGIN` or `COMMIT` in a migration; foreign
keys are off while it runs, so rebuilding a table doesn't delete the records that point at it.

## Running in production

The server serves the built app and the API on one port. Everything it stores lives in one folder, `DATA_DIR`.

| Variable | Default | What it does |
|---|---|---|
| `DATA_DIR` | `server/data` (`/data` in Docker) | Holds `odometer.db` and `receipts/`, the uploaded receipts and documents. Created on start if missing. |
| `PORT` | `3001` | Port for the app and the API. |
| `SEED_DEMO` | unset | `1` loads the demo vehicles into an empty database, flagged as demo data (the app's "Clear demo data" banner removes them). Leave it unset for real data; a fresh install can also load demo data from its first-run screen. |
| `DB_PATH` | `$DATA_DIR/odometer.db` | Overrides the database file (the tests use `:memory:`). |
| `STATIC_DIR` | `app/dist` | The built app to serve. Without it, only the API is served. |
| `TZ` | the machine's | Time zone. The server's local date names backup files. |
| `PUID`, `PGID` | `1000`, `1000` | Docker only: the user the server runs as, and who owns `/data`. |

Without Docker:

```bash
cd app && npm ci && npm run build
cd ../server && npm ci --omit=dev
DATA_DIR=/srv/odometer PORT=3001 npm start
```

### Docker on your computer

```bash
docker compose up -d --build
```

Then open `http://localhost:3001`. The database is in `./data`. The app needs no internet access once the image
is built. Change `TZ` in `docker-compose.yml` to your time zone.

### Deploying on unraid

Odometer isn't published to a registry, so the NAS builds the image from the source. In the unraid terminal:

```bash
git clone https://github.com/pkick/Car-Log.git /mnt/user/appdata/odometer-src
```

Then pick one of the two ways to run it.

**With the template.** Build the image, copy the template to your user templates, then add the container from the
Docker tab:

```bash
docker build -t odometer:latest /mnt/user/appdata/odometer-src
cp /mnt/user/appdata/odometer-src/unraid/odometer.xml /boot/config/plugins/dockerMan/templates-user/my-odometer.xml
```

Docker › Add Container › Template › `odometer` › Apply. It maps port 3001, stores its data in
`/mnt/user/appdata/odometer`, and the container's WebUI link opens the app. The template's `Repository` is the
placeholder `odometer:latest`, the tag built above; change it if you push the image to a registry. Because it's a
local tag, unraid's update check shows "not available", which is expected.

**With Compose** (the Compose Manager plugin, or `docker compose` in the terminal). Next to `docker-compose.yml`,
create `docker-compose.override.yml`. Compose reads it automatically, and `git pull` leaves it alone:

```yaml
services:
  odometer:
    volumes:
      - /mnt/user/appdata/odometer:/data
    environment:
      PUID: "99"
      PGID: "100"
      TZ: America/Los_Angeles # your time zone
```

Then build and start it:

```bash
cd /mnt/user/appdata/odometer-src && docker compose up -d --build
```

Odometer has no sign-in. Keep it on your LAN, or put it behind your reverse proxy's authentication. Receipts upload up
to 10 MB, so let the proxy pass bodies that large (nginx and Nginx Proxy Manager default to 1 MB:
`client_max_body_size 12m;`).

### File ownership (why the container starts as root)

The server runs as an unprivileged user. Docker creates a missing host folder as root, which that
user couldn't write to, so the container starts as root only long enough to give `/data` to `PUID:PGID` and then
drops to that user (`server/docker-entrypoint.js`). The defaults are `1000:1000`, the image's `node` user; the unraid
template uses `99:100` (nobody:users), unraid's usual owner for share files. You don't need to `chown` anything.

To run it entirely unprivileged instead, start the container with `--user 99:100` (or `user: "1000:1000"` in
Compose). It then leaves ownership alone, so give that user the folder first:

```bash
mkdir -p /mnt/user/appdata/odometer && chown -R 99:100 /mnt/user/appdata/odometer
```

If it can't write to `/data`, the log says so and names the user.

## Reminders

Odometer can tell you when a service or a renewal is coming up, and again when it's overdue. Set it up in
Settings › Notifications:

- **ntfy**: a server (`https://ntfy.sh`, or your own), a topic, and an access token if the topic is protected.
  Subscribe to the topic in the ntfy app. On ntfy.sh anyone who knows a topic can read it, so pick one that's hard
  to guess.
- **Pushover**: your user key and an application's API token.
- **Email**: an SMTP server, port, security (STARTTLS, TLS or none), username and password, and the from and to
  addresses.

**Send test** on each channel sends a test message and shows the provider's error if it fails. Tokens and passwords
are write-only: Settings shows them as "Saved" and never displays them again. They're stored in `odometer.db`, and
the JSON backup doesn't include them, so after restoring into a fresh install, set the channels up again.

The server sends reminders itself, so they arrive whether or not the app is open, and they work over plain
`http://` (unlike offline mode and install, they don't need HTTPS). The server needs to reach the provider: the
internet for ntfy.sh, Pushover or a hosted mail server, or just your network for a self-hosted ntfy or SMTP relay.

- **Daily check**, at 8:00 by default: one message per maintenance interval or renewal when it becomes due soon,
  and one more if it becomes overdue, such as "The Wagon: Tire rotation is overdue (2,410 mi past due)." Nothing
  repeats. Logging the service resets the interval, and its reminders start over. If the server was off at the
  check time, the check runs when it starts.
- **Weekly digest**, on Sundays by default (or off): everything overdue or coming up on every vehicle, and this
  month's spend so far.
- **Reminder defaults**: how many miles and days before its due point a new interval warns (500 mi / 14 days), and
  how many days before a renewal its reminder goes out (30).

Times are in the server's time zone, so set `TZ` (see [Running in production](#running-in-production)).

## Backups

- **The data folder.** All data is in the data folder (`/mnt/user/appdata/odometer` on unraid): the database,
  `odometer.db`, and the receipts and documents you attach, as files in `receipts/` under random names. The Appdata
  Backup plugin covers both. That plugin stops containers while it copies, which keeps the database consistent. If you
  copy the folder yourself, stop the container first.
- **In the app.** Settings › Export › **Export backup (JSON)** downloads every vehicle and record as
  `odometer-backup-YYYY-MM-DD.json`. **Restore from backup** replaces everything with a backup's contents after you
  confirm. A restore checks every record first and changes nothing if one is invalid. Backups from an older version
  restore into a newer one; a newer backup is refused by an older server. The CSV export is for spreadsheets and
  can't be restored.
- **Receipt files are not in the JSON export.** It holds each receipt's details (name, type, which record it's on) but
  not the file, so keep the appdata backup for those. A restore never deletes files, and a restored receipt whose file
  isn't in `receipts/` shows as "File missing" until you put the file back.

## Upgrading

Get the new source, rebuild the image, and recreate the container. Data stays in the data folder, and the server
applies any new migrations when it starts.

- **Template:** `git -C /mnt/user/appdata/odometer-src pull`, then
  `docker build -t odometer:latest /mnt/user/appdata/odometer-src`, then Edit › Apply on the container.
- **Compose:** `git pull`, then `docker compose up -d --build` in the source folder.
- **From a registry:** pull the new image and recreate the container.

Export a JSON backup before upgrading if you want an easy way back: an older image refuses to start on a database
that a newer one has migrated.

A database from before migrations existed (development data from before this release) is refused with a message
naming the file. That data is disposable: delete the file and start again.
