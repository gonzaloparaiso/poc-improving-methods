import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { UsersProvider } from './context/UsersContext'
import { PlanificacionProvider } from './context/PlanificacionContext'
import { ClientesProvider } from './context/ClientesContext'
import { CalendariosProvider } from './context/CalendariosContext'
import { EjerciciosProvider } from './context/EjerciciosContext'
import { usePermisos } from './hooks/usePermisos'
import { logout as apiLogout } from './lib/storage'
import { type Seccion, type Cliente } from './types'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Administracion from './pages/Administracion'
import Clientes from './pages/Clientes'
import Suscripciones from './pages/Suscripciones'
import Planificacion from './pages/Planificacion'
import ClienteLogin from './pages/portal/ClienteLogin'
import ClienteReset from './pages/portal/ClienteReset'
import PortalCliente from './pages/portal/PortalCliente'

export interface User {
  username: string
  role: string
  nombre: string
}

/** Guarda una ruta: si el rol no tiene acceso, redirige a /clientes */
function Guard({ seccion, children }: { seccion: Seccion; children: ReactNode }) {
  const { puede } = usePermisos()
  if (!puede(seccion, 'ver')) return <Navigate to="/clientes" replace />
  return <>{children}</>
}

/** Ruta raíz: todos los roles entran directamente a Clientes */
function HomeRedirect() {
  return <Navigate to="/clientes" replace />
}

const STORAGE_CLIENTE = 'im_cliente_sesion'

function App() {
  // La sesión solo es válida si hay token (evita estados antiguos sin token)
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('im_user')
    const token = sessionStorage.getItem('im_token')
    return saved && token ? JSON.parse(saved) : null
  })

  const [cliente, setCliente] = useState<Cliente | null>(() => {
    const saved = sessionStorage.getItem(STORAGE_CLIENTE)
    const token = sessionStorage.getItem('im_cliente_token')
    return saved && token ? JSON.parse(saved) : null
  })

  // El login real (con token) lo hacen los componentes Login/ClienteLogin y
  // recargan la página; estos setters solo cubren el estado local de React.
  const loginStaff = (u: User) => {
    sessionStorage.setItem('im_user', JSON.stringify(u))
    setUser(u)
  }
  const logoutStaff = () => {
    apiLogout()
    sessionStorage.removeItem('im_user')
    setUser(null)
    window.location.assign('/login')
  }

  const loginCliente = (c: Cliente) => {
    sessionStorage.setItem(STORAGE_CLIENTE, JSON.stringify(c))
    setCliente(c)
  }
  const logoutCliente = () => {
    apiLogout()
    sessionStorage.removeItem(STORAGE_CLIENTE)
    setCliente(null)
    window.location.assign('/portal/login')
  }

  return (
    <UsersProvider>
      <ClientesProvider>
      <CalendariosProvider>
      <EjerciciosProvider>
      <PlanificacionProvider>
        <BrowserRouter>
          <Routes>
            {/* Portal cliente */}
            <Route
              path="/portal/login"
              element={cliente ? <Navigate to="/portal" replace /> : <ClienteLogin onLogin={loginCliente} />}
            />
            <Route path="/portal/reset" element={<ClienteReset />} />
            <Route
              path="/portal"
              element={
                cliente
                  ? <PortalCliente cliente={cliente} onLogout={logoutCliente} />
                  : <Navigate to="/portal/login" replace />
              }
            />

            {/* Staff */}
            <Route
              path="/login"
              element={user ? <Navigate to="/" replace /> : <Login onLogin={loginStaff} />}
            />
            <Route
              path="/*"
              element={
                user ? (
                  <Layout user={user} onLogout={logoutStaff}>
                    <Routes>
                      <Route path="/" element={<HomeRedirect />} />
                      <Route path="/dashboard" element={
                        <Guard seccion="dashboard"><Dashboard /></Guard>
                      } />
                      <Route path="/administracion" element={
                        <Guard seccion="administracion"><Administracion /></Guard>
                      } />
                      <Route path="/clientes"       element={<Clientes />} />
                      <Route path="/suscripciones"  element={<Suscripciones />} />
                      <Route path="/planificacion"  element={<Planificacion />} />
                    </Routes>
                  </Layout>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
          </Routes>
        </BrowserRouter>
      </PlanificacionProvider>
      </EjerciciosProvider>
      </CalendariosProvider>
      </ClientesProvider>
    </UsersProvider>
  )
}

export default App
