import { type ReactNode, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { type User } from '../App'

interface Props {
  children: ReactNode
  user: User
  onLogout: () => void
}

const navItems = [
  {
    path: '/administracion',
    label: 'Administración',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    path: '/clientes',
    label: 'Clientes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function Layout({ children, user, onLogout }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const currentPage = navItems.find(item => location.pathname.startsWith(item.path))?.label || ''

  return (
    <div className="min-h-screen flex bg-tn-black">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-tn-dark border-r border-tn-border flex flex-col z-30 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:flex ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-tn-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-tn-yellow rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-tn-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Improving Methods</p>
              <p className="text-tn-muted text-xs">Training Norte</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-tn-yellow text-tn-black'
                    : 'text-tn-muted hover:text-white hover:bg-tn-card'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-tn-border">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-tn-yellow flex items-center justify-center flex-shrink-0">
              <span className="text-tn-black text-xs font-black">
                {user.nombre.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user.nombre}</p>
              <p className="text-tn-muted text-xs truncate">{user.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-tn-muted hover:text-red-400 text-sm font-medium rounded-lg hover:bg-red-400/5 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-tn-dark border-b border-tn-border px-4 lg:px-8 py-4 flex items-center gap-4">
          <button
            className="lg:hidden text-tn-muted hover:text-white transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-white font-bold text-lg">{currentPage}</h1>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
