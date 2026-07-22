import { useState, type FormEvent } from 'react'
import { type User } from '../App'
import { loginStaff, bootSync, apiStaffForgotPassword } from '../lib/storage'
import PasswordInput from '../components/PasswordInput'

interface Props {
  onLogin: (user: User) => void
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Modo "olvidé mi contraseña"
  const [modo, setModo] = useState<'login' | 'forgot'>('login')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    try { await apiStaffForgotPassword(forgotEmail.trim()) } catch { /* nunca revelamos errores aquí */ }
    setForgotSent(true)
    setForgotLoading(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const usuario = await loginStaff(username.trim(), password)
      const sesion: User = {
        username: usuario.username,
        role: usuario.rol,
        nombre: `${usuario.nombre}${usuario.apellido ? ' ' + usuario.apellido : ''}`,
      }
      sessionStorage.setItem('im_user', JSON.stringify(sesion))
      // Cargar los datos del servidor con el nuevo token y entrar al panel
      await bootSync()
      window.location.assign('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Usuario o contraseña incorrectos')
      setLoading(false)
    }
    void onLogin
  }

  return (
    <div className="min-h-screen bg-tn-black flex items-center justify-center p-4">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, #F5C300 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <img src="/tn-logo.png" alt="Training Norte" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-black text-white tracking-tight">
            Improving Methods
          </h1>
          <p className="text-tn-muted text-sm mt-1 font-medium tracking-widest uppercase">
            Training Norte
          </p>
        </div>

        {/* Card */}
        <div className="card p-8 shadow-2xl shadow-black/50">
          {modo === 'login' ? (
            <>
              <h2 className="text-lg font-bold text-white mb-6">Acceder al panel</h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="correo@ejemplo.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label className="label">Contraseña</label>
                  <PasswordInput
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary w-full text-center"
                  disabled={loading}
                >
                  {loading ? 'Accediendo...' : 'Entrar'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button type="button" onClick={() => { setModo('forgot'); setError('') }}
                  className="text-tn-muted text-sm hover:text-tn-yellow transition-colors">
                  ¿Has olvidado tu contraseña?
                </button>
              </div>
            </>
          ) : forgotSent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-tn-yellow/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <svg className="w-7 h-7 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Revisa tu correo</h2>
              <p className="text-tn-muted text-sm mb-6">
                Si <span className="text-white">{forgotEmail}</span> corresponde a una cuenta, te hemos enviado un enlace para crear una nueva contraseña. Caduca en 1 hora.
              </p>
              <button type="button" onClick={() => { setModo('login'); setForgotSent(false) }}
                className="btn-secondary w-full">Volver al inicio</button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Recuperar contraseña</h2>
              <p className="text-tn-muted text-sm mb-6">Te enviaremos un enlace a tu email para crear una nueva.</p>
              <form onSubmit={handleForgot} className="space-y-5">
                <div>
                  <label className="label">Tu email</label>
                  <input type="email" className="input-field" placeholder="correo@ejemplo.com"
                    value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    autoComplete="email" autoFocus required />
                </div>
                <button type="submit" className="btn-primary w-full text-center" disabled={forgotLoading}>
                  {forgotLoading ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>
              <div className="mt-4 text-center">
                <button type="button" onClick={() => { setModo('login'); setError('') }}
                  className="text-tn-muted text-sm hover:text-tn-yellow transition-colors">
                  Volver al inicio de sesión
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-tn-muted/50 text-xs mt-6">
          Improving Methods © {new Date().getFullYear()} Training Norte
        </p>
      </div>
    </div>
  )
}
