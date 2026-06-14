import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootSync } from './lib/storage'
import { hydrate } from './lib/kv'

// 1) Hidratar la caché local (IndexedDB) y 2) sincronizar con el servidor,
// ambos antes de montar la app. Si la API no responde, arranca con la caché.
hydrate().then(() => bootSync()).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
