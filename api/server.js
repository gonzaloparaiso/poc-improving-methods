// API de Improving Methods — almacén clave-valor con persistencia en disco.
// Sin dependencias externas: Node puro. Las "colecciones" son las mismas claves
// que el frontend usaba en localStorage; el navegador queda como caché local.
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 3001
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json')
const MAX_BODY = 30 * 1024 * 1024 // 30MB (los adjuntos PDF van en base64)

const ALLOWED_KEYS = new Set([
  'im_users',
  'im_clientes',
  'im_suscripciones_catalogo',
  'im_suscripciones_clientes',
  'im_calendarios',
  'im_programas',
  'im_plantillas',
  'im_ejercicios',
  'im_tareas_completadas',
])

let data = {}
try {
  data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  console.log(`Datos cargados de ${DATA_FILE} (${Object.keys(data).length} colecciones)`)
} catch {
  console.log('Sin datos previos, arrancando vacío')
}

// Escritura atómica con debounce (tmp + rename)
let writeTimer = null
function persist() {
  clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    const tmp = DATA_FILE + '.tmp'
    fs.writeFile(tmp, JSON.stringify(data), err => {
      if (err) return console.error('Error al persistir:', err)
      fs.rename(tmp, DATA_FILE, e => { if (e) console.error('Error al renombrar:', e) })
    })
  }, 100)
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')

  // CORS abierto (POC); en producción real se restringiría al dominio
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  if (url.pathname === '/api/health') return json(res, 200, { ok: true })

  // Todas las colecciones de una vez (carga inicial del frontend)
  if (url.pathname === '/api/data' && req.method === 'GET') {
    return json(res, 200, data)
  }

  const m = url.pathname.match(/^\/api\/data\/([a-z_]+)$/)
  if (m) {
    const key = m[1]
    if (!ALLOWED_KEYS.has(key)) return json(res, 400, { error: 'clave no permitida' })

    if (req.method === 'GET') return json(res, 200, data[key] ?? null)

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
          data[key] = JSON.parse(body)
          persist()
          json(res, 200, { ok: true })
        } catch {
          json(res, 400, { error: 'JSON inválido' })
        }
      })
      return
    }
  }

  json(res, 404, { error: 'no encontrado' })
})

server.listen(PORT, '127.0.0.1', () => console.log(`API escuchando en 127.0.0.1:${PORT}`))
