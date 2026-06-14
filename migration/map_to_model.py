#!/usr/bin/env python3
import json, sys

DATA='migration/data'
exercises = json.load(open(f'{DATA}/exercises.json'))
programs  = json.load(open(f'{DATA}/programs_tn.json'))

# ---- contador de ids deterministas para sub-elementos ----
_c = {'n':0}
def nid(pfx):
    _c['n'] += 1
    return f'{pfx}_{_c["n"]:06d}'

def fmt_sec(s):
    if not s: return None
    if s % 60 == 0: return f"{s//60}'"
    return f"{s//60}'{s%60:02d}\"" if s>=60 else f'{s}"'

def cronometro(b):
    t = b.get('chronometerType')
    label = {'EMOM':'EMOM','AMRAP':'AMRAP','INTERVALS':'Intervalos','ASCENDENT':'Ascendente'}.get(t,'')
    parts = []
    if label: parts.append(label)
    tt = fmt_sec(b.get('totalTime'))
    wt = fmt_sec(b.get('workTime'))
    rt = fmt_sec(b.get('restTime'))
    tr = b.get('totalRounds')
    if t == 'INTERVALS' and (wt or rt):
        parts.append(f"{wt or '–'}/{rt or '–'}")
    elif tt:
        parts.append(tt)
    if tr: parts.append(f"{tr} rounds")
    if t in (None,'') and rt and 'Intervalos' not in parts:
        parts.append(f"descanso {rt}")
    return ' · '.join(parts)

# ---- ejercicios -> modelo {id,nombre,explicacion,video,thumbnail} ----
ej_out = [{'id':e['id'],'nombre':e['nombre'],'explicacion':e['explicacion'],'video':e['video'],'thumbnail':e.get('thumbnail','')} for e in exercises]
ej_ids = {e['id'] for e in ej_out}

# ---- programas -> modelo ----
orphans = set()
prog_out = []
for p in programs:
    semanas = []
    for wi, wk in enumerate(sorted(p.get('weeks') or [], key=lambda w:w['order'])):
        dias_by_order = {d['order']: d for d in (wk.get('days') or [])}
        dias = []
        for order in range(1, 8):  # Lunes..Domingo
            src_day = dias_by_order.get(order)
            bloques = []
            if src_day:
                for b in sorted(src_day.get('blocks') or [], key=lambda x:x['order']):
                    ejs = []
                    for be in (b.get('exercises') or []):
                        eid = be['exerciseId']
                        if eid not in ej_ids: orphans.add(eid)
                        ejs.append({'id':nid('eb'),'ejercicioId':eid,'series':'','reps':'','descanso':'','notas':''})
                    bloques.append({
                        'id':nid('bl'),
                        'nombre': b.get('name') or '',
                        'instrucciones': b.get('trainingInstructions') or '',
                        'notas': b.get('technicalNotes') or '',
                        'cronometro': cronometro(b),
                        'ejercicios': ejs,
                        'esPlantilla': False,
                        'creadoEn': '2026-06-14T00:00:00.000Z',
                    })
            dias.append({'bloques':bloques})
        semanas.append({'id':nid('sem'),'numero':wi+1,'dias':dias})
    prog_out.append({
        'id':p['id'],
        'nombre':p['name'],
        'descripcion':p.get('description') or '',
        'semanas':semanas,
        'creadoEn':'2026-06-14T00:00:00.000Z',
    })

json.dump(ej_out, open(f'{DATA}/import_ejercicios.json','w'), ensure_ascii=False)
json.dump(prog_out, open(f'{DATA}/import_programas.json','w'), ensure_ascii=False)

print('ejercicios ->', len(ej_out))
print('programas  ->', len(prog_out))
print('referencias huérfanas (exerciseId borrado, no en librería):', len(orphans))
# tamaños
import os
print('import_ejercicios.json:', round(os.path.getsize(f"{DATA}/import_ejercicios.json")/1024/1024,2),'MB')
print('import_programas.json :', round(os.path.getsize(f"{DATA}/import_programas.json")/1024/1024,2),'MB')
# muestra de cronometros
print('--- muestra cronometros ---')
seen=set()
for p in prog_out:
    for s in p['semanas']:
        for d in s['dias']:
            for b in d['bloques']:
                if b['cronometro'] and b['cronometro'] not in seen:
                    seen.add(b['cronometro']); print('  ', b['cronometro'])
                if len(seen)>=8: break
