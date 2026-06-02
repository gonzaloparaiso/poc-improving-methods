import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { type CalendarioCliente, DIAS_SEMANA } from '../../types'
import { EJERCICIOS } from '../../data/ejercicios'

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
export function aplanar(cals: CalendarioCliente[]): FilaPlan[] {
  const filas: FilaPlan[] = []
  cals.forEach(cal => {
    cal.semanas.forEach(semana => {
      semana.dias.forEach((dia, diaIdx) => {
        dia.bloques.forEach(bloque => {
          const ejer = bloque.ejercicios.map(ej => {
            const e = EJERCICIOS.find(x => x.id === ej.ejercicioId)
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

function descargar(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function csvEscape(v: string): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function toCSV(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.join(',')]
  rows.forEach(r => lines.push(r.map(c => csvEscape(String(c))).join(',')))
  // BOM para que Excel lo abra en UTF-8
  return '﻿' + lines.join('\n')
}

// ─── PDF ───────────────────────────────────────────────────────────────────────

export function exportarPDF(cals: CalendarioCliente[], clienteNombre: string) {
  const filas = aplanar(cals)
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

export function exportarExcel(cals: CalendarioCliente[], clienteNombre: string) {
  const filas = aplanar(cals)
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

// ─── Aimharder (CSV) ──────────────────────────────────────────────────────────
// Formato común para imports de Aimharder: fecha + clase/wod en texto.
// Columnas: date, time, classname, description

export function exportarAimharder(cals: CalendarioCliente[], clienteNombre: string) {
  const filas = aplanar(cals)
  const rows = filas.map(f => {
    const desc = [
      f.bloque,
      f.cronometro ? `⏱ ${f.cronometro}` : '',
      f.instrucciones,
      f.ejercicios,
      f.notas ? `Notas: ${f.notas}` : '',
    ].filter(Boolean).join('\n')
    return [
      f.fecha,           // date YYYY-MM-DD
      '07:00',           // time (placeholder)
      f.programa,        // classname
      desc,              // description (multilínea)
    ]
  })
  const csv = toCSV(['date', 'time', 'classname', 'description'], rows)
  descargar(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `aimharder-${clienteNombre.toLowerCase().replace(/\s+/g, '-')}.csv`,
  )
}

// ─── Wodbuster (CSV) ──────────────────────────────────────────────────────────
// Columnas habituales: Fecha, Tipo, Nombre, Descripción, Notas

export function exportarWodbuster(cals: CalendarioCliente[], clienteNombre: string) {
  const filas = aplanar(cals)
  const rows = filas.map(f => {
    const desc = [
      f.cronometro ? `Cronómetro: ${f.cronometro}` : '',
      f.instrucciones,
      f.ejercicios,
    ].filter(Boolean).join('\n')
    return [
      f.fecha,
      f.programa,        // Tipo / box
      f.bloque,          // Nombre del WOD
      desc,              // Descripción
      f.notas,
    ]
  })
  const csv = toCSV(['Fecha', 'Tipo', 'Nombre', 'Descripción', 'Notas'], rows)
  descargar(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `wodbuster-${clienteNombre.toLowerCase().replace(/\s+/g, '-')}.csv`,
  )
}
