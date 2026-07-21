// Tokens de spring compartidos: antes cada componente inventaba su propio
// stiffness/damping (300-420 / 22-28) sin criterio. Dos perfiles bastan.
import type { Transition } from 'framer-motion'

// Modales: entrada/salida de una superficie grande, algo más suave.
export const SPRING_MODAL: Transition = { type: 'spring', stiffness: 300, damping: 26 }

// Todo lo demás: tarjetas, toasts, el fantasma de arrastre, feedback de
// receptáculo. Un único perfil "snappy" para que se sientan de la misma familia.
export const SPRING_UI: Transition = { type: 'spring', stiffness: 400, damping: 25 }
