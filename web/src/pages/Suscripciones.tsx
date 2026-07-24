import { useState, useEffect } from 'react'
import SuscripcionesCatalogo from './clientes/SuscripcionesCatalogo'
import PedidosPendientes from './clientes/PedidosPendientes'
import { apiPedidosPendientes } from '../lib/storage'

type Tab = 'catalogo' | 'pedidos'

export default function Suscripciones() {
  const [tab, setTab] = useState<Tab>('catalogo')
  // Contador de atascados: son compras cobradas cuyo cliente se quedó sin acceso,
  // así que conviene que se vean sin tener que entrar a buscarlas.
  const [atascados, setAtascados] = useState(0)

  useEffect(() => {
    void apiPedidosPendientes().then(p => setAtascados(p.length)).catch(() => {})
  }, [tab])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex gap-1 mb-5 border-b border-tn-border">
        {([
          { id: 'catalogo' as Tab, label: 'Catálogo' },
          { id: 'pedidos' as Tab, label: 'Pedidos atascados' },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              tab === t.id
                ? 'border-tn-yellow text-tn-yellow'
                : 'border-transparent text-tn-muted hover:text-white'
            }`}>
            {t.label}
            {t.id === 'pedidos' && atascados > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-400/15 text-red-400">
                {atascados}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'catalogo' ? <SuscripcionesCatalogo /> : <PedidosPendientes />}
    </div>
  )
}
