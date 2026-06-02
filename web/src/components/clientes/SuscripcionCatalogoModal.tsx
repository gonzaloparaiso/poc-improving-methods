import { useState, useEffect, type FormEvent } from 'react'
import { type CatalogoSuscripcion, type TipoSuscripcion } from '../../types'
import { useClientes } from '../../context/ClientesContext'
import { usePlanificacion } from '../../context/PlanificacionContext'

interface Props {
  item?: CatalogoSuscripcion | null
  onClose: () => void
}

export default function SuscripcionCatalogoModal({ item, onClose }: Props) {
  const { crearCatalogo, editarCatalogo } = useClientes()
  const { programas } = usePlanificacion()
  const isEdit = Boolean(item)

  const [nombre, setNombre]       = useState('')
  const [programaId, setProgramaId] = useState<string>('')
  const [tipo, setTipo]           = useState<TipoSuscripcion>('recurrente')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    if (item) {
      setNombre(item.nombre)
      setProgramaId(item.programaId ?? '')
      setTipo(item.tipo)
    } else {
      setNombre(''); setProgramaId(''); setTipo('recurrente')
    }
    setError('')
  }, [item])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return setError('El nombre es obligatorio')
    setSaving(true)
    setTimeout(() => {
      const data = { nombre: nombre.trim(), programaId: programaId || null, tipo }
      if (isEdit && item) editarCatalogo(item.id, data)
      else crearCatalogo(data)
      setSaving(false)
      onClose()
    }, 400)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-md sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl">
        <div className="flex items-center justify-between p-6 border-b border-tn-border">
          <h3 className="text-white font-bold text-lg">
            {isEdit ? 'Editar suscripción' : 'Nueva suscripción'}
          </h3>
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

          {/* Programa asociado */}
          <div>
            <label className="label">Programa asociado</label>
            <select className="input-field" value={programaId} onChange={e => setProgramaId(e.target.value)}>
              <option value="">Sin programa asociado</option>
              {programas.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            {programas.length === 0 && (
              <p className="text-tn-muted text-xs mt-1">Crea programas en la sección de Planificación para asociarlos</p>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="label">Tipo de pago</label>
            <div className="flex gap-3">
              {([
                { value: 'recurrente' as TipoSuscripcion, label: '↻ Recurrente', desc: 'Renovación periódica' },
                { value: 'unico' as TipoSuscripcion,      label: '✓ Pago único',  desc: 'Acceso permanente'  },
              ]).map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setTipo(opt.value)}
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
