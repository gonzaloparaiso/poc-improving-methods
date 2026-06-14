// Arranca la API real contra una BD temporal sembrada (admin + cliente),
// para los tests E2E. Se lanza con: node --experimental-sqlite e2e/api-server.mjs
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const DB = path.join(os.tmpdir(), 'im-e2e.db')
for (const e of ['', '-wal', '-shm']) { try { fs.rmSync(DB + e) } catch {} }

const hash = (p) => {
  const s = crypto.randomBytes(16).toString('hex')
  return `scrypt$${s}$${crypto.scryptSync(p, s, 64).toString('hex')}`
}

const db = new DatabaseSync(DB)
db.exec('CREATE TABLE IF NOT EXISTS im_users (ord INTEGER PRIMARY KEY, id TEXT, data TEXT NOT NULL)')
db.exec('CREATE TABLE IF NOT EXISTS im_clientes (ord INTEGER PRIMARY KEY, id TEXT, data TEXT NOT NULL)')
db.prepare('INSERT INTO im_users (ord,id,data) VALUES (?,?,?)').run(0, 'u1', JSON.stringify({
  id: 'u1', nombre: 'Admin', apellido: '', email: 'a@a.com', username: 'admin',
  password: hash('admin123'), rol: 'administrador', activo: true, creadoEn: '2024-01-01T00:00:00.000Z',
}))
db.prepare('INSERT INTO im_clientes (ord,id,data) VALUES (?,?,?)').run(0, 'c1', JSON.stringify({
  id: 'c1', nombre: 'Cliente', apellido: 'Prueba', email: 'cliente@test.com', username: 'cli',
  password: hash('cli123'), activo: true, creadoEn: '2024-01-01T00:00:00.000Z', suscripcionesIds: [],
}))
db.close()

process.env.DB_FILE = DB
process.env.PORT = '3001'
process.env.DATA_FILE = path.join(os.tmpdir(), 'im-e2e-none.json')
await import(path.join(here, '..', '..', 'api', 'server.js'))
