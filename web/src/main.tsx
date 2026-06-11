import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootSync } from './lib/storage'

// Cargar los datos del servidor (o migrar los locales) antes de montar la app.
// Si la API no responde, la app arranca igualmente con la caché local.
bootSync().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
