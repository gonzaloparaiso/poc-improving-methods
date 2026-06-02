import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { UsersProvider } from './context/UsersContext'
import { PlanificacionProvider } from './context/PlanificacionContext'
import { ClientesProvider } from './context/ClientesContext'
import { CalendariosProvider } from './context/CalendariosContext'
import { usePermisos } from './hooks/usePermisos'
import { type Seccion } from './types'
import Login from './pages/Login'
import Layout from './components/Layout'
import Administracion from './pages/Administracion'
import Clientes from './pages/Clientes'
import Suscripciones from './pages/Suscripciones'
import Planificacion from './pages/Planificacion'

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

/** Ruta raíz: admin → administracion, resto → clientes */
function HomeRedirect() {
  const { esAdmin } = usePermisos()
  return <Navigate to={esAdmin ? '/administracion' : '/clientes'} replace />
}

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('im_user')
    return saved ? JSON.parse(saved) : null
  })

  const login = (u: User) => {
    sessionStorage.setItem('im_user', JSON.stringify(u))
    setUser(u)
  }

  const logout = () => {
    sessionStorage.removeItem('im_user')
    setUser(null)
  }

  return (
    <UsersProvider>
      <ClientesProvider>
      <CalendariosProvider>
      <PlanificacionProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={user ? <Navigate to="/" replace /> : <Login onLogin={login} />}
            />
            <Route
              path="/*"
              element={
                user ? (
                  <Layout user={user} onLogout={logout}>
                    <Routes>
                      <Route path="/" element={<HomeRedirect />} />
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
      </CalendariosProvider>
      </ClientesProvider>
    </UsersProvider>
  )
}

export default App
