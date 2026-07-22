import { useState, type FormEvent } from 'react'
import { apiStaffResetPassword } from '../lib/storage'
import PasswordInput from '../components/PasswordInput'

export default function StaffReset() {
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (nueva.length < 4) return setError('La contraseña debe tener al menos 4 caracteres')
    if (nueva !== confirmar) return setError('Las contraseñas no coinciden')
    setLoading(true)
    try {
      await apiStaffResetPassword(token, nueva)
      setOk(true)
      setTimeout(() => window.location.assign('/admin/login'), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-tn-black flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: `radial-gradient(circle, #F5C300 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <img src="/tn-logo.png" alt="Training Norte" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-black text-white tracking-tight">Nueva contraseña</h1>
          <p className="text-tn-muted text-sm mt-1 font-medium tracking-widest uppercase">Training Norte</p>
        </div>

        <div className="card p-8 shadow-2xl shadow-black/50">
          {!token ? (
            <div className="text-center">
              <p className="text-tn-muted text-sm mb-6">Enlace no válido. Solicita uno nuevo desde el inicio de sesión.</p>
              <a href="/admin/login" className="btn-primary w-full inline-block text-center">Ir al inicio de sesión</a>
            </div>
          ) : ok ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-1">¡Contraseña actualizada!</h2>
              <p className="text-tn-muted text-sm">Te llevamos al inicio de sesión…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="label">Nueva contraseña</label>
                <PasswordInput placeholder="••••••••"
                  value={nueva} onChange={e => setNueva(e.target.value)} autoComplete="new-password" autoFocus required />
              </div>
              <div>
                <label className="label">Repetir contraseña</label>
                <PasswordInput placeholder="••••••••"
                  value={confirmar} onChange={e => setConfirmar(e.target.value)} autoComplete="new-password" required />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm font-medium">{error}</div>
              )}
              <button type="submit" className="btn-primary w-full text-center" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
