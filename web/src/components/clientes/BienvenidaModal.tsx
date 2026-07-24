import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { type CatalogoSuscripcion, MENSAJE_BIENVENIDA_EMAIL_DEFAULT, MENSAJE_BIENVENIDA_WHATSAPP_DEFAULT } from '../../types'
import { useClientes } from '../../context/ClientesContext'
import { apiTestBienvenidaEmail } from '../../lib/storage'

const MAX_IMAGEN = 3 * 1024 * 1024 // 3MB

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(f)
  })
}

/** Email de sesión del miembro del staff logueado (para prefijar "enviar prueba a"). */
function emailStaffActual(): string {
  try {
    const raw = sessionStorage.getItem('im_user')
    if (!raw) return ''
    const u = JSON.parse(raw) as { username?: string }
    return u.username || ''
  } catch { return '' }
}

/** Conversión mínima de la sintaxis de WhatsApp (*negrita*, _cursiva_, ~tachado~) a HTML, solo para la vista previa. */
function renderWhatsappPreview(texto: string): string {
  const esc = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<s>$1</s>')
    .replace(/\n/g, '<br/>')
}

interface Props {
  item: CatalogoSuscripcion
  onClose: () => void
}

export default function BienvenidaModal({ item, onClose }: Props) {
  const { editarCatalogo } = useClientes()
  const [tab, setTab] = useState<'email' | 'whatsapp'>('email')

  const [mensajeEmail, setMensajeEmail] = useState('')
  const [mensajeWhatsapp, setMensajeWhatsapp] = useState('')
  const [imagenWhatsapp, setImagenWhatsapp] = useState('')

  const [testTo, setTestTo] = useState('')
  const [testEnviando, setTestEnviando] = useState(false)
  const [testMsg, setTestMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const editableRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const whatsappTextareaRef = useRef<HTMLTextAreaElement>(null)
  const whatsappImgInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const email = item.mensajeBienvenidaEmail || MENSAJE_BIENVENIDA_EMAIL_DEFAULT
    setMensajeEmail(email)
    setMensajeWhatsapp(item.mensajeBienvenidaWhatsapp || MENSAJE_BIENVENIDA_WHATSAPP_DEFAULT)
    setImagenWhatsapp(item.imagenBienvenidaWhatsapp || '')
    setTestTo(emailStaffActual())
    setError(''); setTestMsg(null)
    // El contentEditable se rellena una vez al montar, luego vive fuera de React
    if (editableRef.current) editableRef.current.innerHTML = email
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  // ── Editor de email (contentEditable + execCommand) ──
  const guardarSeleccion = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editableRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }
  const restaurarSeleccion = () => {
    editableRef.current?.focus()
    const sel = window.getSelection()
    if (sel && savedRangeRef.current) { sel.removeAllRanges(); sel.addRange(savedRangeRef.current) }
  }
  const exec = (cmd: string, valor?: string) => {
    editableRef.current?.focus()
    document.execCommand(cmd, false, valor)
    setMensajeEmail(editableRef.current?.innerHTML || '')
  }
  const insertarEnlace = () => {
    guardarSeleccion()
    const url = window.prompt('URL del enlace (incluye https://)')
    if (!url) return
    restaurarSeleccion()
    document.execCommand('createLink', false, url)
    setMensajeEmail(editableRef.current?.innerHTML || '')
  }
  const abrirSelectorImagen = () => { guardarSeleccion(); imgInputRef.current?.click() }
  const onImagenSeleccionada = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (f.size > MAX_IMAGEN) return setError('La imagen no puede superar 3MB')
    const dataUrl = await fileToDataUrl(f)
    restaurarSeleccion()
    document.execCommand('insertImage', false, dataUrl)
    setMensajeEmail(editableRef.current?.innerHTML || '')
  }

  // ── Editor de WhatsApp (textarea + marcado manual) ──
  const envolverSeleccion = (marca: string) => {
    const ta = whatsappTextareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: en, value } = ta
    const nuevo = `${value.slice(0, s)}${marca}${value.slice(s, en)}${marca}${value.slice(en)}`
    setMensajeWhatsapp(nuevo)
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + marca.length, en + marca.length) })
  }
  const onImagenWhatsappSeleccionada = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (f.size > MAX_IMAGEN) return setError('La imagen no puede superar 3MB')
    setImagenWhatsapp(await fileToDataUrl(f))
  }

  const handleGuardar = () => {
    setSaving(true)
    editarCatalogo(item.id, {
      mensajeBienvenidaEmail: mensajeEmail,
      mensajeBienvenidaWhatsapp: mensajeWhatsapp,
      imagenBienvenidaWhatsapp: imagenWhatsapp,
    })
    setTimeout(() => { setSaving(false); onClose() }, 300)
  }

  const enviarPrueba = async () => {
    if (!testTo.trim()) return setTestMsg({ tipo: 'error', texto: 'Escribe un email de destino' })
    setTestEnviando(true); setTestMsg(null)
    try {
      await apiTestBienvenidaEmail(testTo.trim(), mensajeEmail)
      setTestMsg({ tipo: 'ok', texto: `Enviado a ${testTo.trim()}` })
    } catch (err) {
      setTestMsg({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo enviar' })
    } finally {
      setTestEnviando(false)
    }
  }

  const ToolbarBtn = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
    <button type="button" title={title} onMouseDown={e => e.preventDefault()} onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-tn-muted hover:text-white hover:bg-tn-border transition-colors font-semibold text-sm">
      {children}
    </button>
  )

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-2xl sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl overflow-y-auto max-h-[92vh]">
        <div className="flex items-center justify-between p-6 border-b border-tn-border sticky top-0 bg-tn-card z-10">
          <div>
            <h3 className="text-white font-bold text-lg">Mensaje de bienvenida</h3>
            <p className="text-tn-muted text-xs mt-0.5">{item.nombre}</p>
          </div>
          <button onClick={onClose} className="text-tn-muted hover:text-white p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {([{ id: 'email' as const, label: 'Email' }, { id: 'whatsapp' as const, label: 'WhatsApp' }]).map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
                tab === t.id ? 'bg-tn-dark text-tn-yellow' : 'text-tn-muted hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 pt-4 space-y-4">
          <p className="text-tn-muted text-xs">
            Se envía al dar de alta a un cliente con esta suscripción (o su primera compra). Usa <code className="text-tn-yellow">{'{nombre}'}</code> para incluir el nombre del cliente.
          </p>

          {tab === 'email' ? (
            <div key="email" className="space-y-4">
              <div className="bg-tn-dark border border-tn-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-1 border-b border-tn-border px-2 py-1.5">
                  <ToolbarBtn onClick={() => exec('bold')} title="Negrita"><span className="font-bold">B</span></ToolbarBtn>
                  <ToolbarBtn onClick={() => exec('italic')} title="Cursiva"><span className="italic">I</span></ToolbarBtn>
                  <ToolbarBtn onClick={() => exec('underline')} title="Subrayado"><span className="underline">U</span></ToolbarBtn>
                  <div className="w-px h-5 bg-tn-border mx-1" />
                  <ToolbarBtn onClick={insertarEnlace} title="Insertar enlace">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m5.656-5.656l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0" /></svg>
                  </ToolbarBtn>
                  <ToolbarBtn onClick={abrirSelectorImagen} title="Insertar imagen">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </ToolbarBtn>
                  <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={onImagenSeleccionada} />
                </div>
                <div
                  ref={editableRef}
                  contentEditable
                  onInput={() => setMensajeEmail(editableRef.current?.innerHTML || '')}
                  onKeyUp={guardarSeleccion}
                  onMouseUp={guardarSeleccion}
                  className="min-h-[120px] max-h-[240px] overflow-y-auto px-4 py-3 text-white text-sm leading-relaxed focus:outline-none [&_img]:max-w-full [&_img]:rounded-lg [&_a]:text-tn-yellow [&_a]:underline"
                />
              </div>

              {/* Vista previa — mismo aspecto que el email real */}
              <div>
                <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider mb-2">Vista previa</p>
                <div className="bg-[#f4f4f5] rounded-xl p-6">
                  <div className="max-w-[380px] mx-auto bg-white rounded-2xl p-7 shadow-sm">
                    <div className="text-center mb-4">
                      <img src="/tn-logo-email.png" alt="Training Norte" width={56} height={56} className="rounded-full inline-block" />
                    </div>
                    <h4 className="text-black font-bold text-base text-center mb-1">¡Bienvenido/a a Training Norte!</h4>
                    <div className="text-[#374151] text-sm leading-relaxed mt-4 [&_img]:max-w-full [&_img]:rounded-lg [&_a]:text-black [&_a]:font-semibold"
                      dangerouslySetInnerHTML={{ __html: mensajeEmail.replace(/\{nombre\}/g, ' Ana') }} />
                    <hr className="border-t border-[#e5e7eb] my-5" />
                    <p className="text-[#6b7280] text-xs">
                      ¿Tienes algún problema? Escríbenos a <span className="font-semibold text-black">soporte@academiatn.com</span> y te ayudamos encantados.
                    </p>
                  </div>
                </div>
              </div>

              {/* Enviar prueba */}
              <div className="border-t border-tn-border pt-4">
                <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider mb-2">Enviar prueba</p>
                <div className="flex gap-2">
                  <input type="email" className="input-field flex-1" placeholder="tu@email.com"
                    value={testTo} onChange={e => setTestTo(e.target.value)} />
                  <button type="button" onClick={enviarPrueba} disabled={testEnviando}
                    className="btn-secondary whitespace-nowrap">
                    {testEnviando ? 'Enviando...' : 'Enviar prueba'}
                  </button>
                </div>
                {testMsg && (
                  <p className={`text-xs mt-2 ${testMsg.tipo === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{testMsg.texto}</p>
                )}
              </div>
            </div>
          ) : (
            <div key="whatsapp" className="space-y-4">
              <div className="bg-tn-dark border border-tn-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-1 border-b border-tn-border px-2 py-1.5">
                  <ToolbarBtn onClick={() => envolverSeleccion('*')} title="Negrita"><span className="font-bold">B</span></ToolbarBtn>
                  <ToolbarBtn onClick={() => envolverSeleccion('_')} title="Cursiva"><span className="italic">I</span></ToolbarBtn>
                  <ToolbarBtn onClick={() => envolverSeleccion('~')} title="Tachado"><span className="line-through">S</span></ToolbarBtn>
                  <div className="w-px h-5 bg-tn-border mx-1" />
                  <ToolbarBtn onClick={() => whatsappImgInputRef.current?.click()} title="Adjuntar imagen">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </ToolbarBtn>
                  <input ref={whatsappImgInputRef} type="file" accept="image/*" className="hidden" onChange={onImagenWhatsappSeleccionada} />
                </div>
                <textarea
                  ref={whatsappTextareaRef}
                  value={mensajeWhatsapp}
                  onChange={e => setMensajeWhatsapp(e.target.value)}
                  rows={4}
                  className="w-full bg-transparent px-4 py-3 text-white text-sm leading-relaxed focus:outline-none resize-none"
                />
                {imagenWhatsapp && (
                  <div className="px-4 pb-3 flex items-center gap-3">
                    <img src={imagenWhatsapp} alt="" className="w-16 h-16 object-cover rounded-lg" />
                    <button type="button" onClick={() => setImagenWhatsapp('')} className="text-red-400 text-xs font-semibold hover:text-red-300">
                      Quitar imagen
                    </button>
                  </div>
                )}
              </div>

              {/* Vista previa — burbuja de chat */}
              <div>
                <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider mb-2">Vista previa</p>
                <div className="bg-[#e5ddd5] rounded-xl p-6 flex justify-start">
                  <div className="max-w-[280px] bg-white rounded-xl rounded-tl-none p-3 shadow-sm">
                    {imagenWhatsapp && <img src={imagenWhatsapp} alt="" className="w-full rounded-lg mb-2" />}
                    <p className="text-black text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderWhatsappPreview(mensajeWhatsapp.replace(/\{nombre\}/g, ' Ana')) }} />
                  </div>
                </div>
              </div>

              {/* Enviar prueba (deshabilitado hasta conectar Whapi) */}
              <div className="border-t border-tn-border pt-4">
                <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider mb-2">Enviar prueba</p>
                <div className="flex gap-2">
                  <input type="tel" className="input-field flex-1" placeholder="+34 600 000 000" disabled />
                  <button type="button" disabled title="Disponible en cuanto conectemos WhatsApp (Whapi)"
                    className="btn-secondary whitespace-nowrap opacity-40 cursor-not-allowed">
                    Enviar prueba
                  </button>
                </div>
                <p className="text-tn-muted/70 text-xs mt-2">Disponible en cuanto conectemos WhatsApp (Whapi).</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn-primary flex-1" disabled={saving} onClick={handleGuardar}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
