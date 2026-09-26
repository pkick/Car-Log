/**
 * The container's start command. Docker creates a missing bind-mount folder as root, which a non-root server
 * couldn't write to. So when the container starts as root, this gives DATA_DIR to PUID:PGID (the image
 * defaults to 1000:1000, its `node` user; the unraid template uses 99:100, nobody:users), drops to that user,
 * and only then starts the server. Started with `--user`, it leaves ownership alone and just starts the server.
 * PUID=0 keeps the server running as root.
 */
import fs from 'node:fs'
import path from 'node:path'

function readId(name) {
  const value = process.env[name] ?? '1000'
  if (!/^\d+$/.test(value)) {
    console.error(`Odometer can't start: ${name} must be a whole number, not "${value}".`)
    process.exit(1)
  }
  return Number(value)
}

function chownTree(target, uid, gid) {
  const stats = fs.lstatSync(target)
  if (stats.uid !== uid || stats.gid !== gid) fs.lchownSync(target, uid, gid)
  if (stats.isDirectory()) {
    for (const entry of fs.readdirSync(target)) chownTree(path.join(target, entry), uid, gid)
  }
}

if (process.getuid() === 0) {
  const uid = readId('PUID')
  const gid = readId('PGID')
  if (uid !== 0) {
    const dataDir = process.env.DATA_DIR || '/data'
    try {
      fs.mkdirSync(dataDir, { recursive: true })
      chownTree(dataDir, uid, gid)
    } catch (err) {
      console.warn(`Couldn't give ${dataDir} to ${uid}:${gid} (${err.code}); starting anyway.`)
    }
    process.setgroups([gid])
    process.setgid(gid)
    process.setuid(uid)
  }
}

await import('./index.js')
