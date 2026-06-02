import { useState, useEffect, type FormEvent } from 'react'
import { type Bloque, type EjercicioEnBloque } from '../../types'
import { useEjercicios } from '../../context/EjerciciosContext'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

interface Props {
  bloque?: Bloque | null          // si viene, es edición
  modoPlantilla?: boolean          // si true, fuerza esPlantilla=true
  mostrarGuardarComoPlantilla?: boolean
  onGuardar: (bloque: Omit<Bloque, 'id' | 'creadoEn'>) => void
  onCancelar: () => void
}

const emptyEj = (): EjercicioEnBloque => ({
  id: genId(), ejercicioId: '', series: '3', reps: '10', descanso: '60s', notas: '',
})

export default function BloqueModal({
  bloque, modoPlantilla = false, mostrarGuardarComoPlantilla = true, onGuardar, onCancelar,
}: Props) {
  const [nombre, setNombre]           = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [notas, setNotas]             = useState('')
  const [cronometro, setCronometro]   = useState('')
  const [esPlantilla, setEsPlantilla] = useState(modoPlantilla)
  const [ejercicios, setEjercicios]   = useState<EjercicioEnBloque[]>([])
  const [busquedaEj, setBusquedaEj]   = useState('')
  const [mostrarSelector, setMostrarSelector] = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    if (bloque) {
      setNombre(bloque.nombre)
      setInstrucciones(bloque.instrucciones)
      setNotas(bloque.notas)
      setCronometro(bloque.cronometro)
      setEsPlantilla(bloque.esPlantilla)
      setEjercicios(bloque.ejercicios)
    }
    setError('')
  }, [bloque])

  const { ejercicios: catalogoEjercicios } = useEjercicios()

  const ejerciciosFiltrados = catalogoEjercicios.filter(e => {
    const q = busquedaEj.toLowerCase()
    return !q || e.nombre.toLowerCase().includes(q)
  })

  const añadirEjercicio = (ejercicioId: string) => {
    if (ejercicios.some(e => e.ejercicioId === ejercicioId)) return
    setEjercicios(prev => [...prev, { ...emptyEj(), ejercicioId }])
    setBusquedaEj('')
    setMostrarSelector(false)
  }

  const actualizarEjercicio = (id: string, campo: keyof EjercicioEnBloque, valor: string) => {
    setEjercicios(prev => prev.map(e => e.id === id ? { ...e, [campo]: valor } : e))
  }

  const quitarEjercicio = (id: string) => {
    setEjercicios(prev => prev.filter(e => e.id !== id))
  }

  const moverEjercicio = (id: string, dir: -1 | 1) => {
    const idx = ejercicios.findIndex(e => e.id === id)
    if (idx < 0) return
    const next = [...ejercicios]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setEjercicios(next)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return setError('El nombre del bloque es obligatorio')
    onGuardar({
      nombre: nombre.trim(),
      instrucciones: instrucciones.trim(),
      notas: notas.trim(),
      cronometro: cronometro.trim(),
      esPlantilla: modoPlantilla || esPlantilla,
      ejercicios,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="card w-full sm:max-w-2xl sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-tn-border flex-shrink-0">
          <div>
            <h3 className="text-white font-bold text-lg">
              {bloque ? 'Editar bloque' : modoPlantilla ? 'Nueva plantilla' : 'Nuevo bloque'}
            </h3>
            <p className="text-tn-muted text-xs mt-0.5">
              {modoPlantilla ? 'Se guardará en la biblioteca de plantillas' : 'Añadido al día seleccionado'}
            </p>
          </div>
          <button onClick={onCancelar} className="text-tn-muted hover:text-white p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Nombre */}
          <div>
            <label className="label">Nombre del bloque *</label>
            <input
              type="text" className="input-field" placeholder="Ej: Fuerza Lower Body"
              value={nombre} onChange={e => setNombre(e.target.value)} autoFocus required
            />
          </div>

          {/* Instrucciones */}
          <div>
            <label className="label">Instrucciones</label>
            <textarea
              className="input-field resize-none h-24"
              placeholder="Describe cómo ejecutar este bloque..."
              value={instrucciones} onChange={e => setInstrucciones(e.target.value)}
            />
          </div>

          {/* Notas + Cronómetro */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Notas</label>
              <input
                type="text" className="input-field"
                placeholder="Ej: Descanso entre series..."
                value={notas} onChange={e => setNotas(e.target.value)}
              />
            </div>
            <div>
              <label className="label">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Cronómetro
                </span>
              </label>
              <input
                type="text" className="input-field font-mono"
                placeholder="20:00"
                value={cronometro} onChange={e => setCronometro(e.target.value)}
              />
            </div>
          </div>

          {/* Ejercicios */}
          <div className="border-t border-tn-border pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">
                Ejercicios
                {ejercicios.length > 0 && (
                  <span className="ml-2 text-tn-muted font-normal">({ejercicios.length})</span>
                )}
              </p>
              <button
                type="button"
                onClick={() => setMostrarSelector(true)}
                className="flex items-center gap-1.5 text-tn-yellow text-sm font-semibold hover:text-tn-yellow-dark transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Añadir ejercicio
              </button>
            </div>

            {/* Selector de ejercicios */}
            {mostrarSelector && (
              <div className="bg-tn-dark border border-tn-border rounded-xl p-4 mb-4 space-y-3">
                <input
                  type="text" className="input-field"
                  placeholder="Buscar ejercicio..."
                  value={busquedaEj}
                  onChange={e => setBusquedaEj(e.target.value)}
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {ejerciciosFiltrados.map(ej => {
                    const yaAñadido = ejercicios.some(e => e.ejercicioId === ej.id)
                    return (
                      <button
                        key={ej.id}
                        type="button"
                        disabled={yaAñadido}
                        onClick={() => añadirEjercicio(ej.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                          yaAñadido
                            ? 'text-tn-muted cursor-not-allowed'
                            : 'text-white hover:bg-tn-card hover:text-tn-yellow'
                        }`}
                      >
                        <span className="font-medium">{ej.nombre}</span>
                        {yaAñadido && <span className="ml-2 text-xs text-tn-muted">ya añadido</span>}
                      </button>
                    )
                  })}
                  {ejerciciosFiltrados.length === 0 && (
                    <p className="text-tn-muted text-sm text-center py-3">Sin resultados</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setMostrarSelector(false); setBusquedaEj('') }}
                  className="text-tn-muted text-sm hover:text-white transition-colors"
                >
                  Cerrar
                </button>
              </div>
            )}

            {/* Lista de ejercicios añadidos */}
            {ejercicios.length === 0 ? (
              <div className="border border-dashed border-tn-border rounded-xl py-8 text-center">
                <p className="text-tn-muted text-sm">No hay ejercicios en este bloque</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ejercicios.map((ej, idx) => {
                  const ejercicio = catalogoEjercicios.find(e => e.id === ej.ejercicioId)
                  return (
                    <div key={ej.id} className="bg-tn-dark border border-tn-border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-tn-yellow/10 text-tn-yellow text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-white font-semibold text-sm">
                            {ejercicio?.nombre ?? 'Ejercicio desconocido'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button type="button" onClick={() => moverEjercicio(ej.id, -1)} disabled={idx === 0}
                            className="p-1 text-tn-muted hover:text-white disabled:opacity-30 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button type="button" onClick={() => moverEjercicio(ej.id, 1)} disabled={idx === ejercicios.length - 1}
                            className="p-1 text-tn-muted hover:text-white disabled:opacity-30 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button type="button" onClick={() => quitarEjercicio(ej.id)}
                            className="p-1 text-tn-muted hover:text-red-400 transition-colors ml-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { label: 'Series', field: 'series' as const, placeholder: '3' },
                          { label: 'Reps', field: 'reps' as const, placeholder: '10' },
                          { label: 'Descanso', field: 'descanso' as const, placeholder: '60s' },
                          { label: 'Notas', field: 'notas' as const, placeholder: 'Opcional' },
                        ].map(({ label, field, placeholder }) => (
                          <div key={field}>
                            <label className="text-tn-muted text-xs mb-1 block">{label}</label>
                            <input
                              type="text"
                              className="w-full bg-tn-card border border-tn-border rounded-lg px-2 py-1.5 text-white text-sm placeholder-tn-muted focus:outline-none focus:border-tn-yellow transition-colors"
                              placeholder={placeholder}
                              value={ej[field]}
                              onChange={e => actualizarEjercicio(ej.id, field, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Guardar como plantilla */}
          {mostrarGuardarComoPlantilla && !modoPlantilla && (
            <div className="border-t border-tn-border pt-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setEsPlantilla(p => !p)}
                  className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${esPlantilla ? 'bg-tn-yellow' : 'bg-tn-border'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${esPlantilla ? 'left-5' : 'left-1'}`} />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Guardar como plantilla</p>
                  <p className="text-tn-muted text-xs">Disponible para reutilizar en otros días y programas</p>
                </div>
              </label>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-tn-border flex-shrink-0">
          <button type="button" className="btn-secondary flex-1" onClick={onCancelar}>Cancelar</button>
          <button
            type="submit"
            form="bloque-form"
            className="btn-primary flex-1"
            onClick={handleSubmit as any}
          >
            {bloque ? 'Guardar cambios' : modoPlantilla ? 'Crear plantilla' : 'Añadir bloque'}
          </button>
        </div>
      </div>
    </div>
  )
}
