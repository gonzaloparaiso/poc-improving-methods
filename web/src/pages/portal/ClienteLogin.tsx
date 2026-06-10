import { useState, type FormEvent } from 'react'
import { useClientes } from '../../context/ClientesContext'
import { type Cliente } from '../../types'

interface Props {
  onLogin: (c: Cliente) => void
}

export default function ClienteLogin({ onLogin }: Props) {
  const { loginCliente, clientes } = useClientes()
  const [identificador, setIdentificador] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      const id = identificador.trim()
      // Intenta primero por email
      let cliente = loginCliente(id, password)
      // Si no, prueba por username
      if (!cliente) {
        const byUsername = clientes.find(
          c => c.activo && c.username === id && c.password === password
        )
        if (byUsername) cliente = byUsername
      }

      if (cliente) {
        onLogin(cliente)
      } else {
        setError('Credenciales incorrectas o cliente inactivo')
        setLoading(false)
      }
    }, 500)
  }

  return (
    <div className="min-h-screen bg-tn-black flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: `radial-gradient(circle, #F5C300 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-10">
          <img src="/tn-logo.png" alt="Training Norte" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-black text-white tracking-tight">Mi Entrenamiento</h1>
          <p className="text-tn-muted text-sm mt-1 font-medium tracking-widest uppercase">Training Norte</p>
        </div>

        <div className="card p-8 shadow-2xl shadow-black/50">
          <h2 className="text-lg font-bold text-white mb-1">Hola 👋</h2>
          <p className="text-tn-muted text-sm mb-6">Accede a tu planificación</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email o usuario</label>
              <input type="text" className="input-field" placeholder="correo@ejemplo.com"
                value={identificador} onChange={e => setIdentificador(e.target.value)}
                autoComplete="username" autoFocus required />
            </div>

            <div>
              <label className="label">Contraseña</label>
              <input type="password" className="input-field" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" required />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm font-medium">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full text-center" disabled={loading}>
              {loading ? 'Accediendo...' : 'Entrar a mi entrenamiento'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-tn-border text-center">
            <a href="/login" className="text-tn-muted text-xs hover:text-tn-yellow transition-colors">
              ¿Eres entrenador? Accede aquí
            </a>
          </div>
        </div>

        <p className="text-center text-tn-muted/50 text-xs mt-6">
          Improving Methods © {new Date().getFullYear()} Training Norte
        </p>
      </div>
    </div>
  )
}
