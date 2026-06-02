import { useState, useEffect, type FormEvent } from 'react'

interface Props {
  title: string
  description?: string
  label: string
  defaultValue?: string
  confirmLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export default function PromptDialog({
  title, description, label, defaultValue = '', confirmLabel = 'Aceptar', onConfirm, onCancel,
}: Props) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => { setValue(defaultValue) }, [defaultValue])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const v = value.trim()
    if (!v) return
    onConfirm(v)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-tn-yellow/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-bold">{title}</h4>
            {description && <p className="text-tn-muted text-sm mt-1">{description}</p>}
          </div>
        </div>
        <div>
          <label className="label">{label}</label>
          <input type="text" className="input-field"
            value={value} onChange={e => setValue(e.target.value)}
            autoFocus required />
        </div>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="btn-primary flex-1" disabled={!value.trim()}>{confirmLabel}</button>
        </div>
      </form>
    </div>
  )
}
