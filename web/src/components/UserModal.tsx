import { useState, type FormEvent, useEffect } from 'react'
import { ROLES, type Usuario, type Rol } from '../types'
import { useUsers } from '../context/UsersContext'

interface Props {
  user?: Usuario | null
  onClose: () => void
}

const emptyForm = {
  nombre: '',
  apellido: '',
  email: '',
  rol: 'cliente' as Rol,
  activo: true,
}

export default function UserModal({ user, onClose }: Props) {
  const { crear, editar } = useUsers()
  const isEdit = Boolean(user)

  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setForm({
        nombre:   user.nombre,
        apellido: user.apellido,
        email:    user.email,
        rol:      user.rol,
        activo:   user.activo,
      })
    } else {
      setForm(emptyForm)
    }
  }, [user])

  const set = (key: keyof typeof emptyForm, value: unknown) =>
    setForm(p => ({ ...p, [key]: value }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.nombre.trim()) return setError('El nombre es obligatorio')
    if (!form.email.trim()) return setError('El email es obligatorio')

    setSaving(true)
    setTimeout(() => {
      if (isEdit && user) {
        editar(user.id, form)
      } else {
        crear(form)
      }
      setSaving(false)
      onClose()
    }, 500)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-tn-border">
          <div>
            <h3 className="text-white font-bold text-lg">
              {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
            </h3>
            <p className="text-tn-muted text-xs mt-0.5">
              {isEdit ? `Modificando: ${user?.nombre} ${user?.apellido}` : 'Completa los datos del nuevo usuario'}
            </p>
          </div>
          <button onClick={onClose} className="text-tn-muted hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input
                type="text"
                className="input-field"
                placeholder="Nombre"
                value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="label">Apellido</label>
              <input
                type="text"
                className="input-field"
                placeholder="Apellido"
                value={form.apellido}
                onChange={e => set('apellido', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              className="input-field"
              placeholder="correo@ejemplo.com"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Rol *</label>
            <select
              className="input-field"
              value={form.rol}
              onChange={e => set('rol', e.target.value as Rol)}
              required
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Estado</label>
            <div className="flex gap-3">
              {[true, false].map(val => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => set('activo', val)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                    form.activo === val
                      ? val
                        ? 'bg-green-500/10 border-green-500/50 text-green-400'
                        : 'bg-red-500/10 border-red-500/50 text-red-400'
                      : 'bg-transparent border-tn-border text-tn-muted hover:border-tn-yellow/30'
                  }`}
                >
                  {val ? '✓ Activo' : '✗ Inactivo'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
