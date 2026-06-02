import { useState } from 'react'
import { EJERCICIOS } from '../../data/ejercicios'

export default function EjerciciosList() {
  const [busqueda, setBusqueda] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)

  const filtrados = EJERCICIOS.filter(e =>
    !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Ejercicios</h2>
          <p className="text-tn-muted text-sm mt-1">{EJERCICIOS.length} ejercicios disponibles</p>
        </div>
        <div className="relative sm:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" className="input-field pl-9"
            placeholder="Buscar ejercicio..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="card divide-y divide-tn-border overflow-hidden">
        {filtrados.map(ej => (
          <div key={ej.id}>
            <button
              type="button"
              onClick={() => setExpandido(expandido === ej.id ? null : ej.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-tn-dark/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-tn-yellow/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-white font-semibold text-sm">{ej.nombre}</span>
              </div>
              <svg
                className={`w-4 h-4 text-tn-muted transition-transform flex-shrink-0 ${expandido === ej.id ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandido === ej.id && (
              <div className="px-5 pb-4 bg-tn-dark/30">
                <div className="pl-11 space-y-3">
                  <p className="text-tn-muted text-sm leading-relaxed">{ej.explicacion}</p>
                  {ej.video ? (
                    <a href={ej.video} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-tn-yellow text-sm font-medium hover:underline">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Ver vídeo
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-tn-muted text-xs">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Vídeo pendiente
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {filtrados.length === 0 && (
          <div className="py-12 text-center text-tn-muted text-sm">Sin resultados para «{busqueda}»</div>
        )}
      </div>
    </div>
  )
}
