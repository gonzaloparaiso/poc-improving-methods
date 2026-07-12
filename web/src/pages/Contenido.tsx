import { useState } from 'react'
import React from 'react'
import RespiracionesList from './contenido/RespiracionesList'
import MovilidadList from './contenido/MovilidadList'

type Tab = 'respiracion' | 'movilidad'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'respiracion',
    label: 'Respiración',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />
      </svg>
    ),
  },
  {
    id: 'movilidad',
    label: 'Movilidad',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
      </svg>
    ),
  },
]

export default function Contenido() {
  const [tab, setTab] = useState<Tab>('respiracion')

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

      {/* Contenido */}
      {tab === 'respiracion' && <RespiracionesList />}
      {tab === 'movilidad'   && <MovilidadList />}
    </div>
  )
}
