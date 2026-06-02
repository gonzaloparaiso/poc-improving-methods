import { type ChangeEvent } from 'react'

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Devuelve el lunes de la semana del string ISO dado */
export function getLunes(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)   // local, sin issues de timezone
  const dow = date.getDay()             // 0=Dom,1=Lun…6=Sab
  const diff = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + diff)
  return toISO(date)
}

interface Props {
  value: string
  onChange: (v: string) => void
  label?: string
  hint?: string
  minDate?: string
}

export default function LunesPicker({ value, onChange, label, hint, minDate }: Props) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return
    onChange(getLunes(e.target.value))
  }

  const displayDay = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      })
    : ''

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <input
          type="date"
          className="input-field pr-10"
          value={value}
          min={minDate}
          onChange={handleChange}
        />
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tn-muted pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      {value && (
        <p className="text-tn-yellow text-xs mt-1.5 font-medium capitalize">📅 {displayDay}</p>
      )}
      {hint && !value && (
        <p className="text-tn-muted text-xs mt-1">{hint}</p>
      )}
    </div>
  )
}
