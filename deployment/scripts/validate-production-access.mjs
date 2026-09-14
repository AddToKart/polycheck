import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const validateProductionAccess = (settings) => {
  const names = ['POSTGRES_PASSWORD', 'RUNTIME_DATABASE_PASSWORD', 'MIGRATOR_DATABASE_PASSWORD', 'BACKUP_DATABASE_PASSWORD']
  const passwords = names.map((name) => {
    const value = settings[name] || ''
    if (value.length < 24 || /[<>\r\n]/.test(value)) throw new Error(`${name} requires a real password of at least 24 characters`)
    return value
  })
  if (new Set(passwords).size !== names.length) throw new Error('Database roles must use different passwords')
  for (const [name, role, passwordName, host] of [
    ['DATABASE_URL', 'polycheck_runtime', 'RUNTIME_DATABASE_PASSWORD', 'pgbouncer'],
    ['DIRECT_DATABASE_URL', 'polycheck_migrator', 'MIGRATOR_DATABASE_PASSWORD', 'postgres'],
  ]) {
    let url
    try { url = new URL(settings[name]) } catch { throw new Error(`${name} is invalid`) }
    if (url.protocol !== 'postgresql:' || url.username !== role || url.hostname !== host || url.pathname !== '/polycheck') throw new Error(`${name} must target ${role} on ${host}/polycheck`)
    if (decodeURIComponent(url.password) !== settings[passwordName]) throw new Error(`${name} password does not match ${passwordName}`)
  }
  const repository = settings.RESTIC_REPOSITORY || ''
  if (!/^(s3|rest):https:\/\//.test(repository) || /[<>]/.test(repository)) throw new Error('RESTIC_REPOSITORY requires a configured remote HTTPS repository')
  if ((settings.RESTIC_PASSWORD || '').length < 24 || /[<>]/.test(settings.RESTIC_PASSWORD)) throw new Error('RESTIC_PASSWORD requires a separate encryption password of at least 24 characters')
  if (passwords.includes(settings.RESTIC_PASSWORD)) throw new Error('RESTIC_PASSWORD must be independent of database credentials')
  for (const name of ['OFFSITE_ACCESS_KEY_ID', 'OFFSITE_SECRET_ACCESS_KEY']) {
    if (!settings[name] || /[<>]/.test(settings[name])) throw new Error(`${name} is required`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const file = process.argv[2] ? Object.fromEntries(readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^(['"])(.*)\1$/, '$2')] })) : {}
    validateProductionAccess({ ...file, ...process.env })
    console.log('Production database access and offsite configuration validated.')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
