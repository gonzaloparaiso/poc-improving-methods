import { useState, useEffect, type FormEvent } from 'react'
import { type CatalogoSuscripcion, type TipoSuscripcion, type ProgramaAsociado } from '../../types'
import { useClientes } from '../../context/ClientesContext'
import { usePlanificacion } from '../../context/PlanificacionContext'
import LunesPicker, { getLunes } from '../LunesPicker'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

function nextLunes(): string {
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const dow = hoy.getDay()
  const diff = dow === 1 ? 7 : (1 - dow + 7) % 7
  const d = new Date(hoy); d.setDate(hoy.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

interface ProgLocal extends ProgramaAsociado { _key: string }

interface Props {
  item?: CatalogoSuscripcion | null
  onSaved: (catalogoId: string, programas: ProgramaAsociado[]) => void
  onClose: () => void
}

export default function SuscripcionCatalogoModal({ item, onSaved, onClose }: Props) {
  const { crearCatalogo, editarCatalogo } = useClientes()
  const { programas } = usePlanificacion()
  const isEdit = Boolean(item)

  const [nombre, setNombre]   = useState('')
  const [tipo, setTipo]       = useState<TipoSuscripcion>('recurrente')
  const [progs, setProgs]     = useState<ProgLocal[]>([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (item) {
      setNombre(item.nombre)
      setTipo(item.tipo)
      setProgs(item.programas.map(p => ({ ...p, _key: genId() })))
    } else {
      setNombre(''); setTipo('recurrente'); setProgs([])
    }
    setError('')
  }, [item])

  const addProg = () =>
    setProgs(p => [...p, { _key: genId(), programaId: '', fechaInicio: tipo === 'recurrente' ? nextLunes() : null }])

  const removeProg = (key: string) => setProgs(p => p.filter(x => x._key !== key))

  const updateProg = (key: string, field: 'programaId' | 'fechaInicio', val: string | null) =>
    setProgs(p => p.map(x => x._key === key ? { ...x, [field]: val } : x))

  // Al cambiar tipo a recurrente, inicializar fechas vacías; a único, borrarlas
  useEffect(() => {
    setProgs(p => p.map(x => ({
      ...x,
      fechaInicio: tipo === 'recurrente' ? (x.fechaInicio ?? nextLunes()) : null,
    })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

  // Programas ya seleccionados (para no repetir en el dropdown)
  const progIdsUsados = progs.map(p => p.programaId).filter(Boolean)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return setError('El nombre es obligatorio')
    const programasValidos = progs.filter(p => p.programaId)
    if (programasValidos.length > 0 && tipo === 'recurrente') {
      const sinFecha = programasValidos.find(p => !p.fechaInicio)
      if (sinFecha) return setError('Todos los programas recurrentes necesitan una fecha de inicio')
    }

    const progFinal: ProgramaAsociado[] = programasValidos.map(p => ({
      programaId: p.programaId,
      fechaInicio: tipo === 'recurrente' && p.fechaInicio ? getLunes(p.fechaInicio) : null,
    }))

    setSaving(true)
    setTimeout(() => {
      const data = { nombre: nombre.trim(), programas: progFinal, tipo }
      if (isEdit && item) {
        editarCatalogo(item.id, data)
        onSaved(item.id, progFinal)
      } else {
        const nuevo = crearCatalogo(data)
        onSaved(nuevo.id, progFinal)
      }
      setSaving(false)
      onClose()
    }, 400)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl overflow-y-auto max-h-[92vh]">
        <div className="flex items-center justify-between p-6 border-b border-tn-border">
          <h3 className="text-white font-bold text-lg">{isEdit ? 'Editar suscripción' : 'Nueva suscripción'}</h3>
          <button onClick={onClose} className="text-tn-muted hover:text-white p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="label">Nombre *</label>
            <input type="text" className="input-field" placeholder="Ej: CrossFit Mensual"
              value={nombre} onChange={e => setNombre(e.target.value)} autoFocus required />
          </div>

          {/* Tipo */}
          <div>
            <label className="label">Tipo de pago</label>
            <div className="flex gap-3">
              {([
                { value: 'recurrente' as TipoSuscripcion, label: '↻ Recurrente', desc: 'Renovación periódica' },
                { value: 'unico' as TipoSuscripcion,      label: '✓ Pago único',  desc: 'Acceso permanente'  },
              ]).map(opt => (
                <button key={opt.value} type="button" onClick={() => setTipo(opt.value)}
                  className={`flex-1 py-3 px-4 rounded-xl text-left border transition-all ${
                    tipo === opt.value
                      ? 'bg-tn-yellow/10 border-tn-yellow text-tn-yellow'
                      : 'border-tn-border text-tn-muted hover:border-tn-yellow/30'
                  }`}>
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Programas */}
          <div className="border-t border-tn-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">
                Programas asociados
                {progs.filter(p => p.programaId).length > 0 && (
                  <span className="text-tn-muted font-normal ml-2">({progs.filter(p => p.programaId).length})</span>
                )}
              </p>
              {programas.length > 0 && progIdsUsados.length < programas.length && (
                <button type="button" onClick={addProg}
                  className="flex items-center gap-1 text-tn-yellow text-sm font-semibold hover:text-tn-yellow-dark transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Añadir
                </button>
              )}
            </div>

            {programas.length === 0 && (
              <p className="text-tn-muted text-xs">
                Crea programas en la sección Planificación para poder asociarlos.
              </p>
            )}

            {progs.length === 0 && programas.length > 0 && (
              <button type="button" onClick={addProg}
                className="w-full border border-dashed border-tn-border rounded-xl py-4 text-tn-muted/60 hover:text-tn-yellow hover:border-tn-yellow/40 text-sm transition-all">
                + Añadir programa
              </button>
            )}

            <div className="space-y-3">
              {progs.map((prog, idx) => (
                <div key={prog._key} className="bg-tn-dark border border-tn-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-tn-yellow/10 text-tn-yellow text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <select
                      className="input-field flex-1"
                      value={prog.programaId}
                      onChange={e => updateProg(prog._key, 'programaId', e.target.value)}
                      required
                    >
                      <option value="">Selecciona un programa</option>
                      {programas
                        .filter(p => p.id === prog.programaId || !progIdsUsados.includes(p.id))
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                    </select>
                    <button type="button" onClick={() => removeProg(prog._key)}
                      className="p-1.5 text-tn-muted hover:text-red-400 rounded-lg hover:bg-red-400/5 transition-all flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {tipo === 'recurrente' && prog.programaId && (
                    <LunesPicker
                      value={prog.fechaInicio ?? ''}
                      onChange={v => updateProg(prog._key, 'fechaInicio', v)}
                      label="Lunes de inicio *"
                    />
                  )}
                </div>
              ))}
            </div>

            {tipo === 'unico' && progs.filter(p => p.programaId).length > 0 && (
              <div className="mt-3 bg-tn-yellow/5 border border-tn-yellow/20 rounded-xl p-3">
                <p className="text-tn-yellow/80 text-xs">
                  Los {progs.filter(p => p.programaId).length} programas se asignarán desde el siguiente lunes al realizar la asignación.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear suscripción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
