import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync('data/prod_snapshot.db')
const ej = db.prepare('SELECT id,data FROM im_ejercicios').all()
const pr = db.prepare('SELECT id,data FROM im_programas').all()
let bad=0
const ejIds = new Set()
for (const r of ej){ try{ const o=JSON.parse(r.data); ejIds.add(o.id); }catch{ bad++; console.log('JSON malo ejercicio',r.id)} }
console.log('ejercicios parseados:', ej.length, '| ids únicos:', ejIds.size, '| JSON inválidos:', bad)

let prBad=0, refs=0, orphans=0, bloques=0
let sample=null
for (const r of pr){
  let o; try{ o=JSON.parse(r.data) }catch{ prBad++; continue }
  for (const s of o.semanas||[]) for (const d of s.dias||[]) for (const b of d.bloques||[]){
    bloques++
    for (const e of b.ejercicios||[]){ refs++; if(!ejIds.has(e.ejercicioId)) orphans++ }
  }
  if(o.nombre==='TN BOX - JUNIO  2026' && !sample) sample=o
}
console.log('programas parseados:', pr.length, '| JSON inválidos:', prBad)
console.log('bloques:', bloques, '| refs a ejercicios:', refs, '| huérfanas:', orphans)
if(sample){
  const s1=sample.semanas[0], d=s1.dias.find(x=>x.bloques.length)||s1.dias[0]
  const b=d.bloques[0]
  console.log('--- muestra programa:', sample.nombre, '| semanas:', sample.semanas.length)
  console.log('   bloque0:', JSON.stringify({nombre:b.nombre,cronometro:b.cronometro,nEj:b.ejercicios.length}))
  // resolver nombres de 3 ejercicios del bloque
  const byId=new Map(ej.map(r=>[JSON.parse(r.data).id, JSON.parse(r.data).nombre]))
  console.log('   ejercicios:', b.ejercicios.slice(0,3).map(e=>byId.get(e.ejercicioId)).join(' | '))
}
db.close()
