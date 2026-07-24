// API de Improving Methods — SQLite + autenticación por token.
// Arrancar con:  node --experimental-sqlite server.js
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { DatabaseSync } = require('node:sqlite')

const PORT = process.env.PORT || 3001

// ── Email (Gmail API + cuenta de servicio con delegación de dominio) ──────────
// DigitalOcean bloquea SMTP de salida, así que enviamos por la API de Gmail
// sobre HTTPS. Config vía variables de entorno (todas opcionales):
let _saEmail = process.env.GMAIL_SA_CLIENT_EMAIL || ''
let _saKey = (process.env.GMAIL_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
// Preferimos leer el JSON de la cuenta de servicio desde un fichero (más robusto)
if (process.env.GMAIL_SA_KEY_FILE) {
  try {
    const sa = JSON.parse(fs.readFileSync(process.env.GMAIL_SA_KEY_FILE, 'utf8'))
    _saEmail = sa.client_email || _saEmail
    _saKey = sa.private_key || _saKey
  } catch (e) { console.error('[email] No se pudo leer GMAIL_SA_KEY_FILE:', e.message) }
}
const GMAIL = {
  sender: process.env.GMAIL_SENDER || '',   // buzón remitente, p.ej. info@trainingnorte.com
  saEmail: _saEmail,                          // cuenta de servicio
  saKey: _saKey,                              // private_key (PEM)
}
const APP_URL = process.env.APP_URL || ''      // base del enlace de reset (dominio); si vacío se deriva de la petición
const PASSWORD_RESET_TTL = 60 * 60 * 1000      // 1 hora

// ── Renovación de suscripción (endpoint propio en WordPress + WooCommerce) ────
const RENEW = {
  url: process.env.TN_RENEW_URL || '',       // p.ej. https://trainingnorte.com/wp-json/tn-portal/v1/renew
  secret: process.env.TN_RENEW_SECRET || '', // secreto compartido con el snippet de WP
}
// Webhook entrante de WooCommerce (sincroniza acceso del portal al pagar)
const WC_WEBHOOK = { secret: process.env.TN_WC_WEBHOOK_SECRET || '' }
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db')
const JSON_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json')
const MAX_BODY = 30 * 1024 * 1024
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000 // 30 días

const ARRAY_KEYS = [
  'im_users', 'im_clientes', 'im_suscripciones_catalogo', 'im_suscripciones_clientes',
  'im_calendarios', 'im_programas', 'im_plantillas', 'im_ejercicios',
  'im_respiraciones', 'im_movilidad',
]
const OBJECT_KEY = 'im_tareas_completadas'
const ALLOWED_KEYS = new Set([...ARRAY_KEYS, OBJECT_KEY])
const KEYS_CON_PASSWORD = new Set(['im_users', 'im_clientes'])
// Pseudo-programa reservado "Basic" (da acceso a Contenido, no genera calendario).
// Debe coincidir literalmente con BASIC_PROGRAM_ID en web/src/types/index.ts.
const BASIC_PROGRAM_ID = '__basic__'
// Textos de bienvenida por defecto — se usan si una suscripción no tiene los suyos propios editados.
const MENSAJE_BIENVENIDA_EMAIL_DEFAULT = 'Hola{nombre}, ¡bienvenido/a a Training Norte! Ya tienes acceso a tu aplicación.'
const MENSAJE_BIENVENIDA_WHATSAPP_DEFAULT = '¡Hola{nombre}! Bienvenido/a a Training Norte 💪 Ya tienes acceso a tu app.'

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
db.exec(`CREATE TABLE IF NOT EXISTS _password_resets (token TEXT PRIMARY KEY, cliente_id TEXT, expira INTEGER)`)
// Pedidos de WooCommerce que no llegaron con status "completed" (pago aún no confirmado
// por el banco) — se guardan para reintentarlos más adelante en vez de descartarlos.
db.exec(`CREATE TABLE IF NOT EXISTS _wc_pedidos_pendientes (wc_order_id TEXT PRIMARY KEY, motivo TEXT, payload TEXT NOT NULL, creado_en INTEGER, actualizado_en INTEGER)`)
// "tipo" distingue resets de cliente (im_clientes) vs staff (im_users); las filas
// ya existentes en producción se tratan como 'cliente' (comportamiento previo).
try { db.exec(`ALTER TABLE _password_resets ADD COLUMN tipo TEXT NOT NULL DEFAULT 'cliente'`) } catch { /* ya existe */ }

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
const sinPassword = (o) => {
  if (!o) return o
  const { password, credencialesExtra, ...rest } = o
  if (!Array.isArray(credencialesExtra)) return rest
  return { ...rest, credencialesExtra: credencialesExtra.map(cr => { if (!cr) return cr; const { password: _p, ...r } = cr; return r }) }
}
const sinPasswords = (arr) => Array.isArray(arr) ? arr.map(sinPassword) : arr

// ── Política de contraseñas ──────────────────────────────────────────────────
// OJO: debe coincidir exactamente con REQUISITOS_PASSWORD en web/src/lib/passwordPolicy.ts
// (fuente de verdad: esto; el frontend solo repite la regla para dar feedback al vuelo).
function erroresPassword(pw) {
  const s = String(pw || '')
  const errores = []
  if (s.length < 8) errores.push('al menos 8 caracteres')
  if (!/[A-Z]/.test(s)) errores.push('una letra mayúscula')
  if (!/[a-z]/.test(s)) errores.push('una letra minúscula')
  if (!/[0-9]/.test(s)) errores.push('un número')
  if (!/[^A-Za-z0-9]/.test(s)) errores.push('un carácter especial')
  return errores
}
/** Lanza 400 con el detalle de lo que falta si la contraseña no cumple la política. */
function validarPasswordFuerte(pw) {
  const errores = erroresPassword(pw)
  if (errores.length) throw httpErr(400, `La contraseña debe tener ${errores.join(', ')}`)
}

/** Para PUT de im_users/im_clientes: hashea contraseñas nuevas y preserva las existentes
 *  cuando vienen vacías (el frontend nunca recibe la contraseña, así que no la reenvía).
 *  En im_clientes, además reconcilia igual las contraseñas de credencialesExtra (los
 *  "entrenadores" de un box) para que un PUT que edite otro campo del cliente no las
 *  borre — el frontend tampoco las recibe nunca. */
function preservarPasswords(key, incoming) {
  if (!Array.isArray(incoming)) return incoming
  const actuales = getCollection(key)
  const existentes = Object.fromEntries(actuales.map(r => [r.id, r.password]))
  const existentesCred = Object.fromEntries(actuales.map(r => [r.id, Object.fromEntries((r.credencialesExtra || []).map(cr => [cr.id, cr.password]))]))
  return incoming.map(r => {
    if (!r) return r
    let out = r
    if (r.password && !isHashed(r.password)) { validarPasswordFuerte(r.password); out = { ...out, password: hashPassword(r.password) } }
    else if (!r.password) { const prev = existentes[r.id]; if (prev) out = { ...out, password: prev } }
    if (Array.isArray(r.credencialesExtra)) {
      const prevCred = existentesCred[r.id] || {}
      out = { ...out, credencialesExtra: r.credencialesExtra.map(cr => {
        if (!cr) return cr
        if (cr.password && !isHashed(cr.password)) { validarPasswordFuerte(cr.password); return { ...cr, password: hashPassword(cr.password) } }
        if (!cr.password) { const prevPw = prevCred[cr.id]; if (prevPw) return { ...cr, password: prevPw } }
        return cr
      }) }
    }
    return out
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
// El "usuario" de acceso pasa a ser siempre el email (idempotente): unifica cuentas
// antiguas que tuvieran un username distinto, para no confundir al iniciar sesión.
if (!db.prepare(`SELECT v FROM _meta WHERE k='username_es_email'`).get()) {
  for (const k of KEYS_CON_PASSWORD) {
    const arr = getCollection(k); let changed = false
    for (const r of arr) {
      if (!r || !r.email) continue
      const email = String(r.email).trim().toLowerCase()
      if (r.username !== email) { r.username = email; changed = true }
    }
    if (changed) { setCollection(k, arr); console.log(`Usuario = email unificado en ${k}`) }
  }
  db.prepare(`INSERT OR REPLACE INTO _meta (k,v) VALUES ('username_es_email','1')`).run()
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

// ── Envío de email por la API de Gmail (OAuth2 con cuenta de servicio) ────────
function emailConfigured() { return Boolean(GMAIL.sender && GMAIL.saEmail && GMAIL.saKey) }

const b64url = (input) => Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// Firma un JWT y lo cambia por un access token (delegando en el remitente)
async function gmailAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: GMAIL.saEmail,
    scope: 'https://www.googleapis.com/auth/gmail.send',
    aud: 'https://oauth2.googleapis.com/token',
    sub: GMAIL.sender,              // la cuenta de servicio actúa como este buzón
    iat: now, exp: now + 3600,
  }))
  const signingInput = `${header}.${claims}`
  const signature = b64url(crypto.createSign('RSA-SHA256').update(signingInput).sign(GMAIL.saKey))
  const assertion = `${signingInput}.${signature}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const data = await res.json().catch(() => ({}))
  if (!data.access_token) throw new Error('Gmail OAuth: ' + JSON.stringify(data))
  return data.access_token
}

// Plantilla común del email de "restablecer contraseña" (portal cliente y panel staff).
function emailResetHtml({ nombre, link, logoUrl }) {
  return `
<div style="background:#f4f4f5;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:36px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="text-align:center;margin-bottom:20px">
      <img src="${logoUrl}" alt="Training Norte" width="72" height="72" style="border-radius:50%;display:inline-block" />
    </div>
    <h2 style="color:#111111;margin:0 0 6px;font-size:20px;text-align:center">Restablecer tu contraseña</h2>
    <p style="color:#6b7280;margin:0 0 24px;font-size:13px;text-align:center;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Training Norte</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">
      Hola${nombre ? ' ' + nombre : ''}, hemos recibido una solicitud para restablecer la contraseña de tu acceso a la <strong>aplicación de Training Norte</strong>.
    </p>
    <div style="text-align:center;margin:0 0 24px">
      <a href="${link}" style="display:inline-block;background:#f5c300;color:#111111;font-weight:bold;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px">Crear nueva contraseña</a>
    </div>
    <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 20px">
      El enlace caduca en 1 hora. Si no has sido tú quien lo ha solicitado, puedes ignorar este correo con total tranquilidad.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px" />
    <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 8px">
      ¿Tienes algún problema? Escríbenos a <a href="mailto:soporte@academiatn.com" style="color:#111111;font-weight:600">soporte@academiatn.com</a> y te ayudamos encantados.
    </p>
    <p style="color:#9ca3af;font-size:12px;word-break:break-all;margin:16px 0 0">${link}</p>
  </div>
</div>`
}

// Sustituye el placeholder "{nombre}" del mensaje de bienvenida configurado en la
// suscripción (o del texto por defecto) por " <nombre del cliente>" (o nada si no hay nombre).
function interpolarMensaje(plantilla, nombre) {
  return String(plantilla || '').replace(/\{nombre\}/g, nombre ? ` ${nombre}` : '')
}

// Plantilla HTML del email de bienvenida — el texto en sí (mensaje) se edita por
// suscripción en el catálogo (Suscripciones, en el panel de administradores).
function emailBienvenidaHtml({ mensaje, logoUrl }) {
  return `
<div style="background:#f4f4f5;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:36px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="text-align:center;margin-bottom:20px">
      <img src="${logoUrl}" alt="Training Norte" width="72" height="72" style="border-radius:50%;display:inline-block" />
    </div>
    <h2 style="color:#111111;margin:0 0 6px;font-size:20px;text-align:center">¡Bienvenido/a a Training Norte!</h2>
    <div style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">${mensaje}</div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px" />
    <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 8px">
      ¿Tienes algún problema? Escríbenos a <a href="mailto:soporte@academiatn.com" style="color:#111111;font-weight:600">soporte@academiatn.com</a> y te ayudamos encantados.
    </p>
  </div>
</div>`
}

// WhatsApp de bienvenida — placeholder hasta integrar Whapi. El texto se edita por
// suscripción en el catálogo (Suscripciones, en el panel de administradores).
function enviarWhatsappBienvenida(cliente, mensaje, imagenDataUrl) {
  console.log(`[whatsapp] TODO integrar Whapi — pendiente de enviar a ${cliente.telefono || '(sin teléfono)'} (${cliente.email}): "${mensaje}"${imagenDataUrl ? ' (con imagen adjunta)' : ''}`)
}

async function sendMail({ to, subject, html }) {
  if (!emailConfigured()) throw new Error('Email (Gmail API) no configurado')
  const token = await gmailAccessToken()
  const subjectEnc = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=` // por las tildes
  const mime =
    `From: Training Norte <${GMAIL.sender}>\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${subjectEnc}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
    String(html || '')
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(GMAIL.sender)}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: b64url(mime) }),
  })
  if (!res.ok) throw new Error(`Gmail send ${res.status}: ${await res.text()}`)
  return true
}

// ── Helpers de dominio ────────────────────────────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9) }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
// "Asignación activa" = asignada a un cliente Y con fecha de validez vigente (no basta con activa:true).
function tieneAsignacionActiva(catalogoId) {
  const hoy = todayISO()
  return getCollection('im_suscripciones_clientes').some(s => s.catalogoId === catalogoId && s.activa === true && s.fechaFin >= hoy)
}
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
    if (!b.email || !String(b.email).trim()) throw httpErr(400, 'El email es obligatorio')
    if (!b.password) throw httpErr(400, 'La contraseña es obligatoria')
    validarPasswordFuerte(b.password)
    const rol = b.rol || 'coach'
    if (!ROLES.includes(rol)) throw httpErr(400, `Rol inválido (${ROLES.join(', ')})`)
    const email = String(b.email).trim().toLowerCase()
    const users = getCollection('im_users')
    if (users.some(u => (u.email || '').toLowerCase() === email)) throw httpErr(409, 'Ese email ya está registrado')
    // El usuario de acceso ES el email (sin identificador aparte, para no confundir al iniciar sesión).
    const nuevo = { id: genId(), nombre: String(b.nombre).trim(), apellido: (b.apellido || '').trim(), email: String(b.email).trim(), username: email, password: hashPassword(b.password), rol, activo: b.activo !== false, creadoEn: new Date().toISOString(), bajaEn: null }
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
      if (p.programaId === BASIC_PROGRAM_ID) return { programaId: BASIC_PROGRAM_ID, fechaInicio: null }
      if (!disponibles.some(pr => pr.id === p.programaId)) throw httpErr(400, `Programa no encontrado: ${p.programaId}`)
      return { programaId: p.programaId, fechaInicio: tipo === 'recurrente' ? (p.fechaInicio || siguienteLunes()) : null }
    }) : []
    const cat = getCollection('im_suscripciones_catalogo')
    const wcProductId = (b.wcProductId === '' || b.wcProductId == null) ? null : (Number(b.wcProductId) || null)
    const nuevo = {
      id: genId(), nombre: String(b.nombre).trim(), tipo, programas, precioMensual: Number(b.precioMensual) || 0,
      primerMesPrueba: b.primerMesPrueba === true, wcProductId, creadoEn: new Date().toISOString(),
      mensajeBienvenidaEmail: String(b.mensajeBienvenidaEmail ?? '').trim(),
      mensajeBienvenidaWhatsapp: String(b.mensajeBienvenidaWhatsapp ?? '').trim(),
      imagenBienvenidaWhatsapp: String(b.imagenBienvenidaWhatsapp ?? '').trim(),
      activo: true, origen: 'manual',
    }
    setCollection('im_suscripciones_catalogo', [...cat, nuevo])
    return nuevo
  },
  setProductoActivo: (id, activo) => {
    const cat = getCollection('im_suscripciones_catalogo')
    const idx = cat.findIndex(c => c.id === id)
    if (idx < 0) throw httpErr(404, 'Suscripción no encontrada')
    if (!activo && tieneAsignacionActiva(id)) {
      throw httpErr(409, 'No se puede desactivar: hay clientes con esta suscripción vigente asignada')
    }
    cat[idx] = { ...cat[idx], activo }
    setCollection('im_suscripciones_catalogo', cat)
    return cat[idx]
  },
  listClients: () => sinPasswords(getCollection('im_clientes')),
  createClient: (b) => {
    if (!b.nombre || !String(b.nombre).trim()) throw httpErr(400, 'El nombre es obligatorio')
    if (!b.email || !String(b.email).trim()) throw httpErr(400, 'El email es obligatorio')
    if (!b.password) throw httpErr(400, 'La contraseña es obligatoria')
    validarPasswordFuerte(b.password)
    const email = String(b.email).trim().toLowerCase()
    const clientes = getCollection('im_clientes')
    if (clientes.some(c => (c.email || '').toLowerCase() === email)) throw httpErr(409, 'Ese email ya está registrado')
    // El usuario de acceso ES el email (sin identificador aparte, para no confundir al iniciar sesión).
    const nuevo = { id: genId(), nombre: String(b.nombre).trim(), apellido: (b.apellido || '').trim(), email: String(b.email).trim(), username: email, password: hashPassword(b.password), activo: b.activo !== false, creadoEn: new Date().toISOString(), bajaEn: null, suscripcionesIds: [], telefono: (b.telefono || '').trim(), direccion: (b.direccion || '').trim(), dni: (b.dni || '').trim(), contactos: [], esBox: b.esBox === true, credencialesExtra: [] }
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
    if (producto.activo === false) throw httpErr(400, 'Esta suscripción está desactivada y no se puede asignar')
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

// ── Sincronización entrante desde WooCommerce (webhooks de producto) ─────────
// TN es la fuente de verdad para estos campos: nombre, tipo, precio y si está
// publicado (activo). El resto (programas, mensajes de bienvenida...) son solo
// del portal y no se tocan. Se identifica el producto SIEMPRE por su ID de
// WooCommerce (wcProductId), nunca por el nombre.
function syncProductoDesdeWC(payload) {
  const wcId = Number(payload && payload.id)
  if (!wcId) return { ignored: 'sin_id' }
  const nombre = String((payload && payload.name) || '').trim()
  if (!nombre) return { ignored: 'sin_nombre' }
  const publicado = String((payload && payload.status) || '') === 'publish'
  const tipo = /subscription/i.test(String((payload && payload.type) || '')) ? 'recurrente' : 'unico'
  const precioMensual = parseFloat(payload && payload.price) || 0

  const cat = getCollection('im_suscripciones_catalogo')
  const idx = cat.findIndex(c => c.wcProductId === wcId)

  if (idx < 0) {
    const nuevo = {
      id: genId(), nombre, tipo, programas: [], precioMensual, primerMesPrueba: false,
      wcProductId: wcId, creadoEn: new Date().toISOString(), activo: publicado, origen: 'wc',
      mensajeBienvenidaEmail: '', mensajeBienvenidaWhatsapp: '', imagenBienvenidaWhatsapp: '',
    }
    setCollection('im_suscripciones_catalogo', [...cat, nuevo])
    return { creado: nuevo.id, nombre }
  }

  const actual = cat[idx]
  // Solo se desactiva automáticamente al despublicar en WC, y solo si no tiene
  // clientes con una suscripción vigente asignada (si los tiene, se ignora el
  // despublicado — hay que desactivarlo a mano tras revisar). Volver a publicar
  // en WC NO reactiva solo: la reactivación siempre es manual, desde el panel.
  let activo = actual.activo !== false
  if (!publicado && !tieneAsignacionActiva(actual.id)) activo = false

  cat[idx] = { ...actual, nombre, tipo, precioMensual, activo, origen: 'wc', wcProductId: wcId }
  setCollection('im_suscripciones_catalogo', cat)
  return { actualizado: actual.id, nombre }
}

// ── Sincronización entrante desde WooCommerce (webhook de suscripción) ────────
// Mapea la suscripción de WC al portal: por email (cliente) + wcProductId
// (producto), actualiza fechaFin/activa y genera calendarios si faltan.
function syncDesdeWC(sub) {
  const email = String((sub.billing && sub.billing.email) || '').trim().toLowerCase()
  if (!email) return { ignored: 'sin_email' }
  const cliente = getCollection('im_clientes').find(c => String(c.email || '').toLowerCase() === email)
  if (!cliente) return { ignored: 'cliente_no_en_portal', email }

  const status = String(sub.status || '')
  const activa = status === 'active' || status === 'pending-cancel'
  const endRaw = sub.next_payment_date_gmt || sub.end_date_gmt || ''
  const fechaFin = endRaw ? String(endRaw).split('T')[0].split(' ')[0] : null
  const productIds = (sub.line_items || []).map(li => li.product_id).filter(Boolean)

  const catalogo = getCollection('im_suscripciones_catalogo')
  let subs = getCollection('im_suscripciones_clientes')
  let cals = getCollection('im_calendarios')
  const programas = getCollection('im_programas')
  const matched = []
  let subsChanged = false, calsChanged = false

  for (const pid of productIds) {
    const cat = catalogo.find(c => c.wcProductId === pid)
    if (!cat) continue
    matched.push(cat.nombre)
    let s = subs.find(x => x.clienteId === cliente.id && x.catalogoId === cat.id)
    if (s) {
      s.activa = activa
      if (fechaFin) s.fechaFin = fechaFin
      s.wcSubscriptionId = sub.id
    } else {
      const f = new Date(); f.setMonth(f.getMonth() + 1); f.setDate(f.getDate() + 3)
      const finDef = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
      s = { id: genId(), catalogoId: cat.id, clienteId: cliente.id, fechaInicio: new Date().toISOString(), fechaFin: fechaFin || finDef, activa, wcSubscriptionId: sub.id }
      subs = [...subs, s]
    }
    subsChanged = true
    // Generar calendarios si el cliente aún no los tiene para los programas del producto
    if (activa && (cat.programas || []).length) {
      const yaTiene = cals.some(c => c.clienteId === cliente.id && cat.programas.some(pa => pa.programaId === c.programaId))
      if (!yaTiene) {
        const nuevos = generarCalendarios(cliente, cat, s.id, programas, cals)
        if (nuevos.length) { cals = [...cals, ...nuevos]; calsChanged = true }
      }
    }
  }
  if (subsChanged) setCollection('im_suscripciones_clientes', subs)
  if (calsChanged) setCollection('im_calendarios', cals)
  return { cliente: cliente.id, productos: matched, activa, fechaFin, calendarios: calsChanged }
}

// Guarda un pedido de WooCommerce que aún no está pagado (status != completed) para
// poder reintentarlo más adelante en vez de descartarlo (el banco a veces tarda en confirmar).
function guardarPedidoPendiente(order, motivo) {
  const id = String(order.id ?? order.order_id ?? '')
  if (!id) return
  const ahora = Date.now()
  db.prepare(`
    INSERT INTO _wc_pedidos_pendientes (wc_order_id, motivo, payload, creado_en, actualizado_en)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(wc_order_id) DO UPDATE SET motivo = excluded.motivo, payload = excluded.payload, actualizado_en = excluded.actualizado_en
  `).run(id, motivo, JSON.stringify(order), ahora, ahora)
}

// ── Procesa un pedido de WooCommerce (alta nueva o renovación de una suscripción) ──
// El producto se identifica por su ID de WooCommerce (wcProductId en el catálogo),
// nunca por el nombre. Distingue alta nueva de renovación por order.created_via:
// 'checkout' = compra nueva (checkout manual), 'subscription' = renovación automática
// de WC Subscriptions. Solo se procesa si order.status === 'completed'; si no, se
// guarda para reintentar. Los pedidos de un producto desactivado se ignoran.
async function procesarOrdenWC(order, { base }) {
  const status = String(order.status || '')
  if (status !== 'completed') {
    guardarPedidoPendiente(order, `status_${status || 'desconocido'}`)
    return { ignored: 'pago_no_confirmado', status }
  }

  // El producto se identifica SIEMPRE por su ID de WooCommerce (nunca por el nombre).
  const productIds = (order.line_items || []).map(li => li.product_id).filter(Boolean)
  const producto = getCollection('im_suscripciones_catalogo').find(c => c.wcProductId != null && productIds.includes(c.wcProductId))
  if (!producto) return { ignored: 'producto_no_en_catalogo' }
  if (producto.activo === false) return { ignored: 'producto_inactivo' }

  const billing = order.billing || {}
  const email = String(billing.email || '').trim().toLowerCase()
  if (!email) return { ignored: 'sin_email' }

  const creadoViaCheckout = String(order.created_via || '') === 'checkout'

  let clientes = getCollection('im_clientes')
  let cliente = clientes.find(c => (c.email || '').toLowerCase() === email)
  const clienteNuevo = !cliente

  if (clienteNuevo) {
    cliente = {
      id: genId(),
      nombre: String(billing.first_name || '').trim() || 'Cliente',
      apellido: String(billing.last_name || '').trim(),
      email: String(billing.email || '').trim(),
      username: email,
      password: null, // sin contraseña hasta que la establezca desde el mail
      activo: true,
      creadoEn: new Date().toISOString(),
      bajaEn: null,
      suscripcionesIds: [],
      telefono: String(billing.phone || '').trim(),
      direccion: [billing.address_1, billing.city].filter(Boolean).join(', '),
      dni: '',
      contactos: [],
      esBox: false,
      credencialesExtra: [],
    }
    clientes = [...clientes, cliente]
    setCollection('im_clientes', clientes)
  }

  // Asignar o renovar la suscripción
  let subs = getCollection('im_suscripciones_clientes')
  let susc = subs.find(s => s.clienteId === cliente.id && s.catalogoId === producto.id)
  const esPrimeraDeEsteCliente = !susc
  const f = new Date(); f.setMonth(f.getMonth() + 1); f.setDate(f.getDate() + 3)
  const finISO = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
  if (susc) {
    subs = subs.map(s => s.id === susc.id ? { ...s, activa: true, fechaFin: finISO } : s)
  } else {
    susc = { id: genId(), catalogoId: producto.id, clienteId: cliente.id, fechaInicio: new Date().toISOString(), fechaFin: finISO, activa: true }
    subs = [...subs, susc]
  }
  setCollection('im_suscripciones_clientes', subs)

  if ((producto.programas || []).length) {
    let cals = getCollection('im_calendarios')
    const yaTiene = cals.some(c => c.clienteId === cliente.id && producto.programas.some(pa => pa.programaId === c.programaId))
    if (!yaTiene) {
      const programas = getCollection('im_programas')
      const nuevos = generarCalendarios(cliente, producto, susc.id, programas, cals)
      if (nuevos.length) setCollection('im_calendarios', [...cals, ...nuevos])
    }
  }

  // Comunicaciones: bienvenida (cliente nuevo o primera vez que compra este producto) +
  // establecer contraseña (solo si el cliente es nuevo, aún no tiene cuenta creada antes).
  const esAltaComercial = clienteNuevo || (creadoViaCheckout && esPrimeraDeEsteCliente)
  if (esAltaComercial) {
    const mensajeEmail = interpolarMensaje(producto.mensajeBienvenidaEmail || MENSAJE_BIENVENIDA_EMAIL_DEFAULT, cliente.nombre)
    const mensajeWhatsapp = interpolarMensaje(producto.mensajeBienvenidaWhatsapp || MENSAJE_BIENVENIDA_WHATSAPP_DEFAULT, cliente.nombre)
    const htmlBienvenida = emailBienvenidaHtml({ mensaje: mensajeEmail, logoUrl: `${base}/tn-logo-email.png` })
    sendMail({ to: cliente.email, subject: '¡Bienvenido/a a Training Norte!', html: htmlBienvenida })
      .catch(err => console.warn('[email] no se pudo enviar la bienvenida:', err.message))
    enviarWhatsappBienvenida(cliente, mensajeWhatsapp, producto.imagenBienvenidaWhatsapp || '')

    if (clienteNuevo) {
      db.prepare(`DELETE FROM _password_resets WHERE cliente_id = ? AND tipo = 'cliente'`).run(cliente.id)
      const rtoken = crypto.randomBytes(32).toString('hex')
      db.prepare(`INSERT INTO _password_resets (token, cliente_id, expira, tipo) VALUES (?,?,?,'cliente')`).run(rtoken, cliente.id, Date.now() + PASSWORD_RESET_TTL)
      const link = `${base}/reset?token=${rtoken}`
      const htmlPassword = emailResetHtml({ nombre: cliente.nombre, link, logoUrl: `${base}/tn-logo-email.png` })
      sendMail({ to: cliente.email, subject: 'Configura tu contraseña · Training Norte', html: htmlPassword })
        .catch(err => console.warn('[email] no se pudo enviar el email de contraseña:', err.message))
    }
  }

  return { cliente: cliente.id, clienteNuevo, altaComercial: esAltaComercial, fechaFin: finISO }
}

// ── Credenciales extra de un box (entrenadores con el mismo acceso) ───────────
// Usado tanto por el propio cliente (self-service desde el portal) como por
// el panel de administradores.
function agregarCredencial(clienteId, b) {
  const arr = getCollection('im_clientes')
  const idx = arr.findIndex(c => c.id === clienteId)
  if (idx < 0) throw httpErr(404, 'Cliente no encontrado')
  if (!arr[idx].esBox) throw httpErr(403, 'Solo un cliente marcado como "box" puede tener entrenadores')
  const email = String(b.email || '').trim().toLowerCase()
  if (!email) throw httpErr(400, 'El email es obligatorio')
  if (!b.password) throw httpErr(400, 'La contraseña es obligatoria')
  validarPasswordFuerte(b.password)
  const enUso = arr.some(c => (c.email || '').toLowerCase() === email)
    || arr.some(c => (c.credencialesExtra || []).some(cr => cr.email.toLowerCase() === email))
  if (enUso) throw httpErr(409, 'Ese email ya está en uso')
  const nueva = { id: genId(), email: String(b.email).trim(), password: hashPassword(b.password), activo: true, creadoEn: new Date().toISOString() }
  arr[idx] = { ...arr[idx], credencialesExtra: [...(arr[idx].credencialesExtra || []), nueva] }
  setCollection('im_clientes', arr)
  return sinPassword(arr[idx])
}
function borrarCredencial(clienteId, credId) {
  const arr = getCollection('im_clientes')
  const idx = arr.findIndex(c => c.id === clienteId)
  if (idx < 0) throw httpErr(404, 'Cliente no encontrado')
  arr[idx] = { ...arr[idx], credencialesExtra: (arr[idx].credencialesExtra || []).filter(cr => cr.id !== credId) }
  setCollection('im_clientes', arr)
  return sinPassword(arr[idx])
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
// Body crudo (string) — necesario para verificar la firma HMAC de WooCommerce
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '', size = 0
    req.on('data', ch => { size += ch.length; if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy() } else body += ch })
    req.on('end', () => resolve(body))
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

    // ── Webhook de WooCommerce (sincroniza acceso del portal) ──
    if (p === '/api/wc/webhook' && method === 'POST') {
      const raw = await readRawBody(req)
      const topic = String(req.headers['x-wc-webhook-topic'] || '')
      const deliveryId = req.headers['x-wc-webhook-delivery-id'] || req.headers['x-wc-webhook-id'] || ''
      if (!WC_WEBHOOK.secret) return json(res, 503, { error: 'webhook no configurado' })
      const sig = req.headers['x-wc-webhook-signature'] || ''
      const expected = crypto.createHmac('sha256', WC_WEBHOOK.secret).update(raw, 'utf8').digest('base64')
      const a = Buffer.from(String(sig)); const b2 = Buffer.from(expected)
      if (a.length !== b2.length || !crypto.timingSafeEqual(a, b2)) {
        // Log mínimo (sin payload: la firma no es de fiar) para poder diagnosticar
        // webhooks duplicados/mal configurados en WooCommerce.
        console.warn(`[wc-webhook] firma inválida — topic=${topic} delivery=${deliveryId} bytes=${raw.length}`)
        return json(res, 401, { error: 'firma inválida' })
      }
      // Firma verificada: seguro loguear el payload completo para depurar la integración.
      console.log(`[wc-webhook] recibido — topic=${topic} delivery=${deliveryId}\n${raw}`)
      let payload; try { payload = JSON.parse(raw) } catch { return json(res, 200, { ok: true, ignored: 'sin_payload' }) }
      if (topic.startsWith('subscription')) {
        try { return json(res, 200, { ok: true, ...syncDesdeWC(payload) }) }
        catch (e) { console.error('[wc-webhook]', e.message); return json(res, 200, { ok: false, error: 'proc' }) }
      }
      if (topic.startsWith('product')) {
        try { return json(res, 200, { ok: true, ...syncProductoDesdeWC(payload) }) }
        catch (e) { console.error('[wc-webhook]', e.message); return json(res, 200, { ok: false, error: 'proc' }) }
      }
      if (topic.startsWith('order')) {
        const base = APP_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
        try { return json(res, 200, { ok: true, ...(await procesarOrdenWC(payload, { base })) }) }
        catch (e) { console.error('[wc-webhook]', e.message); return json(res, 200, { ok: false, error: 'proc' }) }
      }
      return json(res, 200, { ok: true, ignored: topic || 'sin_topic' })
    }

    if (p === '/api/login' && method === 'POST') {
      const b = await readBody(req)
      const id = String(b.username || '').trim()
      const idLower = id.toLowerCase()
      const u = getCollection('im_users').find(x => x.activo && (x.username === id || (x.email && x.email.toLowerCase() === idLower)))
      if (!u || !verifyPassword(b.password || '', u.password)) throw httpErr(401, 'Usuario o contraseña incorrectos')
      const token = crearSesion('staff', u.id, u.rol)
      return json(res, 200, { token, user: sinPassword(u) })
    }
    if (p === '/api/portal/login' && method === 'POST') {
      const b = await readBody(req)
      const id = String(b.identificador || '').trim()
      const idLower = id.toLowerCase()
      const clientes = getCollection('im_clientes')
      const c = clientes.find(x => x.activo && (x.email === id || x.username === id))
      if (c && verifyPassword(b.password || '', c.password)) {
        const token = crearSesion('cliente', c.id, '')
        return json(res, 200, { token, cliente: sinPassword(c) })
      }
      // ¿Es la credencial de un entrenador de un box? Mismo acceso que el cliente principal.
      for (const cli of clientes) {
        if (!cli.activo || !cli.esBox) continue
        const cred = (cli.credencialesExtra || []).find(cr => cr.activo && cr.email.toLowerCase() === idLower)
        if (cred && verifyPassword(b.password || '', cred.password)) {
          const token = crearSesion('cliente', cli.id, `cred:${cred.id}`)
          return json(res, 200, { token, cliente: sinPassword(cli) })
        }
      }
      throw httpErr(401, 'Credenciales incorrectas o cliente inactivo')
    }

    // ── Reset de contraseña olvidada (público) ──
    if (p === '/api/portal/forgot-password' && method === 'POST') {
      const b = await readBody(req)
      const email = String(b.email || b.identificador || '').trim().toLowerCase()
      const c = getCollection('im_clientes').find(x => x.activo && (x.email || '').toLowerCase() === email)
      if (c && c.email) {
        db.prepare(`DELETE FROM _password_resets WHERE cliente_id = ? AND tipo = 'cliente'`).run(c.id) // invalida anteriores
        const rtoken = crypto.randomBytes(32).toString('hex')
        db.prepare(`INSERT INTO _password_resets (token, cliente_id, expira, tipo) VALUES (?,?,?,'cliente')`).run(rtoken, c.id, Date.now() + PASSWORD_RESET_TTL)
        const base = APP_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
        const link = `${base}/reset?token=${rtoken}`
        const html = emailResetHtml({ nombre: c.nombre, link, logoUrl: `${base}/tn-logo-email.png` })
        sendMail({ to: c.email, subject: 'Restablecer tu contraseña · Training Norte', html })
          .catch(err => console.warn('[email] no se pudo enviar el reset:', err.message))
        if (!emailConfigured()) console.log('[email] Gmail API sin configurar. Enlace de reset:', link)
      }
      return json(res, 200, { ok: true }) // nunca revelamos si el email existe
    }

    if (p === '/api/portal/reset-password' && method === 'POST') {
      const b = await readBody(req)
      const rtoken = String(b.token || '')
      const nueva = String(b.nueva || '')
      validarPasswordFuerte(nueva)
      const row = db.prepare(`SELECT * FROM _password_resets WHERE token = ? AND tipo = 'cliente'`).get(rtoken)
      if (!row || row.expira < Date.now()) {
        if (row) db.prepare(`DELETE FROM _password_resets WHERE token = ?`).run(rtoken)
        throw httpErr(400, 'El enlace no es válido o ha caducado')
      }
      const arr = getCollection('im_clientes')
      const idx = arr.findIndex(c => c.id === row.cliente_id)
      if (idx < 0) throw httpErr(404, 'Cliente no encontrado')
      arr[idx] = { ...arr[idx], password: hashPassword(nueva) }
      setCollection('im_clientes', arr)
      db.prepare(`DELETE FROM _password_resets WHERE cliente_id = ? AND tipo = 'cliente'`).run(row.cliente_id)
      return json(res, 200, { ok: true })
    }

    // ── Reset de contraseña olvidada del panel de administradores (público) ──
    if (p === '/api/staff/forgot-password' && method === 'POST') {
      const b = await readBody(req)
      const email = String(b.email || '').trim().toLowerCase()
      const u = getCollection('im_users').find(x => x.activo && (x.email || '').toLowerCase() === email)
      if (u && u.email) {
        db.prepare(`DELETE FROM _password_resets WHERE cliente_id = ? AND tipo = 'staff'`).run(u.id) // invalida anteriores
        const rtoken = crypto.randomBytes(32).toString('hex')
        db.prepare(`INSERT INTO _password_resets (token, cliente_id, expira, tipo) VALUES (?,?,?,'staff')`).run(rtoken, u.id, Date.now() + PASSWORD_RESET_TTL)
        const base = APP_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
        const link = `${base}/admin/reset?token=${rtoken}`
        const html = emailResetHtml({ nombre: u.nombre, link, logoUrl: `${base}/tn-logo-email.png` })
        sendMail({ to: u.email, subject: 'Restablecer tu contraseña · Training Norte', html })
          .catch(err => console.warn('[email] no se pudo enviar el reset:', err.message))
        if (!emailConfigured()) console.log('[email] Gmail API sin configurar. Enlace de reset (staff):', link)
      }
      return json(res, 200, { ok: true }) // nunca revelamos si el email existe
    }

    if (p === '/api/staff/reset-password' && method === 'POST') {
      const b = await readBody(req)
      const rtoken = String(b.token || '')
      const nueva = String(b.nueva || '')
      validarPasswordFuerte(nueva)
      const row = db.prepare(`SELECT * FROM _password_resets WHERE token = ? AND tipo = 'staff'`).get(rtoken)
      if (!row || row.expira < Date.now()) {
        if (row) db.prepare(`DELETE FROM _password_resets WHERE token = ?`).run(rtoken)
        throw httpErr(400, 'El enlace no es válido o ha caducado')
      }
      const arr = getCollection('im_users')
      const idx = arr.findIndex(u => u.id === row.cliente_id)
      if (idx < 0) throw httpErr(404, 'Usuario no encontrado')
      arr[idx] = { ...arr[idx], password: hashPassword(nueva) }
      setCollection('im_users', arr)
      db.prepare(`DELETE FROM _password_resets WHERE cliente_id = ? AND tipo = 'staff'`).run(row.cliente_id)
      return json(res, 200, { ok: true })
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
        im_respiraciones: getCollection('im_respiraciones'),
        im_movilidad: getCollection('im_movilidad'),
      })
    }

    // ── Portal cliente: cambiar su propia contraseña ──
    if (p === '/api/portal/change-password' && method === 'POST') {
      if (ses.tipo !== 'cliente') throw httpErr(403, 'Solo clientes')
      const b = await readBody(req)
      const actual = String(b.actual || '')
      const nueva = String(b.nueva || '')
      validarPasswordFuerte(nueva)
      const arr = getCollection('im_clientes')
      const idx = arr.findIndex(c => c.id === ses.sujeto_id)
      if (idx < 0) throw httpErr(404, 'Cliente no encontrado')
      // Si la sesión es de un entrenador (credencial extra), cambia SU contraseña,
      // no la del cliente principal del box.
      const credId = String(ses.rol || '').startsWith('cred:') ? ses.rol.slice(5) : null
      if (credId) {
        const creds = arr[idx].credencialesExtra || []
        const ci = creds.findIndex(cr => cr.id === credId)
        if (ci < 0) throw httpErr(404, 'Credencial no encontrada')
        if (!verifyPassword(actual, creds[ci].password)) throw httpErr(400, 'La contraseña actual no es correcta')
        const nuevasCreds = [...creds]; nuevasCreds[ci] = { ...nuevasCreds[ci], password: hashPassword(nueva) }
        arr[idx] = { ...arr[idx], credencialesExtra: nuevasCreds }
      } else {
        if (!verifyPassword(actual, arr[idx].password)) throw httpErr(400, 'La contraseña actual no es correcta')
        arr[idx] = { ...arr[idx], password: hashPassword(nueva) }
      }
      setCollection('im_clientes', arr)
      return json(res, 200, { ok: true })
    }

    // ── Portal cliente: renovar una suscripción (vía WooCommerce) ──
    if (p === '/api/portal/renew' && method === 'POST') {
      if (ses.tipo !== 'cliente') throw httpErr(403, 'Solo clientes')
      if (!RENEW.url || !RENEW.secret) throw httpErr(503, 'Renovación no configurada')
      const b = await readBody(req)
      const cli = getCollection('im_clientes').find(c => c.id === ses.sujeto_id)
      if (!cli) throw httpErr(404, 'Cliente no encontrado')
      const cat = getCollection('im_suscripciones_catalogo').find(c => c.id === b.catalogoId)
      if (!cat) throw httpErr(404, 'Producto no encontrado')
      if (!cat.wcProductId) throw httpErr(400, 'Este producto no admite renovación online')
      const mode = b.mode === 'resubscribe' ? 'resubscribe' : 'renew'
      let wres, data
      try {
        wres = await fetch(RENEW.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tn-secret': RENEW.secret },
          body: JSON.stringify({ email: cli.email, product_id: cat.wcProductId, mode }),
          signal: AbortSignal.timeout(25000),
        })
        data = await wres.json().catch(() => ({}))
      } catch (e) { throw httpErr(502, 'No se pudo contactar con la tienda') }
      if (!wres.ok) throw httpErr(wres.status === 404 ? 404 : 502, data.error || 'No se pudo renovar')
      return json(res, 200, data) // { status: 'paid' } | { status: 'needs_action', payment_url }
    }

    // ── Portal cliente (box): gestionar sus propios entrenadores ──
    if (p === '/api/portal/credenciales' && method === 'POST') {
      if (ses.tipo !== 'cliente') throw httpErr(403, 'Solo clientes')
      const b = await readBody(req)
      return json(res, 201, agregarCredencial(ses.sujeto_id, b))
    }
    const credPortalDel = p.match(/^\/api\/portal\/credenciales\/([^/]+)$/)
    if (credPortalDel && method === 'DELETE') {
      if (ses.tipo !== 'cliente') throw httpErr(403, 'Solo clientes')
      return json(res, 200, borrarCredencial(ses.sujeto_id, decodeURIComponent(credPortalDel[1])))
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
        if (key === 'im_suscripciones_catalogo' && Array.isArray(value)) {
          const actuales = getCollection(key)
          for (const nuevo of value) {
            const previo = actuales.find(c => c.id === nuevo.id)
            const eraActivo = !previo || previo.activo !== false
            const seraActivo = nuevo.activo !== false
            if (eraActivo && !seraActivo && tieneAsignacionActiva(nuevo.id)) {
              throw httpErr(409, `No se puede desactivar "${nuevo.nombre}": hay clientes con esta suscripción vigente asignada`)
            }
          }
        }
        setCollection(key, value)
        return json(res, 200, { ok: true })
      }
    }

    // REST de dominio
    if (p === '/api/users' && method === 'GET') return json(res, 200, domain.listUsers())
    if (p === '/api/users' && method === 'POST') { if (!esAdmin) throw httpErr(403, 'Solo un administrador puede crear usuarios'); return json(res, 201, domain.createUser(await readBody(req))) }
    if (p === '/api/products' && method === 'GET') return json(res, 200, domain.listProducts())
    if (p === '/api/products' && method === 'POST') { if (!esAdmin) throw httpErr(403, 'Solo un administrador puede crear productos'); return json(res, 201, domain.createProduct(await readBody(req))) }
    const prodActivo = p.match(/^\/api\/products\/([^/]+)\/activo$/)
    if (prodActivo && method === 'PUT') {
      if (!esAdmin) throw httpErr(403, 'Solo un administrador puede activar/desactivar suscripciones')
      const b = await readBody(req)
      return json(res, 200, domain.setProductoActivo(decodeURIComponent(prodActivo[1]), b.activo === true))
    }
    // Envío de prueba del mensaje de bienvenida (email) que se está editando, sin guardarlo aún.
    if (p === '/api/staff/test-bienvenida-email' && method === 'POST') {
      const b = await readBody(req)
      const to = String(b.to || '').trim()
      if (!to) throw httpErr(400, 'Falta el email de destino')
      const mensaje = interpolarMensaje(String(b.mensaje || ''), 'Prueba')
      const base = APP_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
      const html = emailBienvenidaHtml({ mensaje, logoUrl: `${base}/tn-logo-email.png` })
      try { await sendMail({ to, subject: '[PRUEBA] ¡Bienvenido/a a Training Norte!', html }) }
      catch (e) { throw httpErr(502, e.message || 'No se pudo enviar el email de prueba') }
      return json(res, 200, { ok: true })
    }
    if (p === '/api/programs' && method === 'GET') return json(res, 200, domain.listPrograms())
    if (p === '/api/clients' && method === 'GET') return json(res, 200, domain.listClients())
    if (p === '/api/clients' && method === 'POST') { if (!esAdmin) throw httpErr(403, 'Solo un administrador puede crear clientes'); return json(res, 201, domain.createClient(await readBody(req))) }
    const asg = p.match(/^\/api\/clients\/([^/]+)\/subscriptions$/)
    if (asg && method === 'POST') { if (!esAdmin) throw httpErr(403, 'Solo un administrador puede asignar productos'); return json(res, 201, domain.assignProduct(decodeURIComponent(asg[1]), await readBody(req))) }
    const credAdmin = p.match(/^\/api\/clients\/([^/]+)\/credenciales$/)
    if (credAdmin && method === 'POST') {
      if (!esAdmin) throw httpErr(403, 'Solo un administrador puede añadir entrenadores')
      return json(res, 201, agregarCredencial(decodeURIComponent(credAdmin[1]), await readBody(req)))
    }
    const credAdminDel = p.match(/^\/api\/clients\/([^/]+)\/credenciales\/([^/]+)$/)
    if (credAdminDel && method === 'DELETE') {
      if (!esAdmin) throw httpErr(403, 'Solo un administrador puede eliminar entrenadores')
      return json(res, 200, borrarCredencial(decodeURIComponent(credAdminDel[1]), decodeURIComponent(credAdminDel[2])))
    }

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
