import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { type CalendarioCliente, DIAS_SEMANA } from '../../types'
import { type Bloque, type Ejercicio } from '../../types'

// ─── Helpers comunes ───────────────────────────────────────────────────────────

interface FilaPlan {
  fecha: string         // YYYY-MM-DD
  diaSemana: string     // Lunes…
  programa: string
  bloque: string
  cronometro: string
  instrucciones: string
  notas: string
  ejercicios: string    // "Back Squat 3×10 60s | Deadlift 5×5"
}

function fmtFecha(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

/** Aplana todos los calendarios a una lista de filas ordenada por fecha */
export function aplanar(cals: CalendarioCliente[], catalogo: Ejercicio[]): FilaPlan[] {
  const filas: FilaPlan[] = []
  cals.forEach(cal => {
    cal.semanas.forEach(semana => {
      semana.dias.forEach((dia, diaIdx) => {
        dia.bloques.forEach(bloque => {
          const ejer = bloque.ejercicios.map(ej => {
            const e = catalogo.find(x => x.id === ej.ejercicioId)
            const parts = [e?.nombre ?? '—']
            if (ej.series && ej.reps) parts.push(`${ej.series}×${ej.reps}`)
            if (ej.descanso) parts.push(`desc ${ej.descanso}`)
            if (ej.notas) parts.push(`(${ej.notas})`)
            return parts.join(' ')
          }).join(' | ')
          filas.push({
            fecha: dia.fecha,
            diaSemana: DIAS_SEMANA[diaIdx],
            programa: cal.programaNombre,
            bloque: bloque.nombre,
            cronometro: bloque.cronometro || '',
            instrucciones: bloque.instrucciones || '',
            notas: bloque.notas || '',
            ejercicios: ejer,
          })
        })
      })
    })
  })
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return filas
}

// ─── PDF ───────────────────────────────────────────────────────────────────────

export function exportarPDF(cals: CalendarioCliente[], clienteNombre: string, catalogo: Ejercicio[]) {
  const filas = aplanar(cals, catalogo)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  // Cabecera
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text('Mi Planificación · Training Norte', 40, 40)
  doc.setFontSize(11)
  doc.setTextColor(110, 110, 110)
  doc.text(`${clienteNombre}`, 40, 60)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 40, 76)

  if (filas.length === 0) {
    doc.setFontSize(12)
    doc.setTextColor(110, 110, 110)
    doc.text('Sin entrenamientos programados.', 40, 120)
  } else {
    // Agrupar por fecha para que sea legible
    const porFecha = new Map<string, FilaPlan[]>()
    filas.forEach(f => {
      const k = f.fecha
      if (!porFecha.has(k)) porFecha.set(k, [])
      porFecha.get(k)!.push(f)
    })

    const body: (string | { content: string; colSpan?: number; styles?: object })[][] = []
    porFecha.forEach((fs, fecha) => {
      // Cabecera de día (fila de cabecera amarilla)
      body.push([{
        content: `${fs[0].diaSemana.toUpperCase()} · ${fmtFecha(fecha)}`,
        colSpan: 4,
        styles: { fillColor: [245, 195, 0], textColor: [0, 0, 0], fontStyle: 'bold' },
      }])
      fs.forEach(f => {
        body.push([
          f.programa,
          f.bloque + (f.cronometro ? `  ⏱ ${f.cronometro}` : ''),
          f.ejercicios || '—',
          [f.instrucciones, f.notas].filter(Boolean).join(' / '),
        ])
      })
    })

    autoTable(doc, {
      startY: 100,
      head: [['Programa', 'Bloque', 'Ejercicios', 'Instrucciones / Notas']],
      body,
      styles: { fontSize: 9, cellPadding: 6, valign: 'top' },
      headStyles: { fillColor: [20, 20, 20], textColor: [245, 195, 0], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 140 },
        2: { cellWidth: 320 },
        3: { cellWidth: 180 },
      },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.height
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Improving Methods · Training Norte · Página ${doc.getNumberOfPages()}`,
          40, pageHeight - 20,
        )
      },
    })
  }

  doc.save(`planificacion-${clienteNombre.toLowerCase().replace(/\s+/g, '-')}.pdf`)
}

// ─── Excel ─────────────────────────────────────────────────────────────────────

export function exportarExcel(cals: CalendarioCliente[], clienteNombre: string, catalogo: Ejercicio[]) {
  const filas = aplanar(cals, catalogo)
  const wb = XLSX.utils.book_new()

  // Hoja 1: Todo plano
  const sheet1 = XLSX.utils.json_to_sheet(filas.map(f => ({
    Fecha:         f.fecha,
    Día:           f.diaSemana,
    Programa:      f.programa,
    Bloque:        f.bloque,
    Cronómetro:    f.cronometro,
    Ejercicios:    f.ejercicios,
    Instrucciones: f.instrucciones,
    Notas:         f.notas,
  })))
  // Anchos de columna
  sheet1['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 26 },
    { wch: 12 }, { wch: 60 }, { wch: 40 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, sheet1, 'Planificación')

  // Hoja por programa
  cals.forEach(cal => {
    const datosProg = filas
      .filter(f => f.programa === cal.programaNombre)
      .map(f => ({
        Fecha: f.fecha, Día: f.diaSemana,
        Bloque: f.bloque, Cronómetro: f.cronometro,
        Ejercicios: f.ejercicios,
        Instrucciones: f.instrucciones, Notas: f.notas,
      }))
    if (datosProg.length === 0) return
    const sh = XLSX.utils.json_to_sheet(datosProg)
    sh['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 26 }, { wch: 12 },
      { wch: 60 }, { wch: 40 }, { wch: 30 },
    ]
    // Sheet names tienen límite de 31 chars y caracteres prohibidos
    const safeName = cal.programaNombre.replace(/[\\/?*[\]:]/g, '').slice(0, 28)
    XLSX.utils.book_append_sheet(wb, sh, safeName || 'Programa')
  })

  XLSX.writeFile(wb, `planificacion-${clienteNombre.toLowerCase().replace(/\s+/g, '-')}.xlsx`)
}

// ─── Copiar un bloque como texto plano (Aimharder / Wodbuster) ────────────────
// Ninguna de las dos plataformas permite importar entrenamientos vía API, así
// que en vez de exportar un fichero, se copia el WOD de una sesión al
// portapapeles para pegarlo directamente como texto en la app del cliente.

function lineaEjercicio(ej: Bloque['ejercicios'][number], catalogo: Ejercicio[]): string {
  const nombre = catalogo.find(e => e.id === ej.ejercicioId)?.nombre ?? '—'
  const partes = [nombre]
  if (ej.series && ej.reps) partes.push(`${ej.series}×${ej.reps}`)
  else if (ej.reps) partes.push(ej.reps)
  if (ej.descanso) partes.push(`descanso ${ej.descanso}`)
  const linea = '- ' + partes.join(' ')
  return ej.notas ? `${linea} (${ej.notas})` : linea
}

/** Texto plano de una sesión (bloque) listo para pegar en Aimharder/Wodbuster. */
export function textoBloque(bloque: Bloque, catalogo: Ejercicio[]): string {
  const lineas: string[] = []
  if (bloque.nombre) lineas.push(bloque.nombre)
  if (bloque.cronometro) lineas.push(`⏱ ${bloque.cronometro}`)
  if (bloque.instrucciones) lineas.push('', bloque.instrucciones)
  if (bloque.ejercicios.length) {
    lineas.push('')
    bloque.ejercicios.forEach(ej => lineas.push(lineaEjercicio(ej, catalogo)))
  }
  return lineas.join('\n')
}
