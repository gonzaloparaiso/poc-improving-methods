// Arranca la API real contra una BD temporal sembrada, para los tests E2E.
// Se lanza con: node --experimental-sqlite e2e/api-server.mjs
// Siembra: admin, un cliente SIN plan (estado vacío) y un cliente CON plan
// (programa + producto + suscripción + calendario) para probar la vista del portal.
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
const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// Lunes de la semana actual (para que el calendario incluya "hoy")
const hoy = new Date(); const dow = (hoy.getDay() + 6) % 7
const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - dow)
const lunesISO = toISO(lunes)
const dia = i => { const d = new Date(lunes); d.setDate(lunes.getDate() + i); return toISO(d) }

const bloque = {
  id: 'b1', nombre: 'WOD del día', instrucciones: 'Calienta bien', notas: '', cronometro: 'AMRAP 12\'',
  ejercicios: [{ id: 'eb1', ejercicioId: 'e1', series: '3', reps: '10', descanso: '60s', notas: '' }],
  esPlantilla: false, creadoEn: '2024-01-01T00:00:00.000Z',
}
const dias = Array.from({ length: 7 }, (_, i) => ({ fecha: dia(i), diaSemana: i, bloques: i === 0 ? [JSON.parse(JSON.stringify(bloque))] : [] }))

const db = new DatabaseSync(DB)
for (const t of ['im_users', 'im_clientes', 'im_ejercicios', 'im_programas', 'im_suscripciones_catalogo', 'im_suscripciones_clientes', 'im_calendarios']) {
  db.exec(`CREATE TABLE IF NOT EXISTS ${t} (ord INTEGER PRIMARY KEY, id TEXT, data TEXT NOT NULL)`)
}
const ins = (t, ord, id, obj) => db.prepare(`INSERT INTO ${t} (ord,id,data) VALUES (?,?,?)`).run(ord, id, JSON.stringify(obj))

// OJO: '__basic__' debe coincidir literalmente con BASIC_PROGRAM_ID (web/src/types/index.ts)
const BASIC_PROGRAM_ID = '__basic__'

ins('im_users', 0, 'u1', { id: 'u1', nombre: 'Admin', apellido: '', email: 'a@a.com', username: 'admin', password: hash('admin123'), rol: 'administrador', activo: true, creadoEn: '2024-01-01T00:00:00.000Z' })
ins('im_clientes', 0, 'c1', { id: 'c1', nombre: 'Cliente', apellido: 'Prueba', email: 'cliente@test.com', username: 'cli', password: hash('cli123'), activo: true, creadoEn: '2024-01-01T00:00:00.000Z', suscripcionesIds: [] })
ins('im_clientes', 1, 'c2', { id: 'c2', nombre: 'Conplan', apellido: 'Test', email: 'conplan@test.com', username: 'conplan', password: hash('plan123'), activo: true, creadoEn: '2024-01-01T00:00:00.000Z', suscripcionesIds: [] })
ins('im_clientes', 2, 'c3', { id: 'c3', nombre: 'Basico', apellido: 'Test', email: 'basic@test.com', username: 'basico', password: hash('basic123'), activo: true, creadoEn: '2024-01-01T00:00:00.000Z', suscripcionesIds: [] })
ins('im_ejercicios', 0, 'e1', { id: 'e1', nombre: 'Sentadilla', explicacion: 'Baja recto', video: '' })
ins('im_programas', 0, 'p1', { id: 'p1', nombre: 'Programa Test', descripcion: '', creadoEn: '2024-01-01T00:00:00.000Z', semanas: [{ id: 'w1', numero: 1, dias: dias.map(d => ({ bloques: d.bloques })) }] })
// cat1: combina un programa real con "Basic" (comprueba que son combinables)
ins('im_suscripciones_catalogo', 0, 'cat1', { id: 'cat1', nombre: 'Plan Test', tipo: 'recurrente', precioMensual: 30, primerMesPrueba: false, programas: [{ programaId: 'p1', fechaInicio: lunesISO }, { programaId: BASIC_PROGRAM_ID, fechaInicio: null }], creadoEn: '2024-01-01T00:00:00.000Z' })
// catBasic: SOLO "Basic" (sin programa real, sin calendario)
ins('im_suscripciones_catalogo', 1, 'catBasic', { id: 'catBasic', nombre: 'Plan Basic', tipo: 'recurrente', precioMensual: 10, primerMesPrueba: false, programas: [{ programaId: BASIC_PROGRAM_ID, fechaInicio: null }], creadoEn: '2024-01-01T00:00:00.000Z' })
ins('im_suscripciones_clientes', 0, 's1', { id: 's1', catalogoId: 'cat1', clienteId: 'c2', fechaInicio: '2020-01-01T00:00:00.000Z', fechaFin: '2999-12-31', activa: true })
ins('im_suscripciones_clientes', 1, 's2', { id: 's2', catalogoId: 'catBasic', clienteId: 'c3', fechaInicio: '2020-01-01T00:00:00.000Z', fechaFin: '2999-12-31', activa: true })
ins('im_calendarios', 0, 'cal1', { id: 'cal1', clienteId: 'c2', suscripcionClienteId: 's1', programaId: 'p1', programaNombre: 'Programa Test', fechaInicio: lunesISO, semanas: [{ id: 'cw1', numero: 1, fechaLunes: lunesISO, dias }], creadoEn: '2024-01-01T00:00:00.000Z', colorKey: 'yellow' })
db.close()

process.env.DB_FILE = DB
process.env.PORT = '3001'
process.env.DATA_FILE = path.join(os.tmpdir(), 'im-e2e-none.json')
await import(path.join(here, '..', '..', 'api', 'server.js'))
