import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { runMigrations, listMigrations, currentSchemaVersion } from '../migrate.js'
import { StartupError } from '../errors.js'

/**
 * Writes migration files into a new temporary folder.
 * @param {Record<string, string>} files SQL keyed by file name.
 * @returns {string} The folder.
 */
function migrationsDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'odometer-migrations-'))
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql)
  return dir
}

const recorded = (db) => db.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all()
  .map(({ version, name }) => ({ version, name }))
const columns = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
const tableExists = (db, table) => !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table)

test('migrations apply in version order and each one is recorded', () => {
  const dir = migrationsDir({
    '010_add_c.sql': 'ALTER TABLE things ADD COLUMN c TEXT;',
    '002_add_b.sql': 'ALTER TABLE things ADD COLUMN b TEXT;',
    '001_create_things.sql': 'CREATE TABLE things (a TEXT);',
    'README.md': 'Not a migration.',
  })
  const db = new DatabaseSync(':memory:')

  const applied = runMigrations(db, dir)

  assert.deepEqual(applied.map((m) => m.file), ['001_create_things.sql', '002_add_b.sql', '010_add_c.sql'])
  assert.deepEqual(columns(db, 'things'), ['a', 'b', 'c'])
  assert.deepEqual(recorded(db), [
    { version: 1, name: 'create_things' },
    { version: 2, name: 'add_b' },
    { version: 10, name: 'add_c' },
  ])
  assert.equal(currentSchemaVersion(db), 10)
})

test('running again is a no-op, and a new file is applied on the next run', () => {
  const dir = migrationsDir({ '001_create_things.sql': 'CREATE TABLE things (a TEXT);' })
  const db = new DatabaseSync(':memory:')
  runMigrations(db, dir)
  const before = db.prepare('SELECT * FROM schema_migrations').all()

  assert.deepEqual(runMigrations(db, dir), [])
  assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(), before)

  fs.writeFileSync(path.join(dir, '002_add_b.sql'), 'ALTER TABLE things ADD COLUMN b TEXT;')
  assert.deepEqual(runMigrations(db, dir).map((m) => m.version), [2])
  assert.deepEqual(columns(db, 'things'), ['a', 'b'])
})

test('a failing migration rolls back and is not recorded', () => {
  const dir = migrationsDir({
    '001_create_things.sql': 'CREATE TABLE things (a TEXT);',
    '002_broken.sql': 'CREATE TABLE half_done (x TEXT);\nINSERT INTO no_such_table VALUES (1);',
  })
  const db = new DatabaseSync(':memory:')

  assert.throws(() => runMigrations(db, dir), /002_broken\.sql failed and was rolled back: .*no_such_table/)

  assert.equal(tableExists(db, 'half_done'), false)
  assert.deepEqual(recorded(db), [{ version: 1, name: 'create_things' }])
  assert.doesNotThrow(() => db.exec('BEGIN; ROLLBACK'), 'no transaction is left open')

  fs.writeFileSync(path.join(dir, '002_broken.sql'), 'CREATE TABLE half_done (x TEXT);')
  assert.deepEqual(runMigrations(db, dir).map((m) => m.version), [2])
  assert.equal(tableExists(db, 'half_done'), true)
})

test('rebuilding a table keeps the records that reference it, and foreign keys are back on afterwards', () => {
  const dir = migrationsDir({
    '001_create.sql': `
      CREATE TABLE parents (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE children (id INTEGER PRIMARY KEY, parentId INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE);
      INSERT INTO parents VALUES (1, 'one');
      INSERT INTO children VALUES (1, 1), (2, 1);
    `,
    '002_rebuild_parents.sql': `
      CREATE TABLE parents_new (id INTEGER PRIMARY KEY, name TEXT NOT NULL DEFAULT '');
      INSERT INTO parents_new SELECT id, name FROM parents;
      DROP TABLE parents;
      ALTER TABLE parents_new RENAME TO parents;
    `,
  })
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')

  runMigrations(db, dir)

  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM children').get().n, 2)
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1)
})

test('a migration that leaves a dangling foreign key is rolled back', () => {
  const dir = migrationsDir({
    '001_create.sql': `
      CREATE TABLE parents (id INTEGER PRIMARY KEY);
      CREATE TABLE children (id INTEGER PRIMARY KEY, parentId INTEGER REFERENCES parents(id));
    `,
    '002_orphan.sql': 'INSERT INTO children VALUES (1, 99);',
  })
  const db = new DatabaseSync(':memory:')

  assert.throws(() => runMigrations(db, dir), /002_orphan\.sql failed .*children pointing at missing parents/)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM children').get().n, 0)
  assert.equal(currentSchemaVersion(db), 1)
})

test('a database from before migrations is refused, named, and left untouched', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'odometer-legacy-')), 'odometer.db')
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE vehicles (id INTEGER PRIMARY KEY, nickname TEXT NOT NULL)')
  const dir = migrationsDir({ '001_initial.sql': 'CREATE TABLE fill_ups (id INTEGER PRIMARY KEY);' })

  assert.throws(() => runMigrations(db, dir), (err) => {
    assert.ok(err instanceof StartupError)
    assert.match(err.message, /created before Odometer had migrations/)
    assert.ok(err.message.includes(`delete ${file}`), err.message)
    return true
  })
  assert.equal(tableExists(db, 'schema_migrations'), false)
  assert.equal(tableExists(db, 'fill_ups'), false)
  db.close()
})

test('an empty database is migrated, not mistaken for an old one', () => {
  const db = new DatabaseSync(':memory:')

  assert.equal(runMigrations(db, migrationsDir({ '001_a.sql': 'CREATE TABLE a (x TEXT);' })).length, 1)
})

test('a database written by a newer version is refused', () => {
  const db = new DatabaseSync(':memory:')
  runMigrations(db, migrationsDir({
    '001_a.sql': 'CREATE TABLE a (x TEXT);',
    '002_b.sql': 'CREATE TABLE b (x TEXT);',
  }))

  assert.throws(
    () => runMigrations(db, migrationsDir({ '001_a.sql': 'CREATE TABLE a (x TEXT);' })),
    (err) => err instanceof StartupError && /schema version 2, which this version of Odometer doesn't know/.test(err.message)
  )
})

test('misnamed and duplicate migration files are rejected', () => {
  assert.throws(() => listMigrations(migrationsDir({ 'initial.sql': '' })), /must be named like 001_name\.sql/)
  assert.throws(
    () => listMigrations(migrationsDir({ '001_a.sql': '', '1_b.sql': '' })),
    /001_a\.sql and 1_b\.sql share version 1|1_b\.sql and 001_a\.sql share version 1/
  )
})

test('the shipped migrations build the schema the server expects', () => {
  const db = new DatabaseSync(':memory:')
  const dir = fileURLToPath(new URL('../migrations', import.meta.url))

  runMigrations(db, dir)

  assert.equal(currentSchemaVersion(db), listMigrations(dir).at(-1).version)
  for (const table of ['vehicles', 'fill_ups', 'service_records', 'policy_records', 'receipts']) assert.ok(tableExists(db, table), table)
})

const SHIPPED = fileURLToPath(new URL('../migrations', import.meta.url))

/**
 * The shipped migrations up to and including one version, copied into a new temporary folder.
 * @param {number} version
 * @returns {string} The folder.
 */
function shippedUpTo(version) {
  const files = listMigrations(SHIPPED).filter((m) => m.version <= version)
  return migrationsDir(Object.fromEntries(files.map(({ file }) => [file, fs.readFileSync(path.join(SHIPPED, file), 'utf8')])))
}

test('002_demo_flag applies on top of a database at 001 and keeps its vehicles as real data', () => {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db, shippedUpTo(1))
  db.exec(`
    INSERT INTO vehicles (id, nickname, intervals) VALUES (1, 'Existing', '[]');
    INSERT INTO fill_ups (vehicleId, date, odometer, gallons, pricePerGal, total) VALUES (1, '2026-09-01', 1000, 10, 3.5, 35);
  `)
  assert.equal(columns(db, 'vehicles').includes('isDemo'), false)

  assert.deepEqual(runMigrations(db, shippedUpTo(2)).map((m) => m.file), ['002_demo_flag.sql'])

  assert.ok(columns(db, 'vehicles').includes('isDemo'))
  assert.deepEqual({ ...db.prepare('SELECT nickname, isDemo FROM vehicles').get() }, { nickname: 'Existing', isDemo: 0 })
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fill_ups').get().n, 1)
  assert.throws(() => db.exec("INSERT INTO vehicles (nickname, isDemo) VALUES ('No flag', NULL)"), /NOT NULL/)

  db.exec("INSERT INTO vehicles (id, nickname, isDemo) VALUES (2, 'Demo', 1)")
  db.exec("INSERT INTO fill_ups (vehicleId, date, odometer, gallons, pricePerGal, total) VALUES (2, '2026-09-01', 1000, 10, 3.5, 35)")
  db.exec('DELETE FROM vehicles WHERE isDemo = 1')
  assert.deepEqual(db.prepare('SELECT vehicleId FROM fill_ups').all().map((f) => f.vehicleId), [1], 'records still cascade')
})

test('003_receipts applies on top of a database at 002, and receipt rows go with their vehicle', () => {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db, shippedUpTo(2))
  db.exec("INSERT INTO vehicles (id, nickname, intervals) VALUES (1, 'Existing', '[]'), (2, 'Other', '[]')")

  assert.deepEqual(runMigrations(db, shippedUpTo(3)).map((m) => m.file), ['003_receipts.sql'])

  const insert = db.prepare(`
    INSERT INTO receipts (recordType, recordId, vehicleId, storedName, filename, mimeType, size, createdAt)
    VALUES (?, ?, ?, 'a.pdf', 'a.pdf', 'application/pdf', 10, '2026-09-26T00:00:00Z')
  `)
  insert.run('vehicle', 1, 1)
  insert.run('vehicle', 2, 2)
  assert.throws(() => insert.run('fill-up', 1, 1), /CHECK constraint/)
  assert.throws(() => insert.run('vehicle', 3, 3), /FOREIGN KEY/)
  db.exec('DELETE FROM vehicles WHERE id = 1')
  assert.deepEqual(db.prepare('SELECT vehicleId FROM receipts').all().map((r) => r.vehicleId), [2])
})
