import type { DiagDifficulty } from '@/server/domain/diagnostico'

// Clases de color para las etiquetas de dificultad del análisis de progresión.
// Módulo sin 'use client': lo comparten páginas de servidor y componentes cliente.
export function colorDificultad(d: DiagDifficulty): string {
  switch (d) {
    case 'impossible':
      return 'bg-wine/20 text-wine'
    case 'extreme':
      return 'bg-red-900/30 text-red-200'
    case 'hard':
      return 'bg-orange-900/30 text-orange-200'
    case 'moderate':
      return 'bg-yellow-900/30 text-yellow-200'
    case 'easy':
      return 'bg-green-900/30 text-green-200'
    case 'trivial':
      return 'bg-brass/20 text-brass'
  }
}
