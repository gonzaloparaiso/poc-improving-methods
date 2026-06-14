import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
const dbPath = process.argv[2]
const ejercicios = JSON.parse(readFileSync('data/import_ejercicios.json','utf8'))
const db = new DatabaseSync(dbPath)
const existing = new Map(db.prepare('SELECT id,data FROM im_ejercicios').all().map(r => [r.id, r.data]))
const upd = db.prepare('UPDATE im_ejercicios SET data=? WHERE id=?')
let changed=0, skip=0
db.exec('BEGIN')
try {
  for (const e of ejercicios) {
    if (!existing.has(e.id)) { skip++; continue }            // solo actualizamos existentes
    const cur = JSON.parse(existing.get(e.id))
    if (cur.thumbnail === e.thumbnail) { skip++; continue }   // ya tiene la miniatura
    upd.run(JSON.stringify({ ...cur, thumbnail: e.thumbnail }), e.id)  // preserva campos, añade thumbnail
    changed++
  }
  db.exec('COMMIT')
} catch(err){ db.exec('ROLLBACK'); throw err }
const withThumb = db.prepare("SELECT count(*) c FROM im_ejercicios WHERE data LIKE '%thumbnail%'").get().c
console.log(`actualizados: ${changed}, sin cambios: ${skip} | con thumbnail ahora: ${withThumb}`)
db.close()
