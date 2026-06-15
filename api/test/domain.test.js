// Pruebas de la lógica de dominio: KV + preservación de contraseñas, crear
// producto/cliente, asignar suscripción (genera calendarios), logout, 404.
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const { spawn } = require('node:child_process')
const { DatabaseSync } = require('node:sqlite')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const DB = path.join(os.tmpdir(), `im-domtest-${process.pid}.db`)
const PORT = 3988
const BASE = `http://127.0.0.1:${PORT}/api`
let proc

const hash = (p) => { const s = crypto.randomBytes(16).toString('hex'); return `scrypt$${s}$${crypto.scryptSync(p, s, 64).toString('hex')}` }
const rmDb = () => { for (const e of ['', '-wal', '-shm']) { try { fs.rmSync(DB + e) } catch {} } }

function seed() {
  rmDb()
  const db = new DatabaseSync(DB)
  db.exec('CREATE TABLE IF NOT EXISTS im_users (ord INTEGER PRIMARY KEY, id TEXT, data TEXT NOT NULL)')
  db.exec('CREATE TABLE IF NOT EXISTS im_programas (ord INTEGER PRIMARY KEY, id TEXT, data TEXT NOT NULL)')
  db.prepare('INSERT INTO im_users (ord,id,data) VALUES (?,?,?)').run(0, 'u1', JSON.stringify({
    id: 'u1', nombre: 'Admin', apellido: '', email: 'a@a.com', username: 'admin',
    password: hash('admin123'), rol: 'administrador', activo: true, creadoEn: '2024-01-01T00:00:00.000Z',
  }))
  // Programa mínimo con una semana de 7 días (para generar calendarios al asignar)
  const dias = Array.from({ length: 7 }, () => ({ bloques: [] }))
  db.prepare('INSERT INTO im_programas (ord,id,data) VALUES (?,?,?)').run(0, 'prog1', JSON.stringify({
    id: 'prog1', nombre: 'Programa Base', descripcion: '', semanas: [{ id: 'w1', numero: 1, dias }], creadoEn: '2024-01-01T00:00:00.000Z',
  }))
  db.close()
}

async function api(method, p, { token, body } = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null; try { data = await res.json() } catch {}
  return { status: res.status, data }
}
async function adminToken() {
  const { data } = await api('POST', '/login', { body: { username: 'admin', password: 'admin123' } })
  return data.token
}

before(async () => {
  seed()
  proc = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, DB_FILE: DB, PORT: String(PORT), DATA_FILE: path.join(os.tmpdir(), `none-dom-${process.pid}.json`) },
    stdio: 'ignore',
  })
  for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + '/health'); if (r.ok) return } catch {} await new Promise(r => setTimeout(r, 100)) }
  throw new Error('La API no arrancó')
})
after(() => { if (proc) proc.kill(); rmDb() })

// ── KV genérico ──────────────────────────────────────────────────────────────
test('KV: PUT y GET de una colección hace round-trip', async () => {
  const token = await adminToken()
  const ejercicios = [{ id: 'e1', nombre: 'Sentadilla', explicacion: '', video: '' }]
  const put = await api('PUT', '/data/im_ejercicios', { token, body: ejercicios })
  assert.equal(put.status, 200)
  const get = await api('GET', '/data/im_ejercicios', { token })
  assert.equal(get.status, 200)
  assert.equal(get.data.length, 1)
  assert.equal(get.data[0].nombre, 'Sentadilla')
})

test('KV: clave no permitida → 400', async () => {
  const token = await adminToken()
  const r = await api('PUT', '/data/tabla_prohibida', { token, body: [] })
  assert.equal(r.status, 400)
})

test('KV: PUT de im_clientes sin contraseña preserva el hash existente', async () => {
  const token = await adminToken()
  // Crear cliente (tiene contraseña hasheada en el servidor)
  await api('POST', '/clients', { token, body: { nombre: 'Ana', email: 'ana@test.com', username: 'ana', password: 'ana12345' } })
  // Releer (sin contraseñas) y volver a guardar tal cual (sin contraseñas)
  const got = await api('GET', '/data/im_clientes', { token })
  assert.ok(got.data.every(c => c.password === undefined), 'GET no debe exponer contraseñas')
  const put = await api('PUT', '/data/im_clientes', { token, body: got.data })
  assert.equal(put.status, 200)
  // El login del portal sigue funcionando → el hash se preservó
  const login = await api('POST', '/portal/login', { body: { identificador: 'ana@test.com', password: 'ana12345' } })
  assert.equal(login.status, 200)
})

// ── Crear producto ───────────────────────────────────────────────────────────
test('crear producto: válido → 201; programa inexistente → 400; no-admin → 403', async () => {
  const token = await adminToken()
  const ok = await api('POST', '/products', { token, body: { nombre: 'Plan A', tipo: 'recurrente', precioMensual: 30, primerMesPrueba: false, programas: [{ programaId: 'prog1', fechaInicio: null }] } })
  assert.equal(ok.status, 201)
  assert.equal(ok.data.nombre, 'Plan A')

  const bad = await api('POST', '/products', { token, body: { nombre: 'Plan B', tipo: 'recurrente', programas: [{ programaId: 'noexiste', fechaInicio: null }] } })
  assert.equal(bad.status, 400)

  // crear un coach y comprobar que NO puede crear productos
  await api('POST', '/users', { token, body: { nombre: 'Coach', email: 'co@t.com', username: 'co', password: 'co123456', rol: 'coach' } })
  const coach = await api('POST', '/login', { body: { username: 'co', password: 'co123456' } })
  const denied = await api('POST', '/products', { token: coach.data.token, body: { nombre: 'X', tipo: 'recurrente', programas: [] } })
  assert.equal(denied.status, 403)
})

// ── Crear cliente ────────────────────────────────────────────────────────────
test('crear cliente: 201, sin contraseña en la respuesta y con suscripción "Test" automática', async () => {
  const token = await adminToken()
  const r = await api('POST', '/clients', { token, body: { nombre: 'Bea', email: 'bea@test.com', username: 'bea', password: 'bea12345' } })
  assert.equal(r.status, 201)
  assert.equal(r.data.password, undefined)
  assert.equal(r.data.email, 'bea@test.com')
  // Debe existir un catálogo "Test" y una suscripción para el cliente
  const cat = await api('GET', '/data/im_suscripciones_catalogo', { token })
  assert.ok(cat.data.some(c => c.nombre === 'Test'), 'catálogo Test creado')
  const subs = await api('GET', '/data/im_suscripciones_clientes', { token })
  assert.ok(subs.data.some(s => s.clienteId === r.data.id), 'suscripción Test asignada al cliente')
})

// ── Asignar suscripción → genera calendarios ─────────────────────────────────
test('asignar producto a cliente crea suscripción y genera calendario', async () => {
  const token = await adminToken()
  const prod = await api('POST', '/products', { token, body: { nombre: 'Plan WOD', tipo: 'recurrente', precioMensual: 40, primerMesPrueba: false, programas: [{ programaId: 'prog1', fechaInicio: null }] } })
  const cli = await api('POST', '/clients', { token, body: { nombre: 'CaT', email: 'cat@test.com', username: 'cat', password: 'cat12345' } })
  const assign = await api('POST', `/clients/${cli.data.id}/subscriptions`, { token, body: { catalogoId: prod.data.id } })
  assert.equal(assign.status, 201)
  // Debe haberse generado al menos un calendario para ese cliente con ese programa
  const cals = await api('GET', '/data/im_calendarios', { token })
  const suyos = cals.data.filter(c => c.clienteId === cli.data.id)
  assert.ok(suyos.length >= 1, 'se generó un calendario')
  assert.equal(suyos[0].programaId, 'prog1')
  assert.ok(Array.isArray(suyos[0].semanas) && suyos[0].semanas.length === 1)
})

// ── Sesión ───────────────────────────────────────────────────────────────────
test('logout invalida el token', async () => {
  const { data } = await api('POST', '/login', { body: { username: 'admin', password: 'admin123' } })
  const out = await api('POST', '/logout', { token: data.token })
  assert.equal(out.status, 200)
  const after = await api('GET', '/data', { token: data.token })
  assert.equal(after.status, 401)
})

test('ruta desconocida → 404', async () => {
  const token = await adminToken()
  const r = await api('GET', '/no-existe', { token })
  assert.equal(r.status, 404)
})
