// API de Improving Methods — SQLite (node:sqlite, integrado en Node 22).
// Dos capas sobre la MISMA base de datos:
//   1) KV genérico  (/api/data[/:key])  → lo que sincroniza el frontend
//   2) REST de dominio (/api/users, /api/products, /api/clients, asignaciones)
// Ambas operan sobre las mismas tablas, así que lo que crea la API REST lo ve
// el frontend en su próxima carga (bootSync) y viceversa.
// Arrancar con:  node --experimental-sqlite server.js
const http = require('http')
const fs = require('fs')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')

const PORT = process.env.PORT || 3001
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db')
const JSON_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json')
const MAX_BODY = 30 * 1024 * 1024

const ARRAY_KEYS = [
  'im_users', 'im_clientes', 'im_suscripciones_catalogo', 'im_suscripciones_clientes',
  'im_calendarios', 'im_programas', 'im_plantillas', 'im_ejercicios',
]
const OBJECT_KEY = 'im_tareas_completadas'
const ALLOWED_KEYS = new Set([...ARRAY_KEYS, OBJECT_KEY])

const ROLES = ['administrador', 'head_coach', 'coach']
const TIPOS = ['recurrente', 'unico']
const PALETA = ['yellow', 'blue', 'purple', 'green', 'orange']

// ── Base de datos ───────────────────────────────────────────────────────────
const db = new DatabaseSync(DB_FILE)
db.exec('PRAGMA journal_mode = WAL;')
for (const k of ARRAY_KEYS) db.exec(`CREATE TABLE IF NOT EXISTS "${k}" (ord INTEGER PRIMARY KEY, id TEXT, data TEXT NOT NULL)`)
db.exec(`CREATE TABLE IF NOT EXISTS "${OBJECT_KEY}" (tarea_id TEXT PRIMARY KEY, completado_en TEXT NOT NULL)`)
db.exec(`CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)`)

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
function getAll() {
  const out = {}
  for (const k of [...ARRAY_KEYS, OBJECT_KEY]) {
    const v = getCollection(k)
    const vacio = Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0
    if (!vacio) out[k] = v
  }
  return out
}

// ── Migración única desde data.json ──────────────────────────────────────────
if (!db.prepare(`SELECT v FROM _meta WHERE k='migrated'`).get()) {
  if (fs.existsSync(JSON_FILE)) {
    try {
      const json = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'))
      let n = 0
      for (const k of [...ARRAY_KEYS, OBJECT_KEY]) if (json[k] != null) { setCollection(k, json[k]); n++ }
      console.log(`Migración: ${n} colecciones importadas → SQLite`)
    } catch (e) { console.error('Error migrando:', e) }
  }
  db.prepare(`INSERT OR REPLACE INTO _meta (k,v) VALUES ('migrated','1')`).run()
}
console.log(`SQLite listo en ${DB_FILE}`)

// ── Helpers de dominio ────────────────────────────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9) }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function siguienteLunes() {
  const h = new Date(); h.setHours(0, 0, 0, 0)
  const dow = h.getDay()
  const d = new Date(h); d.setDate(h.getDate() + (dow === 1 ? 0 : (1 - dow + 7) % 7))
  return d.toISOString().split('T')[0]
}
function addDays(iso, n) { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0] }
function instanciarPrograma(programa, fechaInicio) {
  return programa.semanas.map((semana, si) => {
    const fechaLunes = addDays(fechaInicio, si * 7)
    return {
      id: genId(), numero: semana.numero, fechaLunes,
      dias: semana.dias.map((dia, di) => ({
        fecha: addDays(fechaLunes, di), diaSemana: di,
        bloques: JSON.parse(JSON.stringify(dia.bloques || [])),
      })),
    }
  })
}

/** Crea los calendarios de un cliente para un producto recién asignado.
 *  Reglas idénticas al panel: pago único desde el siguiente lunes; recurrentes
 *  el programa completo si su ventana cubre hoy, más los futuros. */
function generarCalendarios(cliente, cat, suscClienteId, programas, calendariosActuales, fechaOverride) {
  const hoy = todayISO()
  const nuevos = []
  const delCliente = calendariosActuales.filter(c => c.clienteId === cliente.id)
  const mismaSusc = delCliente.find(c => c.suscripcionClienteId === suscClienteId)
  const suscsDistintas = [...new Set(delCliente.map(c => c.suscripcionClienteId))]
  const colorKey = mismaSusc?.colorKey ?? PALETA[suscsDistintas.length % PALETA.length]

  for (const pa of (cat.programas || [])) {
    const programa = programas.find(p => p.id === pa.programaId)
    if (!programa) continue
    let fecha
    if (fechaOverride) {
      fecha = fechaOverride
    } else if (cat.tipo === 'recurrente') {
      if (!pa.fechaInicio) { fecha = siguienteLunes() }
      else {
        const fin = addDays(pa.fechaInicio, programa.semanas.length * 7 - 1)
        if (fin < hoy) continue
        fecha = pa.fechaInicio
      }
    } else {
      fecha = siguienteLunes()
    }
    nuevos.push({
      id: genId(), clienteId: cliente.id, suscripcionClienteId: suscClienteId,
      programaId: programa.id, programaNombre: programa.nombre,
      fechaInicio: fecha, semanas: instanciarPrograma(programa, fecha),
      creadoEn: new Date().toISOString(), colorKey,
      adjuntos: programa.adjuntos ? JSON.parse(JSON.stringify(programa.adjuntos)) : [],
    })
  }
  return nuevos
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '', size = 0
    req.on('data', ch => { size += ch.length; if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy() } else body += ch })
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}) } catch { reject(new Error('bad_json')) } })
  })
}

// ── Handlers de dominio ───────────────────────────────────────────────────────
const domain = {
  // USUARIOS (staff)
  listUsers: () => getCollection('im_users'),
  createUser: (b) => {
    if (!b.nombre || !String(b.nombre).trim()) throw httpErr(400, 'El nombre es obligatorio')
    if (!b.username || !String(b.username).trim()) throw httpErr(400, 'El usuario es obligatorio')
    if (!b.password) throw httpErr(400, 'La contraseña es obligatoria')
    const rol = b.rol || 'coach'
    if (!ROLES.includes(rol)) throw httpErr(400, `Rol inválido (${ROLES.join(', ')})`)
    const users = getCollection('im_users')
    if (users.some(u => u.username === String(b.username).trim())) throw httpErr(409, 'Ese usuario ya existe')
    const nuevo = {
      id: genId(), nombre: String(b.nombre).trim(), apellido: (b.apellido || '').trim(),
      email: (b.email || '').trim(), username: String(b.username).trim(), password: String(b.password),
      rol, activo: b.activo !== false, creadoEn: new Date().toISOString(), bajaEn: null,
    }
    setCollection('im_users', [...users, nuevo])
    return nuevo
  },

  // PRODUCTOS (catálogo de suscripciones)
  listProducts: () => getCollection('im_suscripciones_catalogo'),
  createProduct: (b) => {
    if (!b.nombre || !String(b.nombre).trim()) throw httpErr(400, 'El nombre es obligatorio')
    const tipo = b.tipo || 'recurrente'
    if (!TIPOS.includes(tipo)) throw httpErr(400, `Tipo inválido (${TIPOS.join(', ')})`)
    const programasDisponibles = getCollection('im_programas')
    const programas = Array.isArray(b.programas) ? b.programas.map(p => {
      if (!programasDisponibles.some(pr => pr.id === p.programaId)) throw httpErr(400, `Programa no encontrado: ${p.programaId}`)
      return { programaId: p.programaId, fechaInicio: tipo === 'recurrente' ? (p.fechaInicio || siguienteLunes()) : null }
    }) : []
    const cat = getCollection('im_suscripciones_catalogo')
    const nuevo = {
      id: genId(), nombre: String(b.nombre).trim(), tipo, programas,
      precioMensual: Number(b.precioMensual) || 0, primerMesPrueba: b.primerMesPrueba === true,
      creadoEn: new Date().toISOString(),
    }
    setCollection('im_suscripciones_catalogo', [...cat, nuevo])
    return nuevo
  },

  // CLIENTES
  listClients: () => getCollection('im_clientes'),
  createClient: (b) => {
    if (!b.nombre || !String(b.nombre).trim()) throw httpErr(400, 'El nombre es obligatorio')
    if (!b.email || !String(b.email).trim()) throw httpErr(400, 'El email es obligatorio')
    if (!b.username || !String(b.username).trim()) throw httpErr(400, 'El usuario es obligatorio')
    if (!b.password) throw httpErr(400, 'La contraseña es obligatoria')
    const clientes = getCollection('im_clientes')
    if (clientes.some(c => c.email === String(b.email).trim())) throw httpErr(409, 'Ese email ya está registrado')
    if (clientes.some(c => c.username === String(b.username).trim())) throw httpErr(409, 'Ese usuario ya existe')
    const nuevo = {
      id: genId(), nombre: String(b.nombre).trim(), apellido: (b.apellido || '').trim(),
      email: String(b.email).trim(), username: String(b.username).trim(), password: String(b.password),
      activo: b.activo !== false, creadoEn: new Date().toISOString(), bajaEn: null, suscripcionesIds: [],
      telefono: (b.telefono || '').trim(), direccion: (b.direccion || '').trim(), dni: (b.dni || '').trim(),
      contactos: [],
    }
    setCollection('im_clientes', [...clientes, nuevo])

    // Suscripción "Test" automática de 1 semana (igual que el panel)
    let cat = getCollection('im_suscripciones_catalogo')
    let test = cat.find(c => c.nombre === 'Test')
    if (!test) {
      test = { id: genId(), nombre: 'Test', programas: [], tipo: 'recurrente', precioMensual: 0, primerMesPrueba: true, creadoEn: new Date().toISOString() }
      setCollection('im_suscripciones_catalogo', [...cat, test])
    }
    const fin = addDays(todayISO(), 7)
    const suscs = getCollection('im_suscripciones_clientes')
    setCollection('im_suscripciones_clientes', [...suscs, {
      id: genId(), catalogoId: test.id, clienteId: nuevo.id,
      fechaInicio: new Date().toISOString(), fechaFin: fin, activa: true,
    }])
    return nuevo
  },

  // ASIGNAR PRODUCTO/PROGRAMAS a un cliente → genera suscripción + calendarios
  assignProduct: (clientId, b) => {
    const clientes = getCollection('im_clientes')
    const cliente = clientes.find(c => c.id === clientId)
    if (!cliente) throw httpErr(404, 'Cliente no encontrado')
    const cat = getCollection('im_suscripciones_catalogo')
    const producto = cat.find(c => c.id === b.catalogoId)
    if (!producto) throw httpErr(404, 'Producto (suscripción) no encontrado')

    const fechaOverride = b.fechaInicio ? b.fechaInicio : undefined

    // Crear suscripción del cliente (inicio ahora, fin +1mes+3días)
    const inicio = new Date()
    const f = new Date(inicio); f.setMonth(f.getMonth() + 1); f.setDate(f.getDate() + 3)
    const finISO = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
    const susc = {
      id: genId(), catalogoId: producto.id, clienteId: cliente.id,
      fechaInicio: inicio.toISOString(), fechaFin: finISO, activa: true,
    }
    setCollection('im_suscripciones_clientes', [...getCollection('im_suscripciones_clientes'), susc])

    // Generar calendarios de los programas del producto
    const programas = getCollection('im_programas')
    const calendarios = getCollection('im_calendarios')
    const nuevosCal = generarCalendarios(cliente, producto, susc.id, programas, calendarios, fechaOverride)
    if (nuevosCal.length) setCollection('im_calendarios', [...calendarios, ...nuevosCal])

    return { suscripcion: susc, calendarios: nuevosCal.map(c => ({ id: c.id, programa: c.programaNombre, fechaInicio: c.fechaInicio, semanas: c.semanas.length })) }
  },

  listPrograms: () => getCollection('im_programas').map(p => ({ id: p.id, nombre: p.nombre, semanas: p.semanas.length })),
}

function httpErr(status, msg) { const e = new Error(msg); e.status = status; return e }

// ── Router ──────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const p = url.pathname
  const method = req.method

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (method === 'OPTIONS') { res.writeHead(204); return res.end() }

  try {
    if (p === '/api/health') return json(res, 200, { ok: true, db: 'sqlite' })

    // ── KV genérico (frontend) ──
    if (p === '/api/data' && method === 'GET') return json(res, 200, getAll())
    const kv = p.match(/^\/api\/data\/([a-z_]+)$/)
    if (kv) {
      const key = kv[1]
      if (!ALLOWED_KEYS.has(key)) return json(res, 400, { error: 'clave no permitida' })
      if (method === 'GET') return json(res, 200, getCollection(key))
      if (method === 'PUT') { setCollection(key, await readBody(req)); return json(res, 200, { ok: true }) }
    }

    // ── REST de dominio ──
    if (p === '/api/users' && method === 'GET') return json(res, 200, domain.listUsers())
    if (p === '/api/users' && method === 'POST') return json(res, 201, domain.createUser(await readBody(req)))

    if (p === '/api/products' && method === 'GET') return json(res, 200, domain.listProducts())
    if (p === '/api/products' && method === 'POST') return json(res, 201, domain.createProduct(await readBody(req)))

    if (p === '/api/programs' && method === 'GET') return json(res, 200, domain.listPrograms())

    if (p === '/api/clients' && method === 'GET') return json(res, 200, domain.listClients())
    if (p === '/api/clients' && method === 'POST') return json(res, 201, domain.createClient(await readBody(req)))

    const asg = p.match(/^\/api\/clients\/([^/]+)\/subscriptions$/)
    if (asg && method === 'POST') return json(res, 201, domain.assignProduct(decodeURIComponent(asg[1]), await readBody(req)))

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
