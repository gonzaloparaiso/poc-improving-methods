import { useState } from 'react'
import React from 'react'
import ClientesList from './clientes/ClientesList'
import SuscripcionesCatalogo from './clientes/SuscripcionesCatalogo'

type Tab = 'clientes' | 'suscripciones'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'clientes',
    label: 'Clientes',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'suscripciones',
    label: 'Suscripciones',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
]

export default function Clientes() {
  const [tab, setTab] = useState<Tab>('clientes')

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-tn-dark border border-tn-border rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-tn-yellow text-tn-black'
                : 'text-tn-muted hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'clientes'      && <ClientesList />}
      {tab === 'suscripciones' && <SuscripcionesCatalogo />}
    </div>
  )
}
