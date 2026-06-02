import { useState, type FormEvent } from 'react'

interface Cliente {
  id: number
  nombre: string
  email: string
  telefono: string
  plan: string
  creado: string
}

const PLANES = [
  { value: 'crossfit', label: 'CrossFit' },
  { value: 'hyrox', label: 'Hyrox' },
  { value: 'crossfit-hyrox', label: 'CrossFit + Hyrox' },
  { value: 'entrenamiento-personal', label: 'Entrenamiento Personal' },
]

const emptyForm = {
  nombre: '',
  email: '',
  telefono: '',
  plan: '',
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)

    setTimeout(() => {
      const nuevo: Cliente = {
        id: Date.now(),
        ...form,
        creado: new Date().toISOString(),
      }
      setClientes(prev => [nuevo, ...prev])
      setForm(emptyForm)
      setSaving(false)
      setSuccess(true)
      setShowForm(false)
      setTimeout(() => setSuccess(false), 3000)
    }, 700)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Clientes</h2>
          <p className="text-tn-muted text-sm mt-1">
            {clientes.length === 0
              ? 'Aún no hay clientes registrados'
              : `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} registrado${clientes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
          onClick={() => setShowForm(true)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo cliente
        </button>
      </div>

      {/* Success toast */}
      {success && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm font-medium">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Cliente creado correctamente
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="card w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-tn-border">
              <h3 className="text-white font-bold text-lg">Nuevo cliente</h3>
              <button
                onClick={() => { setShowForm(false); setForm(emptyForm) }}
                className="text-tn-muted hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="label">Nombre completo *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: María García López"
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="maria@email.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label">Teléfono</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="+34 600 000 000"
                  value={form.telefono}
                  onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Plan *</label>
                <select
                  className="input-field"
                  value={form.plan}
                  onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                  required
                >
                  <option value="">Selecciona un plan</option>
                  {PLANES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => { setShowForm(false); setForm(emptyForm) }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clients list */}
      {clientes.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-tn-border">
                  <th className="text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-6 py-4">Cliente</th>
                  <th className="text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-6 py-4 hidden sm:table-cell">Email</th>
                  <th className="text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-6 py-4 hidden md:table-cell">Plan</th>
                  <th className="text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-6 py-4 hidden lg:table-cell">Alta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tn-border">
                {clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-tn-dark/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-tn-border flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-bold">
                            {c.nombre.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">{c.nombre}</p>
                          {c.telefono && (
                            <p className="text-tn-muted text-xs">{c.telefono}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="text-tn-muted text-sm">{c.email}</span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="bg-tn-yellow/10 text-tn-yellow text-xs font-semibold px-2.5 py-1 rounded-full">
                        {PLANES.find(p => p.value === c.plan)?.label || c.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="text-tn-muted text-sm">
                        {new Date(c.creado).toLocaleDateString('es-ES', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-16 h-16 bg-tn-border rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Sin clientes todavía</h3>
          <p className="text-tn-muted text-sm mb-6 max-w-sm">
            Empieza añadiendo tu primer cliente para gestionar sus planificaciones y accesos.
          </p>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowForm(true)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Añadir primer cliente
          </button>
        </div>
      )}
    </div>
  )
}
