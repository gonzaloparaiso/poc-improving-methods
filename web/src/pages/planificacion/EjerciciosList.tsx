import { useState, useEffect, type FormEvent } from 'react'
import { useEjercicios, buscarUsos } from '../../context/EjerciciosContext'
import { type Ejercicio } from '../../types'
import { usePermisos } from '../../hooks/usePermisos'
import ConfirmDialog from '../../components/ConfirmDialog'
import PromptDialog from '../../components/PromptDialog'
import VideoPlayer from '../../components/VideoPlayer'

// ── Modal crear/editar ────────────────────────────────────────────────────────
function EjercicioModal({ ejercicio, onClose }: { ejercicio?: Ejercicio | null; onClose: () => void }) {
  const { crear, editar } = useEjercicios()
  const isEdit = Boolean(ejercicio)

  const [nombre, setNombre]           = useState('')
  const [explicacion, setExplicacion] = useState('')
  const [video, setVideo]             = useState('')
  const [error, setError]             = useState('')

  useEffect(() => {
    setNombre(ejercicio?.nombre ?? '')
    setExplicacion(ejercicio?.explicacion ?? '')
    setVideo(ejercicio?.video ?? '')
    setError('')
  }, [ejercicio])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return setError('El nombre es obligatorio')
    const data = { nombre: nombre.trim(), explicacion: explicacion.trim(), video: video.trim() }
    if (isEdit && ejercicio) editar(ejercicio.id, data)
    else crear(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-tn-border">
          <h3 className="text-white font-bold text-lg">{isEdit ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h3>
          <button onClick={onClose} className="text-tn-muted hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input type="text" className="input-field" placeholder="Ej: Back Squat"
              value={nombre} onChange={e => setNombre(e.target.value)} autoFocus required />
          </div>
          <div>
            <label className="label">Explicación</label>
            <textarea className="input-field resize-none h-32"
              placeholder="Cómo se ejecuta el ejercicio, técnica, errores comunes..."
              value={explicacion} onChange={e => setExplicacion(e.target.value)} />
          </div>
          <div>
            <label className="label">URL del vídeo</label>
            <input type="url" className="input-field" placeholder="https://youtube.com/watch?v=..."
              value={video} onChange={e => setVideo(e.target.value)} />
            <p className="text-tn-muted text-xs mt-1">YouTube o Vimeo. Se embeberá automáticamente.</p>
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary flex-1">
              {isEdit ? 'Guardar cambios' : 'Crear ejercicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function EjerciciosList() {
  const { ejercicios, borrar, clonar } = useEjercicios()
  const { puede } = usePermisos()

  const [busqueda, setBusqueda]   = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando]   = useState<Ejercicio | null>(null)
  const [borrando, setBorrando]   = useState<Ejercicio | null>(null)
  const [clonando, setClonando]   = useState<Ejercicio | null>(null)
  const [bloqueado, setBloqueado] = useState<{ ej: Ejercicio; usos: ReturnType<typeof buscarUsos> } | null>(null)

  const puedeCrear  = puede('planificaciones', 'crear')
  const puedeEditar = puede('planificaciones', 'editar')
  const puedeBorrar = puede('planificaciones', 'borrar')

  const filtrados = ejercicios.filter(e =>
    !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  )

  const intentarBorrar = (ej: Ejercicio) => {
    const usos = buscarUsos(ej.id)
    if (usos.programas.length > 0 || usos.plantillas.length > 0) {
      setBloqueado({ ej, usos })
    } else {
      setBorrando(ej)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Ejercicios</h2>
          <p className="text-tn-muted text-sm mt-1">
            {ejercicios.length} ejercicio{ejercicios.length !== 1 ? 's' : ''} en el catálogo
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1 sm:w-72">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" className="input-field pl-9"
              placeholder="Buscar ejercicio..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          {puedeCrear && (
            <button onClick={() => { setEditando(null); setModalOpen(true) }}
              className="btn-primary flex items-center gap-2 whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo
            </button>
          )}
        </div>
      </div>

      <div className="card divide-y divide-tn-border overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="py-12 text-center text-tn-muted text-sm">
            {busqueda ? `Sin resultados para «${busqueda}»` : 'Aún no hay ejercicios en el catálogo'}
          </div>
        ) : filtrados.map(ej => {
          const isOpen = expandido === ej.id
          return (
            <div key={ej.id}>
              <div className="w-full flex items-center justify-between px-5 py-4 hover:bg-tn-dark/40 transition-colors">
                <button
                  type="button"
                  onClick={() => setExpandido(isOpen ? null : ej.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-tn-yellow/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-white font-semibold text-sm truncate">{ej.nombre}</span>
                  {ej.video && (
                    <span className="text-tn-muted/60 text-xs hidden sm:inline">vídeo</span>
                  )}
                </button>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {puedeEditar && (
                    <button onClick={() => { setEditando(ej); setModalOpen(true) }}
                      title="Editar"
                      className="p-2 text-tn-muted hover:text-white hover:bg-tn-border rounded-lg transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                  {puedeCrear && (
                    <button onClick={() => setClonando(ej)}
                      title="Clonar"
                      className="p-2 text-tn-muted hover:text-tn-yellow hover:bg-tn-yellow/5 rounded-lg transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  )}
                  {puedeBorrar && (
                    <button onClick={() => intentarBorrar(ej)}
                      title="Eliminar"
                      className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  <button onClick={() => setExpandido(isOpen ? null : ej.id)}
                    className="p-2 text-tn-muted hover:text-white transition-colors">
                    <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-5 pb-4 bg-tn-dark/30">
                  <div className="pl-11 space-y-3">
                    {ej.explicacion ? (
                      <p className="text-tn-muted text-sm leading-relaxed whitespace-pre-line">{ej.explicacion}</p>
                    ) : (
                      <p className="text-tn-muted/50 text-sm italic">Sin explicación</p>
                    )}
                    {ej.video ? (
                      <div className="max-w-md">
                        <VideoPlayer url={ej.video} poster={ej.thumbnail} title={ej.nombre} />
                      </div>
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
          )
        })}
      </div>

      {/* Modales */}
      {modalOpen && (
        <EjercicioModal ejercicio={editando} onClose={() => { setModalOpen(false); setEditando(null) }} />
      )}

      {clonando && (
        <PromptDialog
          title="Clonar ejercicio"
          description="Se copia el ejercicio con un nuevo nombre."
          label="Nombre del nuevo ejercicio"
          defaultValue={`${clonando.nombre} (copia)`}
          confirmLabel="Clonar"
          onConfirm={nombre => { clonar(clonando.id, nombre); setClonando(null) }}
          onCancel={() => setClonando(null)}
        />
      )}

      {borrando && (
        <ConfirmDialog
          title="Eliminar ejercicio"
          description={`¿Eliminar "${borrando.nombre}" del catálogo? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={() => { borrar(borrando.id); setBorrando(null) }}
          onCancel={() => setBorrando(null)}
        />
      )}

      {/* Bloqueado por uso */}
      {bloqueado && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
                </svg>
              </div>
              <div>
                <h4 className="text-white font-bold">No se puede eliminar</h4>
                <p className="text-tn-muted text-sm mt-1">
                  «{bloqueado.ej.nombre}» se está usando en:
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {bloqueado.usos.programas.length > 0 && (
                <div>
                  <p className="text-white font-semibold mb-1">Programas ({bloqueado.usos.programas.length}):</p>
                  <ul className="space-y-0.5 pl-4">
                    {bloqueado.usos.programas.map((n, i) =>
                      <li key={i} className="text-tn-muted text-xs list-disc">{n}</li>
                    )}
                  </ul>
                </div>
              )}
              {bloqueado.usos.plantillas.length > 0 && (
                <div>
                  <p className="text-white font-semibold mb-1">Plantillas de bloque ({bloqueado.usos.plantillas.length}):</p>
                  <ul className="space-y-0.5 pl-4">
                    {bloqueado.usos.plantillas.map((n, i) =>
                      <li key={i} className="text-tn-muted text-xs list-disc">{n}</li>
                    )}
                  </ul>
                </div>
              )}
              {bloqueado.usos.calendarios > 0 && (
                <p className="text-tn-muted text-xs italic">
                  · Además, {bloqueado.usos.calendarios} calendario(s) de cliente ya lo tienen entregado.
                </p>
              )}
            </div>
            <p className="text-tn-muted text-xs">
              Quita el ejercicio de los programas y plantillas anteriores para poder eliminarlo.
            </p>
            <button onClick={() => setBloqueado(null)} className="btn-primary w-full">Entendido</button>
          </div>
        </div>
      )}
    </div>
  )
}
