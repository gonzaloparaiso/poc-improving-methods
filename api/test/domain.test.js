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
  const { data } = await api('POST', '/login', { body: { username: 'a@a.com', password: 'admin123' } })
  return data.token
}

before(async () => {
  seed()
  proc = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, DB_FILE: DB, PORT: String(PORT), DATA_FILE: path.join(os.tmpdir(), `none-dom-${process.pid}.json`), TN_RENEW_URL: 'http://127.0.0.1:1/renew', TN_RENEW_SECRET: 'test-secret', TN_WC_WEBHOOK_SECRET: 'wh-secret' },
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

test('KV: Contenido (im_respiraciones / im_movilidad) hace round-trip', async () => {
  const token = await adminToken()
  const respiraciones = [{
    id: 'r1', titulo: 'Respiración de caja', descripcion: 'Inhala, retén, exhala, retén (4-4-4-4)',
    etiquetas: ['concentración'], mediaTipo: null, mediaUrl: '', mediaNombre: '', mediaSize: 0,
    thumbnail: '', creadoEn: new Date().toISOString(),
  }]
  const putR = await api('PUT', '/data/im_respiraciones', { token, body: respiraciones })
  assert.equal(putR.status, 200)
  const getR = await api('GET', '/data/im_respiraciones', { token })
  assert.equal(getR.status, 200)
  assert.equal(getR.data[0].titulo, 'Respiración de caja')

  // im_movilidad empieza vacío pero debe aceptar PUT/GET igualmente
  const putM = await api('PUT', '/data/im_movilidad', { token, body: [] })
  assert.equal(putM.status, 200)
  const getM = await api('GET', '/data/im_movilidad', { token })
  assert.equal(getM.status, 200)
  assert.deepEqual(getM.data, [])
})

test('KV: clave no permitida → 400', async () => {
  const token = await adminToken()
  const r = await api('PUT', '/data/tabla_prohibida', { token, body: [] })
  assert.equal(r.status, 400)
})

test('KV: PUT de im_clientes sin contraseña preserva el hash existente', async () => {
  const token = await adminToken()
  // Crear cliente (tiene contraseña hasheada en el servidor)
  await api('POST', '/clients', { token, body: { nombre: 'Ana', email: 'ana@test.com', username: 'ana', password: 'Ana12345!' } })
  // Releer (sin contraseñas) y volver a guardar tal cual (sin contraseñas)
  const got = await api('GET', '/data/im_clientes', { token })
  assert.ok(got.data.every(c => c.password === undefined), 'GET no debe exponer contraseñas')
  const put = await api('PUT', '/data/im_clientes', { token, body: got.data })
  assert.equal(put.status, 200)
  // El login del portal sigue funcionando → el hash se preservó
  const login = await api('POST', '/portal/login', { body: { identificador: 'ana@test.com', password: 'Ana12345!' } })
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
  await api('POST', '/users', { token, body: { nombre: 'Coach', email: 'co@t.com', username: 'co', password: 'Coach123!', rol: 'coach' } })
  const coach = await api('POST', '/login', { body: { username: 'co@t.com', password: 'Coach123!' } })
  const denied = await api('POST', '/products', { token: coach.data.token, body: { nombre: 'X', tipo: 'recurrente', programas: [] } })
  assert.equal(denied.status, 403)
})

test('crear producto con "Basic" (pseudo-programa reservado): no necesita existir en im_programas y siempre queda sin fecha', async () => {
  const token = await adminToken()
  const BASIC_PROGRAM_ID = '__basic__' // debe coincidir con BASIC_PROGRAM_ID en web/src/types/index.ts y api/server.js
  const r = await api('POST', '/products', {
    token,
    body: {
      nombre: 'Plan con Basic', tipo: 'recurrente',
      programas: [{ programaId: BASIC_PROGRAM_ID, fechaInicio: '2099-01-01' }, { programaId: 'prog1', fechaInicio: null }],
    },
  })
  assert.equal(r.status, 201)
  const basicEntry = r.data.programas.find(p => p.programaId === BASIC_PROGRAM_ID)
  assert.ok(basicEntry, 'debe conservar la entrada de Basic')
  assert.equal(basicEntry.fechaInicio, null, 'Basic nunca lleva fecha, aunque se envíe una')
  const progReal = r.data.programas.find(p => p.programaId === 'prog1')
  assert.ok(progReal.fechaInicio, 'el programa real sí recibe una fecha por defecto')
})

// ── Crear cliente ────────────────────────────────────────────────────────────
test('crear cliente: 201, sin contraseña en la respuesta y con suscripción "Test" automática', async () => {
  const token = await adminToken()
  const r = await api('POST', '/clients', { token, body: { nombre: 'Bea', email: 'bea@test.com', username: 'bea', password: 'Bea12345!' } })
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
  const cli = await api('POST', '/clients', { token, body: { nombre: 'CaT', email: 'cat@test.com', username: 'cat', password: 'Cat12345!' } })
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
  const { data } = await api('POST', '/login', { body: { username: 'a@a.com', password: 'admin123' } })
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

// ── Producto con ID de WooCommerce + renovación ──────────────────────────────
test('crear producto guarda el wcProductId', async () => {
  const token = await adminToken()
  const prod = await api('POST', '/products', { token, body: { nombre: 'Plan WC', tipo: 'recurrente', programas: [{ programaId: 'prog1' }], wcProductId: 27984 } })
  assert.equal(prod.status, 201)
  assert.equal(prod.data.wcProductId, 27984)
})

// ── Webhook de WooCommerce ───────────────────────────────────────────────────
async function postWebhook(rawObj, { topic = 'subscription.updated', secret = 'wh-secret', badSig = false } = {}) {
  const raw = JSON.stringify(rawObj)
  const sig = badSig ? 'firma-mala' : crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('base64')
  const res = await fetch(BASE + '/wc/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-wc-webhook-topic': topic, 'x-wc-webhook-signature': sig },
    body: raw,
  })
  let data = null; try { data = await res.json() } catch {}
  return { status: res.status, data }
}

test('webhook WC: firma inválida → 401', async () => {
  const r = await postWebhook({ id: 1, status: 'active' }, { badSig: true })
  assert.equal(r.status, 401)
})

test('webhook WC: email desconocido → 200 ignorado', async () => {
  const r = await postWebhook({ id: 2, status: 'active', billing: { email: 'nadie@x.com' }, line_items: [{ product_id: 1 }] })
  assert.equal(r.status, 200)
  assert.equal(r.data.ignored, 'cliente_no_en_portal')
})

test('webhook WC: suscripción activa actualiza fechaFin/activa del cliente', async () => {
  const token = await adminToken()
  const prod = await api('POST', '/products', { token, body: { nombre: 'Plan Sync', tipo: 'recurrente', programas: [{ programaId: 'prog1' }], wcProductId: 55555 } })
  await api('POST', '/clients', { token, body: { nombre: 'Web', email: 'webhook@test.com', username: 'webh', password: 'Web12345!' } })
  const r = await postWebhook({
    id: 9001, status: 'active', billing: { email: 'webhook@test.com' },
    line_items: [{ product_id: 55555 }], next_payment_date_gmt: '2030-01-15 00:00:00',
  })
  assert.equal(r.status, 200)
  assert.ok(r.data.productos.includes('Plan Sync'))
  // la suscripción del portal queda activa hasta esa fecha
  const subs = await api('GET', '/data/im_suscripciones_clientes', { token })
  const s = subs.data.find(x => x.catalogoId === prod.data.id)
  assert.ok(s, 'creó la suscripción del portal')
  assert.equal(s.activa, true)
  assert.equal(s.fechaFin, '2030-01-15')
  assert.equal(s.wcSubscriptionId, 9001)
})

test('webhook WC: suscripción cancelada desactiva el acceso', async () => {
  const token = await adminToken()
  await api('POST', '/products', { token, body: { nombre: 'Plan Cancel', tipo: 'recurrente', programas: [{ programaId: 'prog1' }], wcProductId: 55556 } })
  await api('POST', '/clients', { token, body: { nombre: 'WebC', email: 'webhookc@test.com', username: 'webhc', password: 'Web12345!' } })
  // primero activa
  await postWebhook({ id: 9002, status: 'active', billing: { email: 'webhookc@test.com' }, line_items: [{ product_id: 55556 }], next_payment_date_gmt: '2030-01-01 00:00:00' })
  // luego cancelada
  const r = await postWebhook({ id: 9002, status: 'cancelled', billing: { email: 'webhookc@test.com' }, line_items: [{ product_id: 55556 }] })
  assert.equal(r.status, 200)
  const subs = await api('GET', '/data/im_suscripciones_clientes', { token })
  const s = subs.data.find(x => x.wcSubscriptionId === 9002)
  assert.equal(s.activa, false)
})

test('renovar: staff → 403; producto sin wcProductId → 400; producto inexistente → 404', async () => {
  const token = await adminToken()
  // producto SIN wcProductId
  const prod = await api('POST', '/products', { token, body: { nombre: 'Sin WC', tipo: 'recurrente', programas: [{ programaId: 'prog1' }] } })
  const cli = await api('POST', '/clients', { token, body: { nombre: 'Ren', email: 'ren@test.com', username: 'ren', password: 'Ren12345!' } })
  const portal = await api('POST', '/portal/login', { body: { identificador: 'ren@test.com', password: 'Ren12345!' } })

  // staff no puede renovar (es endpoint de cliente)
  const staff = await api('POST', '/portal/renew', { token, body: { catalogoId: prod.data.id } })
  assert.equal(staff.status, 403)

  // cliente + producto sin wcProductId → 400 (antes de llamar a la tienda)
  const sinWc = await api('POST', '/portal/renew', { token: portal.data.token, body: { catalogoId: prod.data.id } })
  assert.equal(sinWc.status, 400)

  // catálogo inexistente → 404
  const noCat = await api('POST', '/portal/renew', { token: portal.data.token, body: { catalogoId: 'no-existe' } })
  assert.equal(noCat.status, 404)
})

// ── Clientes "box": entrenadores con credenciales extra ──────────────────────
test('box: el admin añade un entrenador, este entra con el MISMO acceso, y no un cliente normal', async () => {
  const token = await adminToken()
  const cli = await api('POST', '/clients', {
    token, body: { nombre: 'Box Uno', email: 'box1@test.com', username: 'box1', password: 'Box12345!', esBox: true },
  })
  assert.equal(cli.status, 201)
  assert.equal(cli.data.esBox, true)

  const otro = await api('POST', '/clients', { token, body: { nombre: 'Normal', email: 'normal1@test.com', username: 'n1', password: 'Norm123!' } })
  const denegado = await api('POST', `/clients/${otro.data.id}/credenciales`, { token, body: { email: 'coach1@test.com', password: 'Coach123!' } })
  assert.equal(denegado.status, 403, 'un cliente que no es box no puede tener entrenadores')

  const alta = await api('POST', `/clients/${cli.data.id}/credenciales`, { token, body: { email: 'coach1@test.com', password: 'Coach123!' } })
  assert.equal(alta.status, 201)
  assert.ok(alta.data.credencialesExtra.some(c => c.email === 'coach1@test.com'))
  assert.equal(alta.data.credencialesExtra[0].password, undefined, 'nunca debe exponer el hash')

  const loginCoach = await api('POST', '/portal/login', { body: { identificador: 'coach1@test.com', password: 'Coach123!' } })
  assert.equal(loginCoach.status, 200)
  assert.equal(loginCoach.data.cliente.id, cli.data.id, 'el entrenador entra en la MISMA cuenta del box')

  const me = await api('GET', '/portal/me', { token: loginCoach.data.token })
  assert.equal(me.data.cliente.id, cli.data.id)
})

test('box: email de entrenador duplicado → 409; contraseña débil → 400', async () => {
  const token = await adminToken()
  const cli = await api('POST', '/clients', { token, body: { nombre: 'Box Dos', email: 'box2@test.com', username: 'box2', password: 'Box12345!', esBox: true } })
  await api('POST', `/clients/${cli.data.id}/credenciales`, { token, body: { email: 'coach2@test.com', password: 'Coach123!' } })

  const dup = await api('POST', `/clients/${cli.data.id}/credenciales`, { token, body: { email: 'coach2@test.com', password: 'Otra123!' } })
  assert.equal(dup.status, 409)

  const dupPrincipal = await api('POST', `/clients/${cli.data.id}/credenciales`, { token, body: { email: 'box2@test.com', password: 'Otra123!' } })
  assert.equal(dupPrincipal.status, 409, 'tampoco puede coincidir con el email principal de otro/mismo cliente')

  const debil = await api('POST', `/clients/${cli.data.id}/credenciales`, { token, body: { email: 'coach3@test.com', password: 'abc12345' } })
  assert.equal(debil.status, 400)
})

test('box: eliminar un entrenador le quita el acceso inmediatamente', async () => {
  const token = await adminToken()
  const cli = await api('POST', '/clients', { token, body: { nombre: 'Box Tres', email: 'box3@test.com', username: 'box3', password: 'Box12345!', esBox: true } })
  const alta = await api('POST', `/clients/${cli.data.id}/credenciales`, { token, body: { email: 'coach4@test.com', password: 'Coach123!' } })
  const credId = alta.data.credencialesExtra[0].id

  const antes = await api('POST', '/portal/login', { body: { identificador: 'coach4@test.com', password: 'Coach123!' } })
  assert.equal(antes.status, 200)

  const del = await api('DELETE', `/clients/${cli.data.id}/credenciales/${credId}`, { token })
  assert.equal(del.status, 200)
  assert.equal((del.data.credencialesExtra || []).length, 0)

  const despues = await api('POST', '/portal/login', { body: { identificador: 'coach4@test.com', password: 'Coach123!' } })
  assert.equal(despues.status, 401)
})

test('box: un entrenador puede autogestionar entrenadores (mismos permisos) y cambiar SU propia contraseña', async () => {
  const token = await adminToken()
  const cli = await api('POST', '/clients', { token, body: { nombre: 'Box Cuatro', email: 'box4@test.com', username: 'box4', password: 'Box12345!', esBox: true } })
  await api('POST', `/clients/${cli.data.id}/credenciales`, { token, body: { email: 'coach5@test.com', password: 'Coach123!' } })
  const loginCoach = await api('POST', '/portal/login', { body: { identificador: 'coach5@test.com', password: 'Coach123!' } })
  const coachToken = loginCoach.data.token

  // El propio entrenador da de alta a otro entrenador desde el portal
  const auto = await api('POST', '/portal/credenciales', { token: coachToken, body: { email: 'coach6@test.com', password: 'Coach123!' } })
  assert.equal(auto.status, 201)
  assert.equal(auto.data.credencialesExtra.length, 2)

  // Cambia SU propia contraseña (no la del cliente principal del box)
  const cambio = await api('POST', '/portal/change-password', { token: coachToken, body: { actual: 'Coach123!', nueva: 'NuevaCoach1!' } })
  assert.equal(cambio.status, 200)
  const reloginCoach = await api('POST', '/portal/login', { body: { identificador: 'coach5@test.com', password: 'NuevaCoach1!' } })
  assert.equal(reloginCoach.status, 200)
  // La cuenta principal del box sigue con su contraseña original, intacta
  const loginPrincipal = await api('POST', '/portal/login', { body: { identificador: 'box4@test.com', password: 'Box12345!' } })
  assert.equal(loginPrincipal.status, 200)

  // Un cliente normal (no cliente-session del box) no puede borrar entrenadores ajenos vía self-service
  const credId = auto.data.credencialesExtra[1].id
  const otroClienteLogin = await api('POST', '/clients', { token, body: { nombre: 'Normal2', email: 'normal2@test.com', username: 'n2', password: 'Norm123!' } })
  const loginNormal = await api('POST', '/portal/login', { body: { identificador: 'normal2@test.com', password: 'Norm123!' } })
  const borradoAjeno = await api('DELETE', `/portal/credenciales/${credId}`, { token: loginNormal.data.token })
  // Borra dentro de SU PROPIO cliente (que no tiene esa credencial) → queda como si no existiera, no debe afectar al otro box
  assert.equal(borradoAjeno.status, 200)
  const meBox = await api('GET', '/portal/me', { token: coachToken })
  assert.ok(meBox.data.cliente.credencialesExtra.some(c => c.id === credId), 'el entrenador del OTRO cliente no debe verse afectado')
  void otroClienteLogin
})

// ── Webhook de WooCommerce: pedidos (alta/renovación de TN BOX) ──────────────
function ordenTnBox(overrides = {}) {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 1e6),
    status: 'completed',
    created_via: 'checkout',
    billing: { email: 'nadie@x.com', first_name: 'Nadie', last_name: '', phone: '' },
    line_items: [{ name: 'TN BOX' }],
    ...overrides,
  }
}

test('webhook WC (order): cliente nuevo compra TN BOX → se crea sin contraseña y con la suscripción asignada', async () => {
  const token = await adminToken()
  await api('POST', '/products', { token, body: { nombre: 'TN BOX', tipo: 'recurrente', programas: [] } })
  const email = 'altanueva@test.com'
  const r = await postWebhook(ordenTnBox({ billing: { email, first_name: 'Alta', last_name: 'Nueva', phone: '600' } }), { topic: 'order.created' })
  assert.equal(r.status, 200)
  assert.equal(r.data.clienteNuevo, true)
  assert.equal(r.data.altaComercial, true)

  const clientes = await api('GET', '/data/im_clientes', { token })
  const cli = clientes.data.find(c => c.email === email)
  assert.ok(cli, 'el cliente se creó')
  assert.equal(cli.password, undefined, 'la API nunca expone la contraseña')

  const subs = await api('GET', '/data/im_suscripciones_clientes', { token })
  const susc = subs.data.find(s => s.clienteId === cli.id)
  assert.ok(susc, 'se asignó la suscripción TN BOX')
  assert.equal(susc.activa, true)
})

test('webhook WC (order): pedido sin pagar (status != completed) no crea nada y se guarda para reintentar', async () => {
  const token = await adminToken()
  const email = 'pendiente@test.com'
  const r = await postWebhook(ordenTnBox({ id: 424242, status: 'pending', billing: { email, first_name: 'Pend', last_name: '', phone: '' } }), { topic: 'order.created' })
  assert.equal(r.status, 200)
  assert.equal(r.data.ignored, 'pago_no_confirmado')

  const clientes = await api('GET', '/data/im_clientes', { token })
  assert.ok(!clientes.data.some(c => c.email === email), 'no debe crear cliente mientras el pago no esté confirmado')

  const dbCheck = new DatabaseSync(DB)
  const row = dbCheck.prepare(`SELECT * FROM _wc_pedidos_pendientes WHERE wc_order_id = ?`).get('424242')
  dbCheck.close()
  assert.ok(row, 'el pedido pendiente queda guardado para reintentar')
  assert.equal(row.motivo, 'status_pending')
})

test('webhook WC (order): cliente existente compra TN BOX por primera vez → asigna suscripción sin tocar su contraseña', async () => {
  const token = await adminToken()
  const cli = await api('POST', '/clients', { token, body: { nombre: 'Ya Existo', email: 'yaexisto@test.com', username: 'yaexisto', password: 'YaExisto1!' } })
  const r = await postWebhook(ordenTnBox({ billing: { email: 'yaexisto@test.com', first_name: 'Ya', last_name: 'Existo', phone: '' } }), { topic: 'order.created' })
  assert.equal(r.status, 200)
  assert.equal(r.data.clienteNuevo, false)
  assert.equal(r.data.altaComercial, true)
  assert.equal(r.data.cliente, cli.data.id)

  // La contraseña original sigue funcionando (no se ha tocado)
  const login = await api('POST', '/portal/login', { body: { identificador: 'yaexisto@test.com', password: 'YaExisto1!' } })
  assert.equal(login.status, 200)
})

test('webhook WC (order): renovación (created_via=subscription) de un cliente que ya tenía TN BOX solo actualiza la fecha de validez', async () => {
  const token = await adminToken()
  const email = 'renueva@test.com'
  await api('POST', '/clients', { token, body: { nombre: 'Renueva', email, username: 'renueva', password: 'Renueva1!' } })
  const primera = await postWebhook(ordenTnBox({ billing: { email, first_name: 'Renueva', last_name: '', phone: '' } }), { topic: 'order.created' })
  assert.equal(primera.data.altaComercial, true) // primera compra: sí es alta comercial

  const productos = await api('GET', '/data/im_suscripciones_catalogo', { token })
  const tnBoxId = productos.data.find(p => p.nombre === 'TN BOX').id
  const clientes = await api('GET', '/data/im_clientes', { token })
  const cli = clientes.data.find(c => c.email === email)
  const subsAntes = await api('GET', '/data/im_suscripciones_clientes', { token })
  const suscAntes = subsAntes.data.find(s => s.clienteId === cli.id && s.catalogoId === tnBoxId)
  assert.ok(suscAntes, 'la primera compra creó la suscripción TN BOX')

  const renovacion = await postWebhook(ordenTnBox({
    created_via: 'subscription', billing: { email, first_name: 'Renueva', last_name: '', phone: '' },
  }), { topic: 'order.created' })
  assert.equal(renovacion.status, 200)
  assert.equal(renovacion.data.clienteNuevo, false)
  assert.equal(renovacion.data.altaComercial, false, 'una renovación no es alta comercial: no se reenvía bienvenida')

  const subsDespues = await api('GET', '/data/im_suscripciones_clientes', { token })
  const suscDespues = subsDespues.data.filter(s => s.clienteId === cli.id && s.catalogoId === tnBoxId)
  assert.equal(suscDespues.length, 1, 'no debe duplicar la suscripción TN BOX, solo actualizarla')
  assert.equal(suscDespues[0].id, suscAntes.id)
})
