import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'

process.env.DB_PATH ??= ':memory:'
const { db, tablesWithoutCascade } = await import('../db.js')

test('foreign keys are enforced and every record table cascades deletes', () => {
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1)
  assert.deepEqual(tablesWithoutCascade(db), [])
})

test('tables created before cascading deletes are flagged', () => {
  const old = new DatabaseSync(':memory:')
  old.exec(`
    CREATE TABLE vehicles (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT NOT NULL);
    CREATE TABLE fill_ups (id INTEGER PRIMARY KEY, vehicleId INTEGER NOT NULL, FOREIGN KEY (vehicleId) REFERENCES vehicles(id));
    CREATE TABLE service_records (id INTEGER PRIMARY KEY, vehicleId INTEGER NOT NULL, FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE);
    CREATE TABLE policy_records (id INTEGER PRIMARY KEY, vehicleId INTEGER NOT NULL, FOREIGN KEY (vehicleId) REFERENCES vehicles(id));
  `)

  assert.deepEqual(tablesWithoutCascade(old), ['fill_ups', 'policy_records'])
  old.close()
})
