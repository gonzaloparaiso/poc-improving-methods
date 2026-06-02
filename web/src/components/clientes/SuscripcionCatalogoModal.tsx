import { useState, useEffect, type FormEvent } from 'react'
import { type CatalogoSuscripcion, type TipoSuscripcion } from '../../types'
import { useClientes } from '../../context/ClientesContext'
import { usePlanificacion } from '../../context/PlanificacionContext'
import LunesPicker, { getLunes } from '../LunesPicker'

interface Props {
  item?: CatalogoSuscripcion | null
  /** Llamado al guardar; si es recurrente+programa devuelve la fecha de inicio elegida */
  onSaved: (catalogoId: string, fechaInicio: string | null) => void
  onClose: () => void
}

function nextLunes(): string {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dow = hoy.getDay()
  const diff = dow === 1 ? 7 : (1 - dow + 7) % 7
  const d = new Date(hoy)
  d.setDate(hoy.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function SuscripcionCatalogoModal({ item, onSaved, onClose }: Props) {
  const { crearCatalogo, editarCatalogo } = useClientes()
  const { programas } = usePlanificacion()
  const isEdit = Boolean(item)

  const [nombre, setNombre]           = useState('')
  const [programaId, setProgramaId]   = useState('')
  const [tipo, setTipo]               = useState<TipoSuscripcion>('recurrente')
  const [fechaInicio, setFechaInicio] = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const esRecurrenteConPrograma = tipo === 'recurrente' && Boolean(programaId)

  useEffect(() => {
    if (item) {
      setNombre(item.nombre)
      setProgramaId(item.programaId ?? '')
      setTipo(item.tipo)
      setFechaInicio(item.fechaInicioPrograma ?? '')
    } else {
      setNombre(''); setProgramaId(''); setTipo('recurrente'); setFechaInicio('')
    }
    setError('')
  }, [item])

  // Al seleccionar programa en modo recurrente, pre-rellenar con el siguiente lunes
  useEffect(() => {
    if (esRecurrenteConPrograma && !fechaInicio) {
      setFechaInicio(nextLunes())
    }
    if (!esRecurrenteConPrograma) {
      setFechaInicio('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, tipo])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return setError('El nombre es obligatorio')
    if (esRecurrenteConPrograma && !fechaInicio)
      return setError('Debes elegir un lunes de inicio para el programa')

    // Aseguramos que la fecha sea siempre lunes
    const fechaFinal = fechaInicio ? getLunes(fechaInicio) : null

    setSaving(true)
    setTimeout(() => {
      const data = {
        nombre: nombre.trim(),
        programaId: programaId || null,
        tipo,
        fechaInicioPrograma: esRecurrenteConPrograma ? fechaFinal : null,
      }
      if (isEdit && item) {
        editarCatalogo(item.id, data)
        onSaved(item.id, esRecurrenteConPrograma ? fechaFinal : null)
      } else {
        crearCatalogo(data)
        // Para nuevo catálogo, onSaved se llama con '' porque el id aún no existe
        // SuscripcionesCatalogo buscará el último creado
        onSaved('__nuevo__', esRecurrenteConPrograma ? fechaFinal : null)
      }
      setSaving(false)
      onClose()
    }, 400)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-md sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl overflow-y-auto max-h-[92vh]">
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
              <p className="text-tn-muted text-xs mt-1">
                Crea programas en Planificación para asociarlos
              </p>
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

          {/* Fecha de inicio — solo recurrente con programa */}
          {esRecurrenteConPrograma && (
            <div className="border-t border-tn-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-white text-sm font-semibold">Inicio del programa</p>
              </div>
              <LunesPicker
                value={fechaInicio}
                onChange={setFechaInicio}
                label="Lunes de inicio *"
                hint="Elige el lunes desde el que arranca este programa para los clientes"
              />
              {isEdit && item?.fechaInicioPrograma && item.fechaInicioPrograma !== fechaInicio && (
                <div className="mt-3 bg-tn-yellow/5 border border-tn-yellow/20 rounded-xl p-3">
                  <p className="text-tn-yellow/80 text-xs">
                    ⚠ Al cambiar la fecha, se crearán nuevos calendarios para todos los clientes activos con esta suscripción a partir del nuevo lunes.
                  </p>
                </div>
              )}
              {!isEdit && (
                <div className="mt-3 bg-tn-yellow/5 border border-tn-yellow/20 rounded-xl p-3">
                  <p className="text-tn-yellow/80 text-xs">
                    Los clientes con esta suscripción activa recibirán automáticamente el calendario desde este lunes.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
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
