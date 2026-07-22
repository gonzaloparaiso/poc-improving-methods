// Política de contraseñas del cliente/panel: debe coincidir exactamente con
// erroresPassword() en api/server.js (esa es la fuente de verdad real —
// esto solo repite la regla para dar feedback al vuelo sin ir al servidor).
export interface RequisitoPassword {
  clave: string
  etiqueta: string
  test: (pw: string) => boolean
}

export const REQUISITOS_PASSWORD: RequisitoPassword[] = [
  { clave: 'longitud',   etiqueta: 'Al menos 8 caracteres',   test: pw => pw.length >= 8 },
  { clave: 'mayuscula',  etiqueta: 'Una letra mayúscula',     test: pw => /[A-Z]/.test(pw) },
  { clave: 'minuscula',  etiqueta: 'Una letra minúscula',     test: pw => /[a-z]/.test(pw) },
  { clave: 'numero',     etiqueta: 'Un número',               test: pw => /[0-9]/.test(pw) },
  { clave: 'especial',   etiqueta: 'Un carácter especial',    test: pw => /[^A-Za-z0-9]/.test(pw) },
]

export function passwordEsValida(pw: string): boolean {
  return REQUISITOS_PASSWORD.every(r => r.test(pw))
}

/** Mensaje de error compacto (para banners de formulario), o null si es válida. */
export function errorPassword(pw: string): string | null {
  const faltan = REQUISITOS_PASSWORD.filter(r => !r.test(pw)).map(r => r.etiqueta.toLowerCase())
  if (faltan.length === 0) return null
  return `La contraseña debe tener ${faltan.join(', ')}`
}
