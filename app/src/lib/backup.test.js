import { describe, expect, it } from 'vitest'
import { filenameFromDisposition, restoreWarning, summarizeBackup } from './backup'

const backup = {
  app: 'odometer',
  schemaVersion: 1,
  vehicles: [{ id: 1 }, { id: 2 }],
  fillUps: [{ id: 1 }, { id: 2 }, { id: 3 }],
  serviceRecords: [{ id: 1 }],
  policyRecords: [{ id: 1 }, { id: 2 }],
}

describe('summarizeBackup', () => {
  it('counts vehicles, and fill-ups, services and payments together as records', () => {
    expect(summarizeBackup(backup)).toEqual({ vehicles: 2, records: 6 })
  })

  it('accepts an empty backup', () => {
    expect(summarizeBackup({ ...backup, vehicles: [], fillUps: [], serviceRecords: [], policyRecords: [] }))
      .toEqual({ vehicles: 0, records: 0 })
  })

  it('rejects files from anything else', () => {
    for (const data of [null, 42, 'odometer', [backup], { ...backup, app: 'fuelly' }]) {
      expect(summarizeBackup(data)).toEqual({ error: "This file isn't an Odometer backup." })
    }
  })

  it('names the first missing list', () => {
    expect(summarizeBackup({ ...backup, serviceRecords: undefined })).toEqual({ error: 'This backup has no serviceRecords list.' })
    expect(summarizeBackup({ ...backup, vehicles: {} })).toEqual({ error: 'This backup has no vehicles list.' })
  })
})

describe('restoreWarning', () => {
  it('says what the restore replaces everything with', () => {
    expect(restoreWarning({ vehicles: 2, records: 38 }))
      .toBe("This replaces every vehicle and record with the backup's 2 vehicles and 38 records.")
  })

  it('uses the singular for one', () => {
    expect(restoreWarning({ vehicles: 1, records: 1 }))
      .toBe("This replaces every vehicle and record with the backup's 1 vehicle and 1 record.")
  })
})

describe('filenameFromDisposition', () => {
  it('reads a quoted filename, as Express sends it', () => {
    expect(filenameFromDisposition('attachment; filename="odometer-backup-2026-09-25.json"')).toBe('odometer-backup-2026-09-25.json')
  })

  it('reads a bare filename', () => {
    expect(filenameFromDisposition('attachment; filename=backup.json; size=12')).toBe('backup.json')
  })

  it('returns null without one', () => {
    expect(filenameFromDisposition('attachment')).toBeNull()
    expect(filenameFromDisposition(null)).toBeNull()
  })
})
