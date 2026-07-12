import { useState, useEffect, useRef, type FormEvent, type ChangeEvent, type KeyboardEvent } from 'react'
import { type ContenidoItem, type TipoMedia } from '../../types'
import VideoPlayer from '../VideoPlayer'

const MAX_THUMB = 3 * 1024 * 1024   // 3MB
const MAX_MEDIA = 15 * 1024 * 1024  // 15MB

type Datos = Omit<ContenidoItem, 'id' | 'creadoEn'>

interface Props {
  item?: ContenidoItem | null
  tituloModal: string          // "Nueva respiración" / "Editar respiración"...
  etiquetaCampo: string        // "título" del elemento, para los placeholders
  onGuardar: (data: Datos) => void
  onCancelar: () => void
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(f)
  })
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export default function ContenidoModal({ item, tituloModal, etiquetaCampo, onGuardar, onCancelar }: Props) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [etiquetaEnCurso, setEtiquetaEnCurso] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [mediaTipo, setMediaTipo] = useState<TipoMedia | null>(null)
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaNombre, setMediaNombre] = useState('')
  const [mediaSize, setMediaSize] = useState(0)
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState<'thumbnail' | 'media' | null>(null)

  const thumbInputRef = useRef<HTMLInputElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (item) {
      setTitulo(item.titulo)
      setDescripcion(item.descripcion)
      setEtiquetas(item.etiquetas)
      setThumbnail(item.thumbnail)
      setMediaTipo(item.mediaTipo)
      setMediaUrl(item.mediaUrl)
      setMediaNombre(item.mediaNombre)
      setMediaSize(item.mediaSize)
    } else {
      setTitulo(''); setDescripcion(''); setEtiquetas([])
      setThumbnail(''); setMediaTipo(null); setMediaUrl(''); setMediaNombre(''); setMediaSize(0)
    }
    setEtiquetaEnCurso('')
    setError('')
  }, [item])

  const añadirEtiqueta = () => {
    const v = etiquetaEnCurso.trim().toLowerCase()
    if (v && !etiquetas.includes(v)) setEtiquetas(e => [...e, v])
    setEtiquetaEnCurso('')
  }
  const quitarEtiqueta = (tag: string) => setEtiquetas(e => e.filter(t => t !== tag))
  const onEtiquetaKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); añadirEtiqueta() }
    else if (e.key === 'Backspace' && !etiquetaEnCurso && etiquetas.length > 0) {
      quitarEtiqueta(etiquetas[etiquetas.length - 1])
    }
  }

  const handleThumbnail = async (e: ChangeEvent<HTMLInputElement>) => {
    setError('')
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('La miniatura debe ser una imagen')
    if (f.size > MAX_THUMB) return setError(`La imagen supera ${formatBytes(MAX_THUMB)}`)
    setSubiendo('thumbnail')
    try { setThumbnail(await fileToDataUrl(f)) }
    catch { setError('No se pudo leer la imagen') }
    finally { setSubiendo(null); if (thumbInputRef.current) thumbInputRef.current.value = '' }
  }

  const handleMedia = async (e: ChangeEvent<HTMLInputElement>) => {
    setError('')
    const f = e.target.files?.[0]
    if (!f) return
    const tipo: TipoMedia | null = f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('video/') ? 'video' : null
    if (!tipo) return setError('El archivo debe ser un audio o un vídeo')
    if (f.size > MAX_MEDIA) return setError(`El archivo supera ${formatBytes(MAX_MEDIA)}`)
    setSubiendo('media')
    try {
      const dataUrl = await fileToDataUrl(f)
      setMediaTipo(tipo); setMediaUrl(dataUrl); setMediaNombre(f.name); setMediaSize(f.size)
    } catch { setError('No se pudo leer el archivo') }
    finally { setSubiendo(null); if (mediaInputRef.current) mediaInputRef.current.value = '' }
  }

  const quitarMedia = () => { setMediaTipo(null); setMediaUrl(''); setMediaNombre(''); setMediaSize(0) }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return setError('El título es obligatorio')
    onGuardar({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      etiquetas,
      mediaTipo, mediaUrl, mediaNombre, mediaSize,
      thumbnail,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="card w-full sm:max-w-xl sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-tn-border flex-shrink-0">
          <h3 className="text-white font-bold text-lg">{tituloModal}</h3>
          <button onClick={onCancelar} className="text-tn-muted hover:text-white p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="label">Título *</label>
            <input type="text" className="input-field" placeholder={`Ej: ${etiquetaCampo}`}
              value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus required />
          </div>

          <div>
            <label className="label">Descripción</label>
            <textarea className="input-field resize-none h-28"
              placeholder="Cómo se hace, para qué sirve, cuándo usarla..."
              value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>

          <div>
            <label className="label">Etiquetas</label>
            <div className="input-field flex flex-wrap gap-2 items-center min-h-[46px]">
              {etiquetas.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 bg-tn-yellow/10 text-tn-yellow text-xs font-semibold px-2 py-1 rounded-full">
                  {tag}
                  <button type="button" onClick={() => quitarEtiqueta(tag)} className="hover:text-white">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="flex-1 min-w-[100px] bg-transparent outline-none text-white text-sm placeholder-tn-muted"
                placeholder={etiquetas.length === 0 ? 'Escribe y pulsa Enter…' : ''}
                value={etiquetaEnCurso}
                onChange={e => setEtiquetaEnCurso(e.target.value)}
                onKeyDown={onEtiquetaKeyDown}
                onBlur={añadirEtiqueta}
              />
            </div>
          </div>

          {/* Miniatura */}
          <div>
            <label className="label">Miniatura</label>
            {thumbnail ? (
              <div className="flex items-center gap-3">
                <img src={thumbnail} alt="" className="w-20 h-20 rounded-lg object-cover bg-tn-dark border border-tn-border" />
                <button type="button" onClick={() => setThumbnail('')} className="btn-secondary text-sm py-2 px-3">
                  Quitar
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => thumbInputRef.current?.click()}
                disabled={subiendo === 'thumbnail'}
                className="w-full border border-dashed border-tn-border rounded-xl py-4 text-tn-muted/70 hover:text-tn-yellow hover:border-tn-yellow/40 text-sm transition-all">
                {subiendo === 'thumbnail' ? 'Subiendo…' : '+ Subir imagen (máx. 3MB)'}
              </button>
            )}
            <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnail} />
          </div>

          {/* Audio / Vídeo */}
          <div>
            <label className="label">Archivo de audio o vídeo</label>
            {mediaUrl ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 bg-tn-dark border border-tn-border rounded-xl px-3 py-2">
                  <p className="text-white text-sm truncate">{mediaNombre || 'Archivo'} <span className="text-tn-muted">({formatBytes(mediaSize)})</span></p>
                  <button type="button" onClick={quitarMedia} className="text-tn-muted hover:text-red-400 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                {mediaTipo === 'audio' ? (
                  <audio src={mediaUrl} controls className="w-full" />
                ) : (
                  <VideoPlayer url={mediaUrl} poster={thumbnail} title={titulo} />
                )}
              </div>
            ) : (
              <button type="button" onClick={() => mediaInputRef.current?.click()}
                disabled={subiendo === 'media'}
                className="w-full border border-dashed border-tn-border rounded-xl py-4 text-tn-muted/70 hover:text-tn-yellow hover:border-tn-yellow/40 text-sm transition-all">
                {subiendo === 'media' ? 'Subiendo…' : '+ Subir audio o vídeo (máx. 15MB)'}
              </button>
            )}
            <input ref={mediaInputRef} type="file" accept="audio/*,video/*" className="hidden" onChange={handleMedia} />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
          )}
        </form>

        <div className="flex gap-3 p-6 border-t border-tn-border flex-shrink-0">
          <button type="button" className="btn-secondary flex-1" onClick={onCancelar}>Cancelar</button>
          <button type="submit" className="btn-primary flex-1" onClick={handleSubmit as any}>
            {item ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}
