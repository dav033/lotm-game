// Estado devuelto por las Server Actions de formularios del panel.
export type EstadoAccion = {
  ok: boolean
  error: string | null
}

export const ESTADO_INICIAL: EstadoAccion = { ok: false, error: null }
