// Lista semilla de respiraciones — al primer arranque se carga en
// ContenidoContext. A partir de ahí es editable (crear/editar/borrar) desde
// el panel de administradores (Contenido → Respiración).
import { type ContenidoItem } from '../types'

export const RESPIRACIONES_SEED: ContenidoItem[] = [
  {
    id: 'resp01',
    titulo: 'Respiración diafragmática',
    descripcion: 'Respiración profunda desde el diafragma, activando el sistema nervioso parasimpático. Tumbado o sentado, una mano en el pecho y otra en el abdomen: el abdomen debe subir y bajar mientras el pecho apenas se mueve. Ideal para reducir el estrés antes o después de entrenar.',
    etiquetas: ['relajación', 'básica', 'pre-entreno'],
    mediaTipo: null, mediaUrl: '', mediaNombre: '', mediaSize: 0, thumbnail: '',
    creadoEn: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'resp02',
    titulo: 'Respiración 4-7-8',
    descripcion: 'Inhala por la nariz durante 4 segundos, retén el aire 7 segundos y exhala por la boca durante 8 segundos. Repetir 4-6 ciclos. Ayuda a calmar el sistema nervioso y favorece el descanso, perfecta antes de dormir o para bajar pulsaciones tras un WOD intenso.',
    etiquetas: ['relajación', 'sueño', 'post-entreno'],
    mediaTipo: null, mediaUrl: '', mediaNombre: '', mediaSize: 0, thumbnail: '',
    creadoEn: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'resp03',
    titulo: 'Respiración de caja (Box Breathing)',
    descripcion: 'Inhala 4 segundos, retén 4 segundos, exhala 4 segundos, retén 4 segundos con los pulmones vacíos. Técnica usada por unidades militares y deportistas de alto rendimiento para mantener la calma y la concentración bajo presión.',
    etiquetas: ['concentración', 'competición', 'control'],
    mediaTipo: null, mediaUrl: '', mediaNombre: '', mediaSize: 0, thumbnail: '',
    creadoEn: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'resp04',
    titulo: 'Respiración activadora (Wim Hof, ronda básica)',
    descripcion: '30 respiraciones profundas y rápidas (inhalación completa, exhalación pasiva sin forzar) seguidas de una retención en apnea tras la última exhalación. Aumenta la energía y la tolerancia al estrés. No recomendada antes de nadar o conducir.',
    etiquetas: ['energizante', 'avanzada', 'activación'],
    mediaTipo: null, mediaUrl: '', mediaNombre: '', mediaSize: 0, thumbnail: '',
    creadoEn: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'resp05',
    titulo: 'Respiración alterna (Nadi Shodhana)',
    descripcion: 'Tapa la fosa nasal derecha e inhala por la izquierda, tapa la izquierda y exhala por la derecha; repite alternando. Técnica de yoga que equilibra el sistema nervioso y mejora la claridad mental. Ideal para el calentamiento de movilidad o el cierre de la sesión.',
    etiquetas: ['equilibrio', 'yoga', 'movilidad'],
    mediaTipo: null, mediaUrl: '', mediaNombre: '', mediaSize: 0, thumbnail: '',
    creadoEn: '2026-01-01T00:00:00.000Z',
  },
]
