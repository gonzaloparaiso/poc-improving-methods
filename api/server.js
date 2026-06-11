// API de Improving Methods — persistencia en SQLite (node:sqlite, integrado en Node 22).
// Mantiene el mismo contrato HTTP que la versión anterior (clave-valor por colección)
// pero cada colección es una tabla con UNA FILA POR REGISTRO, transaccional y consultable.
// Arrancar con:  node --experimental-sqlite server.js
const http = require('http')
const fs = require('fs')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')

const PORT = process.env.PORT || 3001
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db')
const JSON_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json') // solo para migración inicial
const MAX_BODY = 30 * 1024 * 1024 // 30MB (adjuntos PDF en base64)

// Colecciones tipo array (una fila por elemento, con su id)
const ARRAY_KEYS = [
  'im_users',
  'im_clientes',
  'im_suscripciones_catalogo',
  'im_suscripciones_clientes',
  'im_calendarios',
  'im_programas',
  'im_plantillas',
  'im_ejercicios',
]
// Colección tipo objeto (mapa tareaId → fecha de completado)
const OBJECT_KEY = 'im_tareas_completadas'
const ALLOWED_KEYS = new Set([...ARRAY_KEYS, OBJECT_KEY])

// ── Base de datos ───────────────────────────────────────────────────────────
const db = new DatabaseSync(DB_FILE)
db.exec('PRAGMA journal_mode = WAL;')   // mejor durabilidad y concurrencia de lectura
db.exec('PRAGMA foreign_keys = ON;')

for (const k of ARRAY_KEYS) {
  db.exec(`CREATE TABLE IF NOT EXISTS "${k}" (ord INTEGER PRIMARY KEY, id TEXT, data TEXT NOT NULL)`)
}
db.exec(`CREATE TABLE IF NOT EXISTS "${OBJECT_KEY}" (tarea_id TEXT PRIMARY KEY, completado_en TEXT NOT NULL)`)
db.exec(`CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)`)

function getCollection(key) {
  if (key === OBJECT_KEY) {
    const rows = db.prepare(`SELECT tarea_id, completado_en FROM "${OBJECT_KEY}"`).all()
    const obj = {}
    for (const r of rows) obj[r.tarea_id] = r.completado_en
    return obj
  }
  const rows = db.prepare(`SELECT data FROM "${key}" ORDER BY ord`).all()
  return rows.map(r => JSON.parse(r.data))
}

function setCollection(key, value) {
  if (key === OBJECT_KEY) {
    const ins = db.prepare(`INSERT INTO "${OBJECT_KEY}" (tarea_id, completado_en) VALUES (?, ?)`)
    db.exec('BEGIN')
    try {
      db.exec(`DELETE FROM "${OBJECT_KEY}"`)
      for (const [k, v] of Object.entries(value || {})) ins.run(k, String(v))
      db.exec('COMMIT')
    } catch (e) { db.exec('ROLLBACK'); throw e }
    return
  }
  const arr = Array.isArray(value) ? value : []
  const ins = db.prepare(`INSERT INTO "${key}" (ord, id, data) VALUES (?, ?, ?)`)
  db.exec('BEGIN')
  try {
    db.exec(`DELETE FROM "${key}"`)
    arr.forEach((el, i) => ins.run(i, el && el.id != null ? String(el.id) : null, JSON.stringify(el)))
    db.exec('COMMIT')
  } catch (e) { db.exec('ROLLBACK'); throw e }
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

// ── Migración única desde data.json (preserva los datos del modo anterior) ────
const yaMigrado = db.prepare(`SELECT v FROM _meta WHERE k = 'migrated'`).get()
if (!yaMigrado) {
  if (fs.existsSync(JSON_FILE)) {
    try {
      const json = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'))
      let n = 0
      for (const k of [...ARRAY_KEYS, OBJECT_KEY]) {
        if (json[k] != null) { setCollection(k, json[k]); n++ }
      }
      console.log(`Migración: ${n} colecciones importadas de ${JSON_FILE} → SQLite`)
    } catch (e) {
      console.error('Error migrando data.json:', e)
    }
  }
  db.prepare(`INSERT OR REPLACE INTO _meta (k, v) VALUES ('migrated', '1')`).run()
}

console.log(`SQLite listo en ${DB_FILE}`)

// ── HTTP ──────────────────────────────────────────────────────────────────────
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  if (url.pathname === '/api/health') return json(res, 200, { ok: true, db: 'sqlite' })

  if (url.pathname === '/api/data' && req.method === 'GET') {
    return json(res, 200, getAll())
  }

  const m = url.pathname.match(/^\/api\/data\/([a-z_]+)$/)
  if (m) {
    const key = m[1]
    if (!ALLOWED_KEYS.has(key)) return json(res, 400, { error: 'clave no permitida' })

    if (req.method === 'GET') return json(res, 200, getCollection(key))

    if (req.method === 'PUT') {
      let body = ''
      let size = 0
      let aborted = false
      req.on('data', ch => {
        size += ch.length
        if (size > MAX_BODY) { aborted = true; json(res, 413, { error: 'demasiado grande' }); req.destroy(); return }
        body += ch
      })
      req.on('end', () => {
        if (aborted) return
        try {
          setCollection(key, JSON.parse(body))
          json(res, 200, { ok: true })
        } catch (e) {
          console.error('Error en PUT', key, e)
          json(res, 400, { error: 'JSON inválido o error de escritura' })
        }
      })
      return
    }
  }

  json(res, 404, { error: 'no encontrado' })
})

server.listen(PORT, '127.0.0.1', () => console.log(`API (SQLite) escuchando en 127.0.0.1:${PORT}`))
