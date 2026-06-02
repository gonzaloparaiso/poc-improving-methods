import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Login from './pages/Login'
import Layout from './components/Layout'
import Administracion from './pages/Administracion'
import Clientes from './pages/Clientes'

export interface User {
  username: string
  role: string
  nombre: string
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
                  <Route path="/" element={<Navigate to="/administracion" replace />} />
                  <Route path="/administracion" element={<Administracion />} />
                  <Route path="/clientes" element={<Clientes />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
