import { useRef, useState, type ChangeEvent } from 'react'
import { type Programa } from '../../types'
import { usePlanificacion } from '../../context/PlanificacionContext'
import { usePermisos } from '../../hooks/usePermisos'
import ConfirmDialog from '../ConfirmDialog'

const MAX_SIZE = 4 * 1024 * 1024 // 4MB por archivo

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(f)
  })
}

export default function AdjuntosPrograma({ programa }: { programa: Programa }) {
  const { añadirAdjunto, borrarAdjunto } = usePlanificacion()
  const { puede } = usePermisos()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError]     = useState('')
  const [borrando, setBorrando] = useState<{ id: string; nombre: string } | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  const adjuntos = programa.adjuntos ?? []
  const puedeEditar = puede('planificaciones', 'editar')
  const puedeBorrar = puede('planificaciones', 'borrar')

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    setError('')
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setSubiendo(true)
    for (const f of files) {
      if (f.type !== 'application/pdf') {
        setError(`"${f.name}" no es un PDF`)
        continue
      }
      if (f.size > MAX_SIZE) {
        setError(`"${f.name}" supera 4MB`)
        continue
      }
      try {
        const dataUrl = await fileToDataUrl(f)
        añadirAdjunto(programa.id, { nombre: f.name, dataUrl, size: f.size })
      } catch {
        setError(`Error al leer "${f.name}"`)
      }
    }
    setSubiendo(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const descargar = (dataUrl: string, nombre: string) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = nombre
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-white font-bold flex items-center gap-2">
          <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          Documentos adjuntos
          {adjuntos.length > 0 && <span className="text-tn-muted font-normal text-sm">({adjuntos.length})</span>}
        </h3>
        {puedeEditar && (
          <>
            <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden"
              onChange={handleFile} disabled={subiendo} />
            <button onClick={() => inputRef.current?.click()}
              disabled={subiendo}
              className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {subiendo ? 'Subiendo...' : 'Subir PDF'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
          {error}
        </div>
      )}

      {adjuntos.length === 0 ? (
        <div className="border border-dashed border-tn-border rounded-xl py-6 text-center">
          <p className="text-tn-muted text-sm">
            {puedeEditar
              ? 'Sube PDFs (guías, fotos del WOD, etc.) y tus clientes podrán descargarlos'
              : 'Aún no hay documentos'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {adjuntos.map(a => (
            <div key={a.id} className="bg-tn-dark border border-tn-border rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{a.nombre}</p>
                <p className="text-tn-muted text-xs">{formatBytes(a.size)} · {fmtFecha(a.subidoEn)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => descargar(a.dataUrl, a.nombre)}
                  className="p-2 text-tn-muted hover:text-tn-yellow hover:bg-tn-yellow/5 rounded-lg transition-all"
                  title="Descargar">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                {puedeBorrar && (
                  <button onClick={() => setBorrando({ id: a.id, nombre: a.nombre })}
                    className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all"
                    title="Eliminar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {puedeEditar && (
        <p className="text-tn-muted text-xs">
          Máx 4MB por PDF. Los adjuntos se copian al calendario del cliente al asignarle una suscripción con este programa.
        </p>
      )}

      {borrando && (
        <ConfirmDialog
          title="Eliminar adjunto"
          description={`¿Eliminar "${borrando.nombre}"? Los clientes que ya tengan el calendario seguirán teniendo su copia.`}
          confirmLabel="Eliminar"
          onConfirm={() => { borrarAdjunto(programa.id, borrando.id); setBorrando(null) }}
          onCancel={() => setBorrando(null)}
        />
      )}
    </div>
  )
}
