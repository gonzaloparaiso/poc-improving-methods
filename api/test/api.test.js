// Pruebas de integración de la API (caja negra): arranca server.js contra una
// BD temporal y golpea los endpoints. Sin dependencias (node:test + fetch).
//   Ejecutar:  npm test   (usa node --experimental-sqlite --test test/)
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const { spawn } = require('node:child_process')
const { DatabaseSync } = require('node:sqlite')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const DB = path.join(require('node:os').tmpdir(), `im-apitest-${process.pid}.db`)
const PORT = 3987
const BASE = `http://127.0.0.1:${PORT}/api`
let proc

function hash(p) {
  const salt = crypto.randomBytes(16).toString('hex')
  return `scrypt$${salt}$${crypto.scryptSync(p, salt, 64).toString('hex')}`
}
function rmDb() { for (const e of ['', '-wal', '-shm']) { try { fs.rmSync(DB + e) } catch {} } }

function seed() {
  rmDb()
  const db = new DatabaseSync(DB)
  db.exec(`CREATE TABLE IF NOT EXISTS im_users (ord INTEGER PRIMARY KEY, id TEXT, data TEXT NOT NULL)`)
  db.exec(`CREATE TABLE IF NOT EXISTS im_clientes (ord INTEGER PRIMARY KEY, id TEXT, data TEXT NOT NULL)`)
  db.prepare('INSERT INTO im_users (ord,id,data) VALUES (?,?,?)').run(0, 'u1', JSON.stringify({
    id: 'u1', nombre: 'Admin', apellido: '', email: 'a@a.com', username: 'admin',
    password: hash('admin123'), rol: 'administrador', activo: true, creadoEn: '2024-01-01T00:00:00.000Z',
  }))
  db.prepare('INSERT INTO im_clientes (ord,id,data) VALUES (?,?,?)').run(0, 'c1', JSON.stringify({
    id: 'c1', nombre: 'Cli', apellido: '', email: 'cli@test.com', username: 'cli',
    password: hash('cli123'), activo: true, creadoEn: '2024-01-01T00:00:00.000Z', suscripcionesIds: [],
  }))
  db.close()
}

async function api(method, p, { token, body } = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

before(async () => {
  seed()
  proc = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, DB_FILE: DB, PORT: String(PORT), DATA_FILE: path.join(require('node:os').tmpdir(), `none-${process.pid}.json`) },
    stdio: 'ignore',
  })
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/health'); if (r.ok) return } catch {}
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('La API no arrancó a tiempo')
})

after(() => { if (proc) proc.kill(); rmDb() })

// ── Salud y auth ──────────────────────────────────────────────────────────────
test('health responde ok', async () => {
  const { status, data } = await api('GET', '/health')
  assert.equal(status, 200)
  assert.equal(data.ok, true)
})

test('login con credenciales incorrectas → 401', async () => {
  const { status } = await api('POST', '/login', { body: { username: 'admin', password: 'mal' } })
  assert.equal(status, 401)
})

test('login admin → token y usuario sin contraseña', async () => {
  const { status, data } = await api('POST', '/login', { body: { username: 'admin', password: 'admin123' } })
  assert.equal(status, 200)
  assert.ok(data.token)
  assert.equal(data.user.username, 'admin')
  assert.equal(data.user.password, undefined, 'no debe exponer la contraseña')
})

test('GET /data sin token → 401', async () => {
  const { status } = await api('GET', '/data')
  assert.equal(status, 401)
})

test('GET /data con token devuelve colecciones sin contraseñas', async () => {
  const { data: login } = await api('POST', '/login', { body: { username: 'admin', password: 'admin123' } })
  const { status, data } = await api('GET', '/data', { token: login.token })
  assert.equal(status, 200)
  assert.ok(Array.isArray(data.im_users))
  assert.equal(data.im_users[0].password, undefined)
})

// ── Portal cliente ──────────────────────────────────────────────────────────
test('portal/login cliente → token y cliente', async () => {
  const { status, data } = await api('POST', '/portal/login', { body: { identificador: 'cli@test.com', password: 'cli123' } })
  assert.equal(status, 200)
  assert.ok(data.token)
  assert.equal(data.cliente.email, 'cli@test.com')
})

test('portal/me devuelve solo datos del propio cliente', async () => {
  const { data: login } = await api('POST', '/portal/login', { body: { identificador: 'cli@test.com', password: 'cli123' } })
  const { status, data } = await api('GET', '/portal/me', { token: login.token })
  assert.equal(status, 200)
  assert.equal(data.cliente.id, 'c1')
  assert.ok('im_calendarios' in data)
})

test('un cliente no puede usar endpoints de staff', async () => {
  const { data: login } = await api('POST', '/portal/login', { body: { identificador: 'cli@test.com', password: 'cli123' } })
  const { status } = await api('GET', '/data', { token: login.token })
  assert.equal(status, 403)
})

// ── Permisos de dominio ──────────────────────────────────────────────────────
test('admin crea usuario y el nuevo puede loguear; un coach no puede crear', async () => {
  const { data: admin } = await api('POST', '/login', { body: { username: 'admin', password: 'admin123' } })
  const r = await api('POST', '/users', { token: admin.token, body: { nombre: 'Coach', email: 'coach@t.com', username: 'coach', password: 'Coach123!', rol: 'coach' } })
  assert.equal(r.status, 201)
  const login = await api('POST', '/login', { body: { username: 'coach', password: 'Coach123!' } })
  assert.equal(login.status, 200)
  // El coach NO es admin → no puede crear usuarios
  const denied = await api('POST', '/users', { token: login.data.token, body: { nombre: 'X', email: 'x@t.com', username: 'x', password: 'X1234!ab', rol: 'coach' } })
  assert.equal(denied.status, 403)
})

// ── Política de contraseñas (mayúscula + minúscula + número + especial + 8) ─
test('crear usuario con contraseña débil → 400 explicando qué falta', async () => {
  const { data: admin } = await api('POST', '/login', { body: { username: 'admin', password: 'admin123' } })
  const r = await api('POST', '/users', { token: admin.token, body: { nombre: 'Debil', email: 'debil@t.com', username: 'debil', password: 'abc12345', rol: 'coach' } })
  assert.equal(r.status, 400)
  assert.match(r.data.error, /mayúscula/)
  assert.match(r.data.error, /especial/)
})

// ── Cambio de contraseña del portal ──────────────────────────────────────────
test('cambiar contraseña: actual incorrecta → 400; débil → 400; correcta → 200 y login nuevo', async () => {
  const { data: login } = await api('POST', '/portal/login', { body: { identificador: 'cli@test.com', password: 'cli123' } })
  const bad = await api('POST', '/portal/change-password', { token: login.token, body: { actual: 'nope', nueva: 'Nueva123!' } })
  assert.equal(bad.status, 400)
  const debil = await api('POST', '/portal/change-password', { token: login.token, body: { actual: 'cli123', nueva: 'nueva123' } })
  assert.equal(debil.status, 400)
  const ok = await api('POST', '/portal/change-password', { token: login.token, body: { actual: 'cli123', nueva: 'Nueva123!' } })
  assert.equal(ok.status, 200)
  const relogin = await api('POST', '/portal/login', { body: { identificador: 'cli@test.com', password: 'Nueva123!' } })
  assert.equal(relogin.status, 200)
})

// ── Reset de contraseña olvidada ─────────────────────────────────────────────
test('forgot-password responde 200 exista o no el email (no filtra)', async () => {
  const a = await api('POST', '/portal/forgot-password', { body: { email: 'cli@test.com' } })
  const b = await api('POST', '/portal/forgot-password', { body: { email: 'noexiste@x.com' } })
  assert.equal(a.status, 200)
  assert.equal(b.status, 200)
})

test('reset-password: token inválido → 400; débil → 400; token válido → 200 y login nuevo', async () => {
  const bad = await api('POST', '/portal/reset-password', { body: { token: 'inexistente', nueva: 'Reset123!' } })
  assert.equal(bad.status, 400)
  // Generar un token real (SMTP/Gmail sin configurar en test → solo se guarda en BD)
  await api('POST', '/portal/forgot-password', { body: { email: 'cli@test.com' } })
  const db = new DatabaseSync(DB)
  const row = db.prepare('SELECT token FROM _password_resets WHERE cliente_id = ? ORDER BY expira DESC').get('c1')
  db.close()
  assert.ok(row && row.token, 'debe existir un token de reset en la BD')
  const debil = await api('POST', '/portal/reset-password', { body: { token: row.token, nueva: 'reset123' } })
  assert.equal(debil.status, 400)
  const ok = await api('POST', '/portal/reset-password', { body: { token: row.token, nueva: 'Reset123!' } })
  assert.equal(ok.status, 200)
  const login = await api('POST', '/portal/login', { body: { identificador: 'cli@test.com', password: 'Reset123!' } })
  assert.equal(login.status, 200)
})

// ── Reset de contraseña olvidada del panel de administradores (staff) ───────
test('staff/forgot-password responde 200 exista o no el email (no filtra)', async () => {
  const a = await api('POST', '/staff/forgot-password', { body: { email: 'a@a.com' } })
  const b = await api('POST', '/staff/forgot-password', { body: { email: 'noexiste@x.com' } })
  assert.equal(a.status, 200)
  assert.equal(b.status, 200)
})

test('staff/reset-password: token inválido → 400; token válido → 200 y login nuevo', async () => {
  const bad = await api('POST', '/staff/reset-password', { body: { token: 'inexistente', nueva: 'Reset123!' } })
  assert.equal(bad.status, 400)
  await api('POST', '/staff/forgot-password', { body: { email: 'a@a.com' } })
  const db = new DatabaseSync(DB)
  const row = db.prepare(`SELECT token FROM _password_resets WHERE cliente_id = ? AND tipo = 'staff' ORDER BY expira DESC`).get('u1')
  db.close()
  assert.ok(row && row.token, 'debe existir un token de reset de staff en la BD')
  const ok = await api('POST', '/staff/reset-password', { body: { token: row.token, nueva: 'Reset123!' } })
  assert.equal(ok.status, 200)
  const login = await api('POST', '/login', { body: { username: 'admin', password: 'Reset123!' } })
  assert.equal(login.status, 200)
})

test('un token de reset de cliente no sirve para /staff/reset-password (y viceversa)', async () => {
  await api('POST', '/portal/forgot-password', { body: { email: 'cli@test.com' } })
  const db = new DatabaseSync(DB)
  const row = db.prepare(`SELECT token FROM _password_resets WHERE cliente_id = ? AND tipo = 'cliente' ORDER BY expira DESC`).get('c1')
  db.close()
  const cruzado = await api('POST', '/staff/reset-password', { body: { token: row.token, nueva: 'Xtoken123!' } })
  assert.equal(cruzado.status, 400)
  // el token de cliente sigue siendo válido en su propio endpoint
  const propio = await api('POST', '/portal/reset-password', { body: { token: row.token, nueva: 'Reset123!' } })
  assert.equal(propio.status, 200)
})
