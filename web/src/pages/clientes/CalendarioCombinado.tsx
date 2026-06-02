import { useState } from 'react'
import { type CalendarioCliente, type Bloque, DIAS_SEMANA, CALENDAR_COLORS } from '../../types'
import { fmtFecha, addDays } from '../../context/CalendariosContext'
import { EJERCICIOS } from '../../data/ejercicios'

interface BloqueConColor extends Bloque {
  calId: string
  calNombre: string
  colorKey: string
}

interface DiaFusion {
  fecha: string
  diaSemana: number
  bloques: BloqueConColor[]
}

interface SemanaFusion {
  fechaLunes: string
  dias: DiaFusion[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Lunes de la semana de una fecha ISO */
function lunesDe(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = date.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + diff)
  return toISO(date)
}

/** Fusiona todos los calendarios seleccionados en semanas ordenadas */
function fusionarCalendarios(cals: CalendarioCliente[]): SemanaFusion[] {
  // Mapa: fechaLunes → DiaFusion[]
  const semanaMap = new Map<string, DiaFusion[]>()

  cals.forEach(cal => {
    const colorKey = cal.colorKey ?? 'yellow'
    cal.semanas.forEach(semana => {
      const lunes = semana.fechaLunes ?? lunesDe(semana.dias[0]?.fecha ?? '')
      if (!semanaMap.has(lunes)) {
        // Crear semana vacía con 7 días
        const dias: DiaFusion[] = DIAS_SEMANA.map((_, i) => ({
          fecha: addDays(lunes, i),
          diaSemana: i,
          bloques: [],
        }))
        semanaMap.set(lunes, dias)
      }
      const dias = semanaMap.get(lunes)!
      semana.dias.forEach((dia, diaIdx) => {
        dia.bloques.forEach(bloque => {
          dias[diaIdx]?.bloques.push({
            ...bloque,
            calId: cal.id,
            calNombre: cal.programaNombre,
            colorKey,
          })
        })
      })
    })
  })

  return Array.from(semanaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fechaLunes, dias]) => ({ fechaLunes, dias }))
}

// ── Componente ─────────────────────────────────────────────────────────────────

interface Props {
  calendarios: CalendarioCliente[]
  onVolver: () => void
}

export default function CalendarioCombinado({ calendarios, onVolver }: Props) {
  const semanas = fusionarCalendarios(calendarios)
  const [vista, setVista] = useState<number | 'todas'>(0)

  const semanaActual = typeof vista === 'number' ? semanas[vista] : null
  const hoy = toISO(new Date())

  const totalBloques = semanas.reduce(
    (acc, s) => acc + s.dias.reduce((a, d) => a + d.bloques.length, 0), 0
  )

  function GridSemana({ semana }: { semana: SemanaFusion }) {
    return (
      <div className="overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
        <div className="grid grid-cols-7 gap-2 min-w-[700px]">
          {semana.dias.map((dia) => {
            const esHoy = dia.fecha === hoy
            return (
              <div key={dia.fecha} className="flex flex-col gap-2">
                {/* Cabecera */}
                <div className={`text-center rounded-lg py-1.5 ${esHoy ? 'bg-tn-yellow/10 border border-tn-yellow/30' : ''}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider ${esHoy ? 'text-tn-yellow' : 'text-tn-muted'}`}>
                    {DIAS_SEMANA[dia.diaSemana].slice(0, 3)}
                  </p>
                  <p className={`text-xs mt-0.5 ${esHoy ? 'text-tn-yellow font-semibold' : 'text-tn-muted/60'}`}>
                    {fmtFecha(dia.fecha)}
                  </p>
                </div>

                {/* Bloques */}
                <div className="space-y-2 min-h-[60px]">
                  {dia.bloques.length === 0 && (
                    <div className="border border-dashed border-tn-border/40 rounded-xl h-10" />
                  )}
                  {dia.bloques.map((bloque, bi) => {
                    const colorDef = CALENDAR_COLORS.find(c => c.key === bloque.colorKey) ?? CALENDAR_COLORS[0]
                    return (
                      <div
                        key={`${bloque.id}-${bi}`}
                        className={`card p-3 border-l-2`}
                        style={{ borderLeftColor: colorDef.accent }}
                      >
                        {/* Indicador de programa */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: colorDef.accent }}
                          />
                          <span className="text-tn-muted text-xs truncate">{bloque.calNombre}</span>
                        </div>

                        <p className="text-white font-semibold text-xs leading-tight line-clamp-2 mb-1">
                          {bloque.nombre}
                        </p>

                        {bloque.cronometro && (
                          <p className="text-xs font-mono mb-1" style={{ color: colorDef.accent }}>
                            ⏱ {bloque.cronometro}
                          </p>
                        )}

                        {bloque.ejercicios.length > 0 && (
                          <div className="space-y-0.5">
                            {bloque.ejercicios.slice(0, 2).map(ej => {
                              const ejercicio = EJERCICIOS.find(e => e.id === ej.ejercicioId)
                              return (
                                <p key={ej.id} className="text-tn-muted text-xs truncate">
                                  · {ejercicio?.nombre ?? '—'}
                                  {ej.series && ej.reps && (
                                    <span className="text-tn-muted/60"> {ej.series}×{ej.reps}</span>
                                  )}
                                </p>
                              )
                            })}
                            {bloque.ejercicios.length > 2 && (
                              <p className="text-tn-muted/60 text-xs">+{bloque.ejercicios.length - 2}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <button onClick={onVolver}
          className="p-2 text-tn-muted hover:text-white hover:bg-tn-card rounded-lg transition-all mt-0.5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black text-white">Vista combinada</h2>
          <p className="text-tn-muted text-sm mt-0.5">
            {semanas.length} semana{semanas.length !== 1 ? 's' : ''} · {totalBloques} bloques totales
          </p>
        </div>
      </div>

      {/* ── Leyenda de calendarios ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {calendarios.map(cal => {
          const colorDef = CALENDAR_COLORS.find(c => c.key === cal.colorKey) ?? CALENDAR_COLORS[0]
          return (
            <div
              key={cal.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${colorDef.cls}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorDef.accent }} />
              <span style={{ color: colorDef.accent }}>{cal.programaNombre}</span>
              <span className="text-tn-muted">desde {fmtFecha(cal.fechaInicio)}</span>
            </div>
          )
        })}
      </div>

      {/* ── Tabs semanas ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
        <button
          onClick={() => setVista('todas')}
          className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            vista === 'todas' ? 'bg-tn-yellow text-tn-black' : 'text-tn-muted hover:text-white hover:bg-tn-card border border-tn-border'
          }`}
        >
          Todas
        </button>
        {semanas.map((s, i) => (
          <button key={s.fechaLunes} onClick={() => setVista(i)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              vista === i ? 'bg-tn-yellow text-tn-black' : 'text-tn-muted hover:text-white hover:bg-tn-card border border-tn-border'
            }`}
          >
            <span>Sem {i + 1}</span>
            <span className="hidden sm:inline text-xs ml-1.5 opacity-70">{fmtFecha(s.fechaLunes)}</span>
          </button>
        ))}
      </div>

      {/* ── Vista semana individual ─────────────────────────────────────── */}
      {semanaActual && <GridSemana semana={semanaActual} />}

      {/* ── Vista todas ─────────────────────────────────────────────────── */}
      {vista === 'todas' && (
        <div className="space-y-8">
          {semanas.map((semana, i) => (
            <div key={semana.fechaLunes} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-white font-bold whitespace-nowrap">Semana {i + 1}</h3>
                <span className="text-tn-muted text-xs">
                  {fmtFecha(semana.fechaLunes)} → {fmtFecha(addDays(semana.fechaLunes, 6))}
                </span>
                <div className="flex-1 h-px bg-tn-border" />
                <span className="text-tn-muted text-xs whitespace-nowrap">
                  {semana.dias.reduce((a, d) => a + d.bloques.length, 0)} bloques
                </span>
              </div>
              <GridSemana semana={semana} />
            </div>
          ))}
        </div>
      )}

      {semanas.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-14 text-center">
          <p className="text-white font-semibold mb-1">Sin entrenamientos</p>
          <p className="text-tn-muted text-sm">Los calendarios seleccionados no tienen bloques asignados todavía.</p>
        </div>
      )}
    </div>
  )
}
