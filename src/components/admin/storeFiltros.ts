'use client'

import { create } from 'zustand'

// Fábrica de stores de filtros para las tablas del panel. El filtrado ocurre
// íntegro en el cliente (los datos ya vienen cargados de una vez), así cada
// tecla responde al instante sin ida y vuelta al servidor. La URL se sincroniza
// aparte con history.replaceState, sin re-render de Next.
export function crearStoreFiltros<T extends object>(inicial: T) {
  return create<{
    filtros: T
    setFiltros: (parcial: Partial<T>) => void
    reiniciar: () => void
  }>()((set) => ({
    filtros: inicial,
    setFiltros: (parcial) => set((s) => ({ filtros: { ...s.filtros, ...parcial } })),
    reiniciar: () => set({ filtros: inicial }),
  }))
}
