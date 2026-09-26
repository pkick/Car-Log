import fs from 'node:fs'
import path from 'node:path'
import { StartupError } from './errors.js'

const MIGRATION_FILE = /^(\d+)_(\w+)\.sql$/

/**
 * @typedef {object} Migration
 * @property {number} version The number the file name starts with.
 * @property {string} name The rest of the file name, e.g. `initial` for `001_initial.sql`.
 * @property {string} file The file name.
 */

/**
 * Lists the migrations in a folder, lowest version first. Files that don't end in `.sql` are ignored.
 * @param {string} dir The migrations folder.
 * @returns {Migration[]}
 * @throws {Error} When a `.sql` file isn't named `NNN_name.sql` or two files share a version.
 */
export function listMigrations(dir) {
  const migrations = fs.readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => {
      const match = MIGRATION_FILE.exec(file)
      if (!match) throw new Error(`Migration ${file} must be named like 001_name.sql.`)
      return { version: Number(match[1]), name: match[2], file }
    })
    .sort((a, b) => a.version - b.version)

  migrations.forEach((migration, index) => {
    const previous = migrations[index - 1]
    if (previous?.version === migration.version) {
      throw new Error(`Migrations ${previous.file} and ${migration.file} share version ${migration.version}.`)
    }
  })
  return migrations
}

/**
 * The highest migration version recorded in a database.
 * @param {import('node:sqlite').DatabaseSync} db A database that `runMigrations` has run on.
 * @returns {number} The version, or 0 when nothing has been applied.
 */
export function currentSchemaVersion(db) {
  return db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version ?? 0
}

function databaseFile(db) {
  return db.prepare('PRAGMA database_list').all().find((entry) => entry.name === 'main')?.file || ':memory:'
}

/**
 * Brings a database up to date: applies every migration in `dir` it hasn't recorded in `schema_migrations`,
 * in version order. Each one runs in its own transaction and is recorded in that same transaction, so a
 * failing migration leaves the database as the previous one left it. Foreign keys are off while a migration
 * runs, so rebuilding a table doesn't cascade-delete its records, and `PRAGMA foreign_key_check` must pass
 * before it commits. Migrations must not contain their own `BEGIN` or `COMMIT`.
 * @param {import('node:sqlite').DatabaseSync} db The database to migrate.
 * @param {string} dir The folder holding the `NNN_name.sql` files.
 * @returns {Migration[]} The migrations this call applied, or an empty array when it was already up to date.
 * @throws {StartupError} When the database has tables but no `schema_migrations` (it predates migrations), or
 *   records a version this folder doesn't have (a newer Odometer wrote it).
 * @throws {Error} When a migration fails. Earlier migrations from the same call stay applied.
 */
export function runMigrations(db, dir) {
  const migrations = listMigrations(dir)
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all().map((row) => row.name)

  if (tables.length > 0 && !tables.includes('schema_migrations')) {
    const file = databaseFile(db)
    throw new StartupError(
      `${file} was created before Odometer had migrations, so it can't be upgraded. ` +
      `Data from before then is disposable dev data: stop the server, delete ${file}, and start it again.`
    )
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      appliedAt TEXT NOT NULL
    )
  `)

  const known = new Set(migrations.map((migration) => migration.version))
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version)
  const unknown = applied.filter((version) => !known.has(version))
  if (unknown.length > 0) {
    throw new StartupError(
      `${databaseFile(db)} has schema version ${unknown.at(-1)}, which this version of Odometer doesn't know. ` +
      'A newer Odometer wrote it: run that version again, or restore a backup made with this one into an empty data folder.'
    )
  }

  const pending = migrations.filter((migration) => !applied.includes(migration.version))
  if (pending.length === 0) return []

  const foreignKeys = db.prepare('PRAGMA foreign_keys').get().foreign_keys
  db.exec('PRAGMA foreign_keys = OFF')
  try {
    for (const migration of pending) applyMigration(db, dir, migration)
  } finally {
    db.exec(`PRAGMA foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`)
  }
  return pending
}

/**
 * Rolls back the open transaction, if SQLite hasn't already rolled it back after an error.
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {void}
 */
export function rollback(db) {
  try {
    db.exec('ROLLBACK')
  } catch {
    // No transaction was open.
  }
}

function applyMigration(db, dir, migration) {
  const sql = fs.readFileSync(path.join(dir, migration.file), 'utf8')
  db.exec('BEGIN')
  try {
    db.exec(sql)
    const broken = db.prepare('PRAGMA foreign_key_check').all()
    if (broken.length > 0) {
      throw new Error(`it leaves ${broken.length} row(s) in ${broken[0].table} pointing at missing ${broken[0].parent}`)
    }
    db.prepare(`
      INSERT INTO schema_migrations (version, name, appliedAt) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `).run(migration.version, migration.name)
    db.exec('COMMIT')
  } catch (err) {
    rollback(db)
    throw new Error(`Migration ${migration.file} failed and was rolled back: ${err.message}`, { cause: err })
  }
}
