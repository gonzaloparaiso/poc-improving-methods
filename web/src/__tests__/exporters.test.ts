import { describe, it, expect } from 'vitest'
import { textoBloque } from '../pages/portal/exporters'
import type { Bloque, Ejercicio } from '../types'

const catalogo: Ejercicio[] = [
  { id: 'e1', nombre: 'Back Squat', explicacion: '', video: '' },
  { id: 'e2', nombre: 'Burpees', explicacion: '', video: '' },
]

function bloque(overrides: Partial<Bloque> = {}): Bloque {
  return {
    id: 'b1', nombre: 'WOD del día', instrucciones: '', notas: '', cronometro: '',
    ejercicios: [], esPlantilla: false, creadoEn: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('textoBloque', () => {
  it('incluye el nombre del bloque como primera línea', () => {
    const texto = textoBloque(bloque({ nombre: 'AMRAP 12' }), catalogo)
    expect(texto.split('\n')[0]).toBe('AMRAP 12')
  })

  it('incluye el cronómetro con el icono de reloj', () => {
    const texto = textoBloque(bloque({ cronometro: "EMOM 15'" }), catalogo)
    expect(texto).toContain("⏱ EMOM 15'")
  })

  it('incluye las instrucciones', () => {
    const texto = textoBloque(bloque({ instrucciones: 'Calienta bien antes de empezar' }), catalogo)
    expect(texto).toContain('Calienta bien antes de empezar')
  })

  it('lista los ejercicios con series×reps y descanso, resolviendo el nombre', () => {
    const texto = textoBloque(bloque({
      ejercicios: [
        { id: 'eb1', ejercicioId: 'e1', series: '3', reps: '10', descanso: '60s', notas: '' },
        { id: 'eb2', ejercicioId: 'e2', series: '', reps: '20', descanso: '', notas: 'ritmo constante' },
      ],
    }), catalogo)
    expect(texto).toContain('- Back Squat 3×10 descanso 60s')
    expect(texto).toContain('- Burpees 20 (ritmo constante)')
  })

  it('usa "—" si el ejercicio no existe en el catálogo', () => {
    const texto = textoBloque(bloque({
      ejercicios: [{ id: 'eb1', ejercicioId: 'no-existe', series: '', reps: '', descanso: '', notas: '' }],
    }), catalogo)
    expect(texto).toContain('- —')
  })

  it('incluye las notas del bloque al final, con prefijo "Notas:"', () => {
    const texto = textoBloque(bloque({ notas: 'Escala si hace falta' }), catalogo)
    expect(texto.trim().endsWith('Notas: Escala si hace falta')).toBe(true)
  })

  it('omite las secciones vacías (sin líneas en blanco de más)', () => {
    const texto = textoBloque(bloque({ nombre: 'Solo nombre' }), catalogo)
    expect(texto).toBe('Solo nombre')
  })
})
