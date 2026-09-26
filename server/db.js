import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { runMigrations } from './migrate.js'
import { seedDemoData } from './seed.js'
import { StartupError } from './errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Where Odometer keeps its data: the database now, uploads later. `DATA_DIR` sets it; the default is `server/data`. */
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'))

/** The database file: `DB_PATH` if set (tests use `:memory:`), otherwise `$DATA_DIR/odometer.db`. */
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'odometer.db')

function ensureWritableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.accessSync(dir, fs.constants.W_OK)
  } catch (err) {
    const user = process.getuid ? ` as user ${process.getuid()}:${process.getgid()}` : ''
    throw new StartupError(
      `${dir} isn't writable${user} (${err.code}). Give that user write access to it; in Docker, that means the ` +
      'host folder mounted there.',
      { cause: err }
    )
  }
}

if (DB_PATH !== ':memory:') {
  for (const dir of new Set([DATA_DIR, path.dirname(path.resolve(DB_PATH))])) ensureWritableDir(dir)
}

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA foreign_keys = ON')

for (const { file } of runMigrations(db, path.join(__dirname, 'migrations'))) {
  console.log(`Applied migration ${file}`)
}

if (process.env.SEED_DEMO === '1' && !db.prepare('SELECT 1 FROM vehicles LIMIT 1').get()) {
  seedDemoData(db)
}
