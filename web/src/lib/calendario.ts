// Lógica de fusión de calendarios del portal del cliente (extraída para poder
// probarla de forma aislada). Agrupa los bloques de varios calendarios por
// semana (lunes) y por día (0=Lun … 6=Dom).
import { DIAS_SEMANA, type Bloque, type CalendarioCliente } from '../types'
import { addDays } from '../context/CalendariosContext'

export interface BloqueConColor extends Bloque {
  calId: string
  calNombre: string
  colorKey: string
}
export interface DiaFusion {
  fecha: string
  diaSemana: number
  bloques: BloqueConColor[]
}
export interface SemanaFusion {
  fechaLunes: string
  dias: DiaFusion[]
}

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function lunesDe(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = date.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + diff)
  return toISO(date)
}

export function fusionarCalendarios(cals: CalendarioCliente[]): SemanaFusion[] {
  const semanaMap = new Map<string, DiaFusion[]>()

  cals.forEach(cal => {
    const colorKey = cal.colorKey ?? 'yellow'
    cal.semanas.forEach(semana => {
      const lunes = semana.fechaLunes ?? lunesDe(semana.dias[0]?.fecha ?? '')
      if (!semanaMap.has(lunes)) {
        const dias: DiaFusion[] = DIAS_SEMANA.map((_, i) => ({
          fecha: addDays(lunes, i), diaSemana: i, bloques: [],
        }))
        semanaMap.set(lunes, dias)
      }
      const dias = semanaMap.get(lunes)!
      semana.dias.forEach((dia, diaIdx) => {
        dia.bloques.forEach(bloque => {
          dias[diaIdx]?.bloques.push({ ...bloque, calId: cal.id, calNombre: cal.programaNombre, colorKey })
        })
      })
    })
  })

  return Array.from(semanaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fechaLunes, dias]) => ({ fechaLunes, dias }))
}
