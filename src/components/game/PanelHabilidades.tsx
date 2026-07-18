'use client'

import React from 'react'
import { Archive, Eye, LoaderCircle, ScanEye } from 'lucide-react'
import {
  NUMERAL_TIER,
  POTENTIAL_TIER_LABELS,
  rangoDeTier,
  type PlayerAbilities,
  type PotentialTier,
} from '@/server/domain/habilidades'
import { useJuegoStore } from './store'
import { hayFacultadesDesbloqueadas } from './estadoHabilidades'

const TIERS: PotentialTier[] = [1, 2, 3, 4, 5]

// Facultades visibles del perfil. El panel completo desaparece cuando ninguna
// está desbloqueada: no muestra nombres ni siluetas de progresión futura.
export function PanelHabilidades({ abilitiesOverride }: { abilitiesOverride?: PlayerAbilities }) {
  const abilitiesStore = useJuegoStore((s) => s.abilities)
  const abilities = abilitiesOverride ?? abilitiesStore
  const activarModoVidente = useJuegoStore((s) => s.activarModoVidente)
  const seerCargando = useJuegoStore((s) => s.seerCargando)
  const seerResultado = useJuegoStore((s) => s.seerResultado)
  const mysteryActivo = useJuegoStore((s) => s.mysteryActivo)
  const mysteryCargando = useJuegoStore((s) => s.mysteryCargando)
  const alternarMystery = useJuegoStore((s) => s.alternarMystery)

  if (!hayFacultadesDesbloqueadas(abilities)) return null

  return (
    <section className="mb-7 rounded-lg mist-card p-5" aria-labelledby="titulo-facultades">
      <div className="mb-4 flex items-center gap-2">
        <ScanEye className="h-5 w-5 text-spectral" aria-hidden />
        <h2
          id="titulo-facultades"
          className="font-[family-name:var(--font-arcana)] text-lg text-brass"
        >
          Facultades de secuencia
        </h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {abilities.seer.unlocked && (
          <article className="rounded-md border border-line bg-ink/30 p-4">
            <div className="flex items-start gap-3">
              <Eye className="mt-0.5 h-5 w-5 shrink-0 text-spectral" aria-hidden />
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-sm text-parchment">
                  Adivinación del Vidente
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-fog">
                  Selecciona un elemento para percibir cuántas combinaciones pendientes
                  resuenan con tu conocimiento actual.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={activarModoVidente}
              disabled={seerCargando}
              className="btn-ghost mt-3 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {seerCargando && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {seerCargando ? 'Adivinando…' : 'Adivinar'}
            </button>
            <p aria-live="polite" className="mt-3 text-xs text-fog">
              {seerResultado && (
                <>
                  Última adivinación: «{seerResultado.nombre}» ·{' '}
                  <span className="text-brass">
                    {seerResultado.availableCombinationCount}{' '}
                    {seerResultado.availableCombinationCount === 1
                      ? 'combinación pendiente'
                      : 'combinaciones pendientes'}
                  </span>
                </>
              )}
            </p>
          </article>
        )}

        {abilities.mysteryPryer.unlocked && (
          <article className="rounded-md border border-line bg-ink/30 p-4">
            <div className="flex items-start gap-3">
              <ScanEye className="mt-0.5 h-5 w-5 shrink-0 text-spectral" aria-hidden />
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-sm text-parchment">
                  Visión del Mystery Pryer
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-fog">
                  Revela el potencial latente de cada elemento sin mostrar sus fórmulas.
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-pressed={mysteryActivo}
              onClick={() => void alternarMystery()}
              disabled={mysteryCargando}
              className="btn-ghost mt-3 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mysteryCargando && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {mysteryCargando
                ? 'Descifrando…'
                : mysteryActivo
                  ? 'Ocultar potencial'
                  : 'Revelar potencial'}
            </button>
          </article>
        )}

        {abilities.savant.unlocked && (
          <article className="pointer-events-none rounded-md border border-line bg-ink/20 p-4 opacity-75">
            <div className="flex items-start gap-3">
              <Archive className="mt-0.5 h-5 w-5 shrink-0 text-brass-deep" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-[family-name:var(--font-display)] text-sm text-parchment">
                    Archivo del Savant
                  </h3>
                  <span className="rounded-full border border-line2 px-2 py-0.5 text-[10px] text-fog">
                    {abilities.savant.used}/{abilities.savant.capacity}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-fog">
                  Esta facultad conservará fórmulas que el conocimiento actual todavía no
                  permite ejecutar.
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1.5" aria-label="Cinco espacios vacíos">
              {Array.from({ length: abilities.savant.capacity }, (_, i) => (
                <span
                  key={i}
                  className="aspect-square rounded border border-dashed border-line2 bg-panel/40"
                  aria-hidden
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" disabled className="btn-ghost cursor-not-allowed opacity-50">
                Guardar combinación
              </button>
              <span className="text-[10px] uppercase tracking-widest text-fog">
                Facultad en desarrollo
              </span>
            </div>
          </article>
        )}
      </div>

      {mysteryActivo && (
        <div className="mt-4 rounded-md border border-line bg-panel/50 p-3" aria-label="Leyenda de potencial">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-fog">Escala de potencial</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
            {TIERS.map((tier) => (
              <span key={tier} data-pot-color={tier} className="pot-leyenda">
                <strong>{NUMERAL_TIER[tier]}</strong> — {POTENTIAL_TIER_LABELS[tier]}{' '}
                <span className="text-fog/70">({rangoDeTier(tier)})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
