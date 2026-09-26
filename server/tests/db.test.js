import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

process.env.DB_PATH ??= ':memory:'
process.env.SEED_DEMO ??= '1'
const { db } = await import('../db.js')

const RECORD_TABLES = ['fill_ups', 'service_records', 'policy_records', 'receipts']

test('the database is migrated and records each migration', () => {
  const rows = db.prepare('SELECT version, name, appliedAt FROM schema_migrations ORDER BY version').all()

  assert.deepEqual(rows.map(({ version, name }) => ({ version, name })), [
    { version: 1, name: 'initial' },
    { version: 2, name: 'demo_flag' },
    { version: 3, name: 'receipts' },
    { version: 4, name: 'fillup_station_notes' },
  ])
  assert.match(rows[0].appliedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
})

test('vehicles have every column the API writes, including color', () => {
  const columns = db.prepare('PRAGMA table_info(vehicles)').all().map((c) => c.name)

  for (const column of ['nickname', 'purchaseOdometer', 'tracksFuel', 'tracksService', 'odometer', 'intervals', 'color', 'isDemo']) {
    assert.ok(columns.includes(column), column)
  }
})

test('foreign keys are enforced and every record table cascades deletes', () => {
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1)
  for (const table of RECORD_TABLES) {
    const keys = db.prepare(`PRAGMA foreign_key_list(${table})`).all()
    assert.ok(keys.some((key) => key.table === 'vehicles' && key.on_delete === 'CASCADE'), table)
  }
})

test('SEED_DEMO=1 loads the demo vehicles into an empty database, flagged as demo data', () => {
  const rows = db.prepare('SELECT id, nickname, isDemo FROM vehicles ORDER BY id').all()

  assert.deepEqual(rows.map((v) => ({ ...v })), [
    { id: 1, nickname: 'The Wagon', isDemo: 1 },
    { id: 2, nickname: 'The Truck', isDemo: 1 },
  ])
})

test('without SEED_DEMO the database starts empty', () => {
  const env = { ...process.env, DB_PATH: ':memory:' }
  delete env.SEED_DEMO
  const script = "const { db } = await import('./db.js'); console.log(db.prepare('SELECT COUNT(*) AS n FROM vehicles').get().n)"

  const output = execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', script], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env,
    encoding: 'utf8',
  })

  assert.equal(output.trim().split('\n').at(-1), '0')
})
