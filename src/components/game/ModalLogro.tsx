'use client'

import type { AchievementPublicData } from '@/server/domain/tipos'
import { IconoElemento } from './IconoElemento'

export function ModalLogro({
  logro,
  onCerrar,
}: {
  logro: AchievementPublicData
  onCerrar: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Logro desbloqueado: ${logro.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
    >
      <div className="mist-card brass-ring w-full max-w-md rounded-xl p-8 text-center">
        <span className="text-xs uppercase tracking-[0.25em] text-brass-deep">
          Logro desbloqueado
        </span>
        <div className="anim-glow mx-auto my-5 flex h-24 w-24 items-center justify-center rounded-full border border-brass-deep">
          <IconoElemento iconKey={logro.iconKey} className="h-12 w-12 text-brass" />
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-brass">
          {logro.name}
        </h2>
        {logro.description && <p className="mt-4 italic text-fog">{logro.description}</p>}
        <button autoFocus type="button" onClick={onCerrar} className="btn-brass mt-7">
          Continuar
        </button>
      </div>
    </div>
  )
}
