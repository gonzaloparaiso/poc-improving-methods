import { REQUISITOS_PASSWORD } from '../lib/passwordPolicy'

/** Checklist en vivo de la política de contraseñas: se pone en verde cada
 *  requisito según el usuario va escribiendo, para que sepa exactamente
 *  qué le falta (en vez de un único mensaje de error genérico). */
export default function PasswordRequisitos({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
      {REQUISITOS_PASSWORD.map(r => {
        const ok = password.length > 0 && r.test(password)
        return (
          <li key={r.clave} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-green-400' : 'text-tn-muted'}`}>
            {ok ? (
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" strokeWidth={2} />
              </svg>
            )}
            {r.etiqueta}
          </li>
        )
      })}
    </ul>
  )
}
