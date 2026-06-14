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
  username: '',
  password: '',
  passwordConfirm: '',
  rol: 'coach' as Rol,
  activo: true,
}

export default function UserModal({ user, onClose }: Props) {
  const { crear, editar, users } = useUsers()
  const isEdit = Boolean(user)

  const [form, setForm] = useState(emptyForm)
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setForm({
        nombre:          user.nombre,
        apellido:        user.apellido,
        email:           user.email,
        username:        user.username,
        password:        '',           // nunca mostramos la contraseña real
        passwordConfirm: '',
        rol:             user.rol,
        activo:          user.activo,
      })
    } else {
      setForm(emptyForm)
    }
    setError('')
  }, [user])

  const set = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) =>
    setForm(p => ({ ...p, [key]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.nombre.trim())    return setError('El nombre es obligatorio')
    if (!form.email.trim())     return setError('El email es obligatorio')
    if (!form.username.trim())  return setError('El usuario es obligatorio')

    // Validar usuario único (salvo el propio en edición)
    const usernameTaken = users.some(
      u => u.username === form.username.trim() && u.id !== user?.id,
    )
    if (usernameTaken) return setError('Ese nombre de usuario ya existe')

    if (!isEdit && !form.password) return setError('La contraseña es obligatoria')
    if (form.password && form.password !== form.passwordConfirm)
      return setError('Las contraseñas no coinciden')
    if (form.password && form.password.length < 4)
      return setError('La contraseña debe tener al menos 4 caracteres')

    const datos = {
      nombre:   form.nombre.trim(),
      apellido: form.apellido.trim(),
      email:    form.email.trim(),
      username: form.username.trim(),
      rol:      form.rol,
      activo:   form.activo,
      // En edición: solo cambiamos password si el campo no está vacío
      ...(form.password ? { password: form.password } : {}),
    }

    setSaving(true)
    try {
      if (isEdit && user) {
        editar(user.id, datos)
      } else {
        await crear({ ...datos, password: form.password })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
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
              {isEdit
                ? `Modificando: ${user?.nombre} ${user?.apellido}`
                : 'Completa los datos del nuevo usuario'}
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

          {/* Nombre + Apellido */}
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

          {/* Email */}
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

          {/* Separador credenciales */}
          <div className="border-t border-tn-border pt-4">
            <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider mb-3">
              Credenciales de acceso
            </p>

            {/* Username */}
            <div className="mb-4">
              <label className="label">Usuario *</label>
              <input
                type="text"
                className="input-field"
                placeholder="nombre_usuario"
                value={form.username}
                onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, '_'))}
                autoComplete="off"
                required
              />
              <p className="text-tn-muted text-xs mt-1">Solo letras, números y guiones bajos</p>
            </div>

            {/* Password */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">
                  {isEdit ? 'Nueva contraseña' : 'Contraseña *'}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder={isEdit ? 'Dejar vacío para no cambiar' : '••••••••'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-tn-muted hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Confirmar *</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field"
                  placeholder="••••••••"
                  value={form.passwordConfirm}
                  onChange={e => set('passwordConfirm', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {isEdit && (
              <p className="text-tn-muted text-xs mt-2">
                Deja la contraseña en blanco si no quieres modificarla
              </p>
            )}
          </div>

          {/* Rol */}
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

          {/* Estado */}
          <div>
            <label className="label">Estado</label>
            <div className="flex gap-3">
              {([true, false] as const).map(val => (
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

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Acciones */}
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
