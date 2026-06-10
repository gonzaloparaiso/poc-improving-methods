import { useState, type FormEvent } from 'react'
import { type User } from '../App'
import { loginConCredenciales } from '../context/UsersContext'

interface Props {
  onLogin: (user: User) => void
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      const usuario = loginConCredenciales(username.trim(), password)
      if (usuario) {
        onLogin({
          username: usuario.username,
          role: usuario.rol,
          nombre: `${usuario.nombre}${usuario.apellido ? ' ' + usuario.apellido : ''}`,
        })
      } else {
        setError('Usuario o contraseña incorrectos')
        setLoading(false)
      }
    }, 600)
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
          <h2 className="text-lg font-bold text-white mb-6">Acceder al panel</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Usuario</label>
              <input
                type="text"
                className="input-field"
                placeholder="usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                className="input-field"
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
        </div>

        <p className="text-center text-tn-muted/50 text-xs mt-6">
          Improving Methods © {new Date().getFullYear()} Training Norte
        </p>
      </div>
    </div>
  )
}
