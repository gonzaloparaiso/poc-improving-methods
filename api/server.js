// API de Improving Methods — SQLite + autenticación por token.
// Arrancar con:  node --experimental-sqlite server.js
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { DatabaseSync } = require('node:sqlite')

const PORT = process.env.PORT || 3001
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db')
const JSON_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json')
const MAX_BODY = 30 * 1024 * 1024
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000 // 30 días

const ARRAY_KEYS = [
  'im_users', 'im_clientes', 'im_suscripciones_catalogo', 'im_suscripciones_clientes',
  'im_calendarios', 'im_programas', 'im_plantillas', 'im_ejercicios',
]
const OBJECT_KEY = 'im_tareas_completadas'
const ALLOWED_KEYS = new Set([...ARRAY_KEYS, OBJECT_KEY])
const KEYS_CON_PASSWORD = new Set(['im_users', 'im_clientes'])

const ROLES = ['administrador', 'head_coach', 'coach']
const TIPOS = ['recurrente', 'unico']
const PALETA = ['yellow', 'blue', 'purple', 'green', 'orange']

// ── Base de datos ───────────────────────────────────────────────────────────
const db = new DatabaseSync(DB_FILE)
db.exec('PRAGMA journal_mode = WAL;')
for (const k of ARRAY_KEYS) db.exec(`CREATE TABLE IF NOT EXISTS "${k}" (ord INTEGER PRIMARY KEY, id TEXT, data TEXT NOT NULL)`)
db.exec(`CREATE TABLE IF NOT EXISTS "${OBJECT_KEY}" (tarea_id TEXT PRIMARY KEY, completado_en TEXT NOT NULL)`)
db.exec(`CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)`)
db.exec(`CREATE TABLE IF NOT EXISTS _sessions (token TEXT PRIMARY KEY, tipo TEXT, sujeto_id TEXT, rol TEXT, expira INTEGER)`)

function getCollection(key) {
  if (key === OBJECT_KEY) {
    const obj = {}
    for (const r of db.prepare(`SELECT tarea_id, completado_en FROM "${OBJECT_KEY}"`).all()) obj[r.tarea_id] = r.completado_en
    return obj
  }
  return db.prepare(`SELECT data FROM "${key}" ORDER BY ord`).all().map(r => JSON.parse(r.data))
}
function setCollection(key, value) {
  if (key === OBJECT_KEY) {
    const ins = db.prepare(`INSERT INTO "${OBJECT_KEY}" (tarea_id, completado_en) VALUES (?, ?)`)
    db.exec('BEGIN'); try { db.exec(`DELETE FROM "${OBJECT_KEY}"`); for (const [k, v] of Object.entries(value || {})) ins.run(k, String(v)); db.exec('COMMIT') } catch (e) { db.exec('ROLLBACK'); throw e }
    return
  }
  const arr = Array.isArray(value) ? value : []
  const ins = db.prepare(`INSERT INTO "${key}" (ord, id, data) VALUES (?, ?, ?)`)
  db.exec('BEGIN'); try { db.exec(`DELETE FROM "${key}"`); arr.forEach((el, i) => ins.run(i, el && el.id != null ? String(el.id) : null, JSON.stringify(el))); db.exec('COMMIT') } catch (e) { db.exec('ROLLBACK'); throw e }
}

// ── Contraseñas (scrypt) ──────────────────────────────────────────────────────
function isHashed(p) { return typeof p === 'string' && p.startsWith('scrypt$') }
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(plain), salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}
function verifyPassword(plain, stored) {
  if (!stored) return false
  if (!isHashed(stored)) return String(plain) === String(stored) // fallback legacy
  const [, salt, hash] = stored.split('$')
  const test = crypto.scryptSync(String(plain), salt, 64).toString('hex')
  const a = Buffer.from(hash, 'hex'), b = Buffer.from(test, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
const sinPassword = (o) => { if (!o) return o; const { password, ...rest } = o; return rest }
const sinPasswords = (arr) => Array.isArray(arr) ? arr.map(sinPassword) : arr

/** Para PUT de im_users/im_clientes: hashea contraseñas nuevas y preserva las existentes
 *  cuando vienen vacías (el frontend nunca recibe la contraseña, así que no la reenvía). */
function preservarPasswords(key, incoming) {
  if (!Array.isArray(incoming)) return incoming
  const existentes = Object.fromEntries(getCollection(key).map(r => [r.id, r.password]))
  return incoming.map(r => {
    if (!r) return r
    if (r.password && !isHashed(r.password)) return { ...r, password: hashPassword(r.password) }
    if (!r.password) { const prev = existentes[r.id]; return prev ? { ...r, password: prev } : r }
    return r
  })
}

function getAll() {
  const out = {}
  for (const k of [...ARRAY_KEYS, OBJECT_KEY]) {
    let v = getCollection(k)
    if (KEYS_CON_PASSWORD.has(k)) v = sinPasswords(v)
    const vacio = Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0
    if (!vacio) out[k] = v
  }
  return out
}

// ── Migración inicial + hash de contraseñas existentes ────────────────────────
if (!db.prepare(`SELECT v FROM _meta WHERE k='migrated'`).get()) {
  if (fs.existsSync(JSON_FILE)) {
    try {
      const json = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'))
      let n = 0
      for (const k of [...ARRAY_KEYS, OBJECT_KEY]) if (json[k] != null) { setCollection(k, json[k]); n++ }
      console.log(`Migración: ${n} colecciones → SQLite`)
    } catch (e) { console.error('Error migrando:', e) }
  }
  db.prepare(`INSERT OR REPLACE INTO _meta (k,v) VALUES ('migrated','1')`).run()
}
// Hashear cualquier contraseña en texto plano (idempotente)
if (!db.prepare(`SELECT v FROM _meta WHERE k='pwhashed'`).get()) {
  for (const k of KEYS_CON_PASSWORD) {
    const arr = getCollection(k); let changed = false
    for (const r of arr) if (r && r.password && !isHashed(r.password)) { r.password = hashPassword(r.password); changed = true }
    if (changed) { setCollection(k, arr); console.log(`Contraseñas hasheadas en ${k}`) }
  }
  db.prepare(`INSERT OR REPLACE INTO _meta (k,v) VALUES ('pwhashed','1')`).run()
}
console.log(`SQLite listo en ${DB_FILE}`)

// ── Sesiones ──────────────────────────────────────────────────────────────────
function crearSesion(tipo, sujetoId, rol) {
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare(`INSERT INTO _sessions (token, tipo, sujeto_id, rol, expira) VALUES (?,?,?,?,?)`)
    .run(token, tipo, sujetoId, rol || '', Date.now() + SESSION_TTL)
  return token
}
function getSesion(req) {
  const h = req.headers['authorization'] || ''
  const m = h.match(/^Bearer (.+)$/)
  if (!m) return null
  const row = db.prepare(`SELECT * FROM _sessions WHERE token = ?`).get(m[1])
  if (!row) return null
  if (row.expira < Date.now()) { db.prepare(`DELETE FROM _sessions WHERE token = ?`).run(m[1]); return null }
  return row
}

// ── Helpers de dominio ────────────────────────────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9) }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function siguienteLunes() { const h = new Date(); h.setHours(0, 0, 0, 0); const dow = h.getDay(); const d = new Date(h); d.setDate(h.getDate() + (dow === 1 ? 0 : (1 - dow + 7) % 7)); return d.toISOString().split('T')[0] }
function addDays(iso, n) { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0] }
function instanciarPrograma(programa, fechaInicio) {
  return programa.semanas.map((semana, si) => {
    const fechaLunes = addDays(fechaInicio, si * 7)
    return { id: genId(), numero: semana.numero, fechaLunes, dias: semana.dias.map((dia, di) => ({ fecha: addDays(fechaLunes, di), diaSemana: di, bloques: JSON.parse(JSON.stringify(dia.bloques || [])) })) }
  })
}
function generarCalendarios(cliente, cat, suscClienteId, programas, calendariosActuales, fechaOverride) {
  const hoy = todayISO(); const nuevos = []
  const delCliente = calendariosActuales.filter(c => c.clienteId === cliente.id)
  const mismaSusc = delCliente.find(c => c.suscripcionClienteId === suscClienteId)
  const colorKey = mismaSusc?.colorKey ?? PALETA[[...new Set(delCliente.map(c => c.suscripcionClienteId))].length % PALETA.length]
  for (const pa of (cat.programas || [])) {
    const programa = programas.find(p => p.id === pa.programaId); if (!programa) continue
    let fecha
    if (fechaOverride) fecha = fechaOverride
    else if (cat.tipo === 'recurrente') {
      if (!pa.fechaInicio) fecha = siguienteLunes()
      else { if (addDays(pa.fechaInicio, programa.semanas.length * 7 - 1) < hoy) continue; fecha = pa.fechaInicio }
    } else fecha = siguienteLunes()
    nuevos.push({ id: genId(), clienteId: cliente.id, suscripcionClienteId: suscClienteId, programaId: programa.id, programaNombre: programa.nombre, fechaInicio: fecha, semanas: instanciarPrograma(programa, fecha), creadoEn: new Date().toISOString(), colorKey, adjuntos: programa.adjuntos ? JSON.parse(JSON.stringify(programa.adjuntos)) : [] })
  }
  return nuevos
}
function httpErr(status, msg) { const e = new Error(msg); e.status = status; return e }

// ── Handlers de dominio ───────────────────────────────────────────────────────
const domain = {
  listUsers: () => sinPasswords(getCollection('im_users')),
  createUser: (b) => {
    if (!b.nombre || !String(b.nombre).trim()) throw httpErr(400, 'El nombre es obligatorio')
    if (!b.username || !String(b.username).trim()) throw httpErr(400, 'El usuario es obligatorio')
    if (!b.password) throw httpErr(400, 'La contraseña es obligatoria')
    const rol = b.rol || 'coach'
    if (!ROLES.includes(rol)) throw httpErr(400, `Rol inválido (${ROLES.join(', ')})`)
    const users = getCollection('im_users')
    if (users.some(u => u.username === String(b.username).trim())) throw httpErr(409, 'Ese usuario ya existe')
    const nuevo = { id: genId(), nombre: String(b.nombre).trim(), apellido: (b.apellido || '').trim(), email: (b.email || '').trim(), username: String(b.username).trim(), password: hashPassword(b.password), rol, activo: b.activo !== false, creadoEn: new Date().toISOString(), bajaEn: null }
    setCollection('im_users', [...users, nuevo])
    return sinPassword(nuevo)
  },
  listProducts: () => getCollection('im_suscripciones_catalogo'),
  createProduct: (b) => {
    if (!b.nombre || !String(b.nombre).trim()) throw httpErr(400, 'El nombre es obligatorio')
    const tipo = b.tipo || 'recurrente'
    if (!TIPOS.includes(tipo)) throw httpErr(400, `Tipo inválido (${TIPOS.join(', ')})`)
    const disponibles = getCollection('im_programas')
    const programas = Array.isArray(b.programas) ? b.programas.map(p => {
      if (!disponibles.some(pr => pr.id === p.programaId)) throw httpErr(400, `Programa no encontrado: ${p.programaId}`)
      return { programaId: p.programaId, fechaInicio: tipo === 'recurrente' ? (p.fechaInicio || siguienteLunes()) : null }
    }) : []
    const cat = getCollection('im_suscripciones_catalogo')
    const nuevo = { id: genId(), nombre: String(b.nombre).trim(), tipo, programas, precioMensual: Number(b.precioMensual) || 0, primerMesPrueba: b.primerMesPrueba === true, creadoEn: new Date().toISOString() }
    setCollection('im_suscripciones_catalogo', [...cat, nuevo])
    return nuevo
  },
  listClients: () => sinPasswords(getCollection('im_clientes')),
  createClient: (b) => {
    if (!b.nombre || !String(b.nombre).trim()) throw httpErr(400, 'El nombre es obligatorio')
    if (!b.email || !String(b.email).trim()) throw httpErr(400, 'El email es obligatorio')
    if (!b.username || !String(b.username).trim()) throw httpErr(400, 'El usuario es obligatorio')
    if (!b.password) throw httpErr(400, 'La contraseña es obligatoria')
    const clientes = getCollection('im_clientes')
    if (clientes.some(c => c.email === String(b.email).trim())) throw httpErr(409, 'Ese email ya está registrado')
    if (clientes.some(c => c.username === String(b.username).trim())) throw httpErr(409, 'Ese usuario ya existe')
    const nuevo = { id: genId(), nombre: String(b.nombre).trim(), apellido: (b.apellido || '').trim(), email: String(b.email).trim(), username: String(b.username).trim(), password: hashPassword(b.password), activo: b.activo !== false, creadoEn: new Date().toISOString(), bajaEn: null, suscripcionesIds: [], telefono: (b.telefono || '').trim(), direccion: (b.direccion || '').trim(), dni: (b.dni || '').trim(), contactos: [] }
    setCollection('im_clientes', [...clientes, nuevo])
    let cat = getCollection('im_suscripciones_catalogo')
    let test = cat.find(c => c.nombre === 'Test')
    if (!test) { test = { id: genId(), nombre: 'Test', programas: [], tipo: 'recurrente', precioMensual: 0, primerMesPrueba: true, creadoEn: new Date().toISOString() }; setCollection('im_suscripciones_catalogo', [...cat, test]) }
    const suscs = getCollection('im_suscripciones_clientes')
    setCollection('im_suscripciones_clientes', [...suscs, { id: genId(), catalogoId: test.id, clienteId: nuevo.id, fechaInicio: new Date().toISOString(), fechaFin: addDays(todayISO(), 7), activa: true }])
    return sinPassword(nuevo)
  },
  assignProduct: (clientId, b) => {
    const cliente = getCollection('im_clientes').find(c => c.id === clientId)
    if (!cliente) throw httpErr(404, 'Cliente no encontrado')
    const producto = getCollection('im_suscripciones_catalogo').find(c => c.id === b.catalogoId)
    if (!producto) throw httpErr(404, 'Producto (suscripción) no encontrado')
    const inicio = new Date(); const f = new Date(inicio); f.setMonth(f.getMonth() + 1); f.setDate(f.getDate() + 3)
    const finISO = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
    const susc = { id: genId(), catalogoId: producto.id, clienteId: cliente.id, fechaInicio: inicio.toISOString(), fechaFin: finISO, activa: true }
    setCollection('im_suscripciones_clientes', [...getCollection('im_suscripciones_clientes'), susc])
    const programas = getCollection('im_programas'); const calendarios = getCollection('im_calendarios')
    const nuevosCal = generarCalendarios(cliente, producto, susc.id, programas, calendarios, b.fechaInicio || undefined)
    if (nuevosCal.length) setCollection('im_calendarios', [...calendarios, ...nuevosCal])
    return { suscripcion: susc, calendarios: nuevosCal.map(c => ({ id: c.id, programa: c.programaNombre, fechaInicio: c.fechaInicio, semanas: c.semanas.length })) }
  },
  listPrograms: () => getCollection('im_programas').map(p => ({ id: p.id, nombre: p.nombre, semanas: p.semanas.length })),
}

// ── HTTP ──────────────────────────────────────────────────────────────────────
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '', size = 0
    req.on('data', ch => { size += ch.length; if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy() } else body += ch })
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}) } catch { reject(new Error('bad_json')) } })
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const p = url.pathname
  const method = req.method

  if (method === 'OPTIONS') { res.writeHead(204); return res.end() }

  try {
    // ── Públicos ──
    if (p === '/api/health') return json(res, 200, { ok: true, db: 'sqlite', auth: true })

    if (p === '/api/login' && method === 'POST') {
      const b = await readBody(req)
      const u = getCollection('im_users').find(x => x.activo && x.username === String(b.username || '').trim())
      if (!u || !verifyPassword(b.password || '', u.password)) throw httpErr(401, 'Usuario o contraseña incorrectos')
      const token = crearSesion('staff', u.id, u.rol)
      return json(res, 200, { token, user: sinPassword(u) })
    }
    if (p === '/api/portal/login' && method === 'POST') {
      const b = await readBody(req)
      const id = String(b.identificador || '').trim()
      const c = getCollection('im_clientes').find(x => x.activo && (x.email === id || x.username === id))
      if (!c || !verifyPassword(b.password || '', c.password)) throw httpErr(401, 'Credenciales incorrectas o cliente inactivo')
      const token = crearSesion('cliente', c.id, '')
      return json(res, 200, { token, cliente: sinPassword(c) })
    }

    // ── A partir de aquí, requiere sesión ──
    const ses = getSesion(req)
    if (!ses) throw httpErr(401, 'No autenticado')

    if (p === '/api/logout' && method === 'POST') {
      const h = req.headers['authorization'] || ''; const m = h.match(/^Bearer (.+)$/)
      if (m) db.prepare(`DELETE FROM _sessions WHERE token = ?`).run(m[1])
      return json(res, 200, { ok: true })
    }

    // ── Portal cliente: solo sus propios datos ──
    if (p === '/api/portal/me' && method === 'GET') {
      if (ses.tipo !== 'cliente') throw httpErr(403, 'Solo clientes')
      const me = getCollection('im_clientes').find(c => c.id === ses.sujeto_id)
      if (!me) throw httpErr(404, 'Cliente no encontrado')
      return json(res, 200, {
        cliente: sinPassword(me),
        im_suscripciones_clientes: getCollection('im_suscripciones_clientes').filter(s => s.clienteId === me.id),
        im_suscripciones_catalogo: getCollection('im_suscripciones_catalogo'),
        im_calendarios: getCollection('im_calendarios').filter(c => c.clienteId === me.id),
        im_ejercicios: getCollection('im_ejercicios'),
      })
    }

    // ── Resto: solo staff ──
    if (ses.tipo !== 'staff') throw httpErr(403, 'Acceso restringido al personal')
    const esAdmin = ses.rol === 'administrador'

    // KV genérico (panel)
    if (p === '/api/data' && method === 'GET') return json(res, 200, getAll())
    const kv = p.match(/^\/api\/data\/([a-z_]+)$/)
    if (kv) {
      const key = kv[1]
      if (!ALLOWED_KEYS.has(key)) return json(res, 400, { error: 'clave no permitida' })
      if (method === 'GET') return json(res, 200, KEYS_CON_PASSWORD.has(key) ? sinPasswords(getCollection(key)) : getCollection(key))
      if (method === 'PUT') {
        let value = await readBody(req)
        if (KEYS_CON_PASSWORD.has(key)) value = preservarPasswords(key, value)
        setCollection(key, value)
        return json(res, 200, { ok: true })
      }
    }

    // REST de dominio
    if (p === '/api/users' && method === 'GET') return json(res, 200, domain.listUsers())
    if (p === '/api/users' && method === 'POST') { if (!esAdmin) throw httpErr(403, 'Solo un administrador puede crear usuarios'); return json(res, 201, domain.createUser(await readBody(req))) }
    if (p === '/api/products' && method === 'GET') return json(res, 200, domain.listProducts())
    if (p === '/api/products' && method === 'POST') { if (!esAdmin) throw httpErr(403, 'Solo un administrador puede crear productos'); return json(res, 201, domain.createProduct(await readBody(req))) }
    if (p === '/api/programs' && method === 'GET') return json(res, 200, domain.listPrograms())
    if (p === '/api/clients' && method === 'GET') return json(res, 200, domain.listClients())
    if (p === '/api/clients' && method === 'POST') { if (!esAdmin) throw httpErr(403, 'Solo un administrador puede crear clientes'); return json(res, 201, domain.createClient(await readBody(req))) }
    const asg = p.match(/^\/api\/clients\/([^/]+)\/subscriptions$/)
    if (asg && method === 'POST') { if (!esAdmin) throw httpErr(403, 'Solo un administrador puede asignar productos'); return json(res, 201, domain.assignProduct(decodeURIComponent(asg[1]), await readBody(req))) }

    json(res, 404, { error: 'no encontrado' })
  } catch (e) {
    if (e.message === 'too_large') return json(res, 413, { error: 'demasiado grande' })
    if (e.message === 'bad_json') return json(res, 400, { error: 'JSON inválido' })
    if (e.status) return json(res, e.status, { error: e.message })
    console.error('Error:', e)
    json(res, 500, { error: 'error interno' })
  }
})

server.listen(PORT, '127.0.0.1', () => console.log(`API escuchando en 127.0.0.1:${PORT}`))
