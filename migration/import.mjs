import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

const dbPath = process.argv[2]
if (!dbPath) { console.error('uso: node import.mjs <ruta.db>'); process.exit(1) }

const ejercicios = JSON.parse(readFileSync('data/import_ejercicios.json','utf8'))
const programas  = JSON.parse(readFileSync('data/import_programas.json','utf8'))

const db = new DatabaseSync(dbPath)

function importar(tabla, items) {
  const existentes = new Set(db.prepare(`SELECT id FROM ${tabla}`).all().map(r => r.id))
  const maxOrd = db.prepare(`SELECT COALESCE(MAX(ord),-1) m FROM ${tabla}`).get().m
  let ord = maxOrd + 1
  const ins = db.prepare(`INSERT INTO ${tabla} (ord, id, data) VALUES (?, ?, ?)`)
  let added = 0, skipped = 0
  db.exec('BEGIN')
  try {
    for (const it of items) {
      if (existentes.has(it.id)) { skipped++; continue }
      ins.run(ord++, it.id, JSON.stringify(it))
      added++
    }
    db.exec('COMMIT')
  } catch (e) { db.exec('ROLLBACK'); throw e }
  const total = db.prepare(`SELECT count(*) c FROM ${tabla}`).get().c
  console.log(`${tabla}: +${added} añadidos, ${skipped} ya existían -> total ${total}`)
}

console.log('--- ANTES ---')
for (const t of ['im_ejercicios','im_programas'])
  console.log(`${t}: ${db.prepare(`SELECT count(*) c FROM ${t}`).get().c}`)
console.log('--- IMPORTANDO ---')
importar('im_ejercicios', ejercicios)
importar('im_programas', programas)
db.close()
