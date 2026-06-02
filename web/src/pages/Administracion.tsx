const USERS = [
  {
    id: 1,
    username: 'admin',
    nombre: 'Administrador',
    email: 'admin@trainingnorte.com',
    role: 'Administrador',
    estado: 'Activo',
    creado: '2024-01-01',
  },
]

export default function Administracion() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Usuarios del sistema</h2>
          <p className="text-tn-muted text-sm mt-1">Gestión de accesos y roles</p>
        </div>
        <div className="flex items-center gap-2 bg-tn-card border border-tn-border rounded-lg px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          <span className="text-tn-muted text-sm">
            <span className="text-white font-semibold">{USERS.filter(u => u.estado === 'Activo').length}</span> usuarios activos
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-tn-border">
                <th className="text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-6 py-4">
                  Usuario
                </th>
                <th className="text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-6 py-4 hidden sm:table-cell">
                  Email
                </th>
                <th className="text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-6 py-4 hidden md:table-cell">
                  Rol
                </th>
                <th className="text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-6 py-4">
                  Estado
                </th>
                <th className="text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-6 py-4 hidden lg:table-cell">
                  Creado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tn-border">
              {USERS.map((u) => (
                <tr key={u.id} className="hover:bg-tn-dark/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-tn-yellow flex items-center justify-center flex-shrink-0">
                        <span className="text-tn-black text-sm font-black">
                          {u.nombre.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{u.nombre}</p>
                        <p className="text-tn-muted text-xs">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <span className="text-tn-muted text-sm">{u.email}</span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="bg-tn-yellow/10 text-tn-yellow text-xs font-semibold px-2.5 py-1 rounded-full">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="badge-active">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                      {u.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <span className="text-tn-muted text-sm">
                      {new Date(u.creado).toLocaleDateString('es-ES', {
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

      {/* Info */}
      <div className="flex items-start gap-3 bg-tn-yellow/5 border border-tn-yellow/20 rounded-xl p-4">
        <svg className="w-5 h-5 text-tn-yellow flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p className="text-tn-yellow/80 text-sm">
          La gestión completa de usuarios estará disponible en próximas versiones. Actualmente el sistema opera con el usuario administrador por defecto.
        </p>
      </div>
    </div>
  )
}
