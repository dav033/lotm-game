'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArchiveRestore, Trash2, X } from 'lucide-react'
import { IconoElemento } from './IconoElemento'
import { useJuegoStore } from './store'
import type { InstanciaBandeja, PayloadArrastre } from './tipos'

type IniciarArrastre = (e: React.PointerEvent, payload: PayloadArrastre) => void

// Lienzo local de experimentación: cada ficha es una instancia visual con
// posición propia. Los conceptos del archivo siguen siendo reutilizables.
export function BandejaPreparacion({ iniciarArrastre }: { iniciarArrastre: IniciarArrastre }) {
  const bandeja = useJuegoStore((s) => s.bandeja)
  const esObjetivo = useJuegoStore(
    (s) =>
      s.objetivo?.tipo === 'bandeja' ||
      (s.objetivo?.tipo === 'elemento' && Boolean(s.objetivo.bandejaInstanceId)),
  )
  const combinando = useJuegoStore((s) => s.combinando)
  const limpiarBandeja = useJuegoStore((s) => s.limpiarBandeja)

  return (
    <section className="mt-7" aria-label="Lienzo de transmutación" aria-busy={combinando}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ArchiveRestore className="h-4 w-4 text-brass" aria-hidden />
        <h3 className="font-[family-name:var(--font-display)] text-sm uppercase tracking-[0.18em] text-parchment">
          Lienzo de transmutación
        </h3>
        <span className="rounded-full border border-line2 px-2 py-px text-[10px] text-fog">
          {bandeja.length} {bandeja.length === 1 ? 'ficha' : 'fichas'}
        </span>
        {bandeja.length > 0 && (
          <button
            type="button"
            disabled={combinando}
            onClick={limpiarBandeja}
            className="ml-auto flex items-center gap-1 text-[11px] text-fog transition hover:text-wine disabled:cursor-wait disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Vaciar lienzo
          </button>
        )}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-fog/80">
        Arrastra conceptos desde el Archivo, distribúyelos libremente y superpón dos fichas
        para combinarlas. Los intentos fallidos no alteran el lienzo.
      </p>

      <div
        data-drop-bandeja
        className={`relative h-[28rem] overflow-hidden rounded-xl border border-dashed transition-colors sm:h-[34rem] lg:h-[38rem] ${
          esObjetivo
            ? 'border-spectral bg-spectral/10 shadow-[inset_0_0_32px_-16px_var(--color-spectral)]'
            : 'border-line2 bg-ink/45'
        }`}
      >
        <GrabadoLienzo />

        {bandeja.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <span className="font-[family-name:var(--font-arcana)] text-3xl text-brass-deep/60">
              ☿ · ☽ · ♄
            </span>
            <p className="mt-3 max-w-xs text-xs italic leading-relaxed text-fog/65">
              Deposita aquí un concepto para abrir tu espacio de experimentación.
            </p>
          </div>
        )}

        <ul className="absolute inset-0">
          <AnimatePresence initial={false}>
            {bandeja.map((instancia) => (
              <ElementoBandeja
                key={instancia.instanceId}
                instancia={instancia}
                iniciarArrastre={iniciarArrastre}
              />
            ))}
          </AnimatePresence>
        </ul>

        {bandeja.length > 0 && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-line/70 bg-ink/75 px-3 py-1 text-[9px] uppercase tracking-widest text-fog/60">
            Mueve · superpone · descubre
          </p>
        )}
      </div>
    </section>
  )
}

function GrabadoLienzo() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-55" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(201,163,92,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(201,163,92,0.035) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line/40 sm:h-96 sm:w-96" />
      <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-line/25 sm:h-56 sm:w-56" />
      <div className="absolute left-1/2 top-1/2 h-px w-2/3 -translate-x-1/2 bg-line/20" />
      <div className="absolute left-1/2 top-1/2 h-2/3 w-px -translate-y-1/2 bg-line/20" />
    </div>
  )
}

function ElementoBandeja({
  instancia,
  iniciarArrastre,
}: {
  instancia: InstanciaBandeja
  iniciarArrastre: IniciarArrastre
}) {
  const { elemento } = instancia
  const colocar = useJuegoStore((s) => s.colocar)
  const quitar = useJuegoStore((s) => s.quitarDeBandeja)
  const combinando = useJuegoStore((s) => s.combinando)
  const esObjetivo = useJuegoStore(
    (s) =>
      s.objetivo?.tipo === 'elemento' &&
      s.objetivo.bandejaInstanceId === instancia.instanceId,
  )

  return (
    <motion.li
      layout
      data-drop-elemento={elemento.slug}
      data-bandeja-instance={instancia.instanceId}
      initial={{ opacity: 0, scale: 0.72, x: '-50%', y: '-50%' }}
      animate={{ opacity: 1, scale: esObjetivo ? 1.08 : 1, x: '-50%', y: '-50%' }}
      exit={{ opacity: 0, scale: 0.55, x: '-50%', y: '-50%' }}
      transition={{ type: 'spring', stiffness: 390, damping: 27 }}
      style={{
        left: `clamp(2.75rem, ${instancia.x * 100}%, calc(100% - 2.75rem))`,
        top: `clamp(2.5rem, ${instancia.y * 100}%, calc(100% - 2.5rem))`,
      }}
      className="absolute z-10"
    >
      <motion.button
        type="button"
        disabled={combinando}
        onPointerDown={(e) =>
          iniciarArrastre(e, {
            slug: elemento.slug,
            name: elemento.name,
            iconKey: elemento.iconKey,
            origen: { tipo: 'bandeja', instanceId: instancia.instanceId },
          })
        }
        onClick={(e) => {
          // Mouse y táctil pasan por useArrastre; Enter/Espacio llegan aquí.
          if (e.detail === 0) colocar(elemento)
        }}
        whileHover={combinando ? undefined : { y: -3 }}
        whileTap={combinando ? undefined : { scale: 0.95 }}
        aria-label={`${elemento.name}: pulsa para colocar en el círculo o arrastra para mover y combinar`}
        className={`flex min-h-16 w-20 touch-none select-none flex-col items-center justify-center gap-1 rounded-lg border bg-panel/95 px-2 py-2 text-center shadow-lg backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brass disabled:cursor-wait disabled:opacity-50 ${
          esObjetivo
            ? 'border-spectral ring-2 ring-spectral shadow-[0_0_22px_-7px_var(--color-spectral)]'
            : 'border-brass-deep/70 hover:border-brass'
        }`}
      >
        <IconoElemento iconKey={elemento.iconKey} className="h-6 w-6 text-brass" />
        <span className="max-w-full truncate text-[10px] leading-tight text-parchment">
          {elemento.name}
        </span>
      </motion.button>
      <button
        type="button"
        disabled={combinando}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => quitar(instancia.instanceId)}
        aria-label={`Quitar ${elemento.name} del lienzo`}
        className="absolute -right-2 -top-2 rounded-full border border-line bg-ink p-1.5 text-fog transition hover:border-wine hover:text-wine disabled:opacity-40"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </motion.li>
  )
}
