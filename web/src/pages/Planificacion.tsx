import { useState } from 'react'
import React from 'react'
import ProgramasList from './planificacion/ProgramasList'
import BloquesList from './planificacion/BloquesList'
import EjerciciosList from './planificacion/EjerciciosList'

type Tab = 'programas' | 'bloques' | 'ejercicios'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'programas',
    label: 'Programas',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'bloques',
    label: 'Bloques',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'ejercicios',
    label: 'Ejercicios',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
]

export default function Planificacion() {
  const [tab, setTab] = useState<Tab>('programas')

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
      {tab === 'programas'   && <ProgramasList />}
      {tab === 'bloques'     && <BloquesList />}
      {tab === 'ejercicios'  && <EjerciciosList />}
    </div>
  )
}
