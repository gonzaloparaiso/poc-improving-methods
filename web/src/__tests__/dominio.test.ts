import { describe, it, expect } from 'vitest'
import { addDays, siguienteLunes } from '../context/CalendariosContext'
import { suscripcionVigente } from '../context/ClientesContext'
import { getLunes } from '../components/LunesPicker'
import type { SuscripcionCliente } from '../types'

describe('fechas', () => {
  it('addDays suma días', () => {
    expect(addDays('2026-01-01', 5)).toBe('2026-01-06')
  })
  it('addDays cruza fin de mes', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
  })
  it('addDays con negativos', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('siguienteLunes devuelve una fecha ISO válida no anterior a hoy', () => {
    const iso = siguienteLunes()
    expect(/^\d{4}-\d{2}-\d{2}$/.test(iso)).toBe(true)
    const hoyISO = new Date().toISOString().split('T')[0]
    // Puede ser hoy (si hoy es lunes) o más adelante
    expect(iso >= addDays(hoyISO, -1)).toBe(true)
  })
  it('getLunes devuelve el lunes de la semana de la fecha dada', () => {
    // 2026-06-17 es miércoles → su lunes es 2026-06-15
    expect(getLunes('2026-06-17')).toBe('2026-06-15')
    // un lunes se devuelve a sí mismo
    expect(getLunes('2026-06-15')).toBe('2026-06-15')
    // un domingo pertenece a la semana que empezó el lunes anterior
    expect(getLunes('2026-06-21')).toBe('2026-06-15')
  })
})

describe('suscripcionVigente', () => {
  const hoy = new Date()
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const enDias = (n: number) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return iso(d) }

  const base: SuscripcionCliente = {
    id: 's1', catalogoId: 'cat1', clienteId: 'c1',
    fechaInicio: enDias(-10), fechaFin: enDias(10), activa: true,
  }

  it('vigente si hoy está dentro del rango y está activa', () => {
    expect(suscripcionVigente(base)).toBe(true)
  })
  it('no vigente si ya caducó', () => {
    expect(suscripcionVigente({ ...base, fechaFin: enDias(-1) })).toBe(false)
  })
  it('no vigente si aún no ha empezado', () => {
    expect(suscripcionVigente({ ...base, fechaInicio: enDias(2) })).toBe(false)
  })
  it('no vigente si está desactivada aunque esté en rango', () => {
    expect(suscripcionVigente({ ...base, activa: false })).toBe(false)
  })
})
