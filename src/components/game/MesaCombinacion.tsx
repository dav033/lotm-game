'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleX, Gauge, LoaderCircle, X } from 'lucide-react'
import { BandejaPreparacion } from './BandejaPreparacion'
import { parPreviamenteFallido } from './estadoHabilidades'
import { IconoElemento } from './IconoElemento'
import { Particulas } from './Particulas'
import { useJuegoStore } from './store'
import type { PayloadArrastre } from './useArrastre'

type IniciarArrastre = (e: React.PointerEvent, payload: PayloadArrastre) => void

// Glifos planetarios y alquímicos del anillo exterior (lo bastante largos
// para cubrir toda la órbita del círculo).
const GLIFOS_ORBITA = '☿ ♀ ♁ ♂ ♃ ♄ ☉ ☽ ♆ ♇ ✶ ⚹ '.repeat(4)

// El corazón del juego: un círculo de invocación grabado donde se depositan
// los dos elementos. Los anillos giran sin parar; al combinar, el núcleo
// canaliza energía y, si el archivo responde, estalla en motas arcanas.
export function MesaCombinacion({ iniciarArrastre }: { iniciarArrastre: IniciarArrastre }) {
  const combinando = useJuegoStore((s) => s.combinando)
  const resultado = useJuegoStore((s) => s.resultado)
  const fallo = useJuegoStore((s) => s.fallo)
  const sello = useJuegoStore((s) => s.sello)
  const hayElementos = useJuegoStore((s) => s.slots.some(Boolean))
  const limpiar = useJuegoStore((s) => s.limpiar)
  const usarResultado = useJuegoStore((s) => s.usarResultado)
  const modoRapido = useJuegoStore((s) => s.modoRapido)
  const alternarModoRapido = useJuegoStore((s) => s.alternarModoRapido)
  const [fase, setFase] = useState(0)

  useEffect(() => {
    if (!combinando) {
      setFase(0)
      return
    }
    const consulta = setTimeout(() => setFase(1), 350)
    const profunda = setTimeout(() => setFase(2), 1200)
    return () => {
      clearTimeout(consulta)
      clearTimeout(profunda)
    }
  }, [combinando])

  const exito = resultado !== null && resultado.success && resultado.results.length > 0

  return (
    <section aria-label="Círculo de invocación" aria-busy={combinando}>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h2 className="font-[family-name:var(--font-arcana)] text-xl text-brass">
          Círculo de Invocación
        </h2>
        <button
          type="button"
          aria-pressed={modoRapido}
          disabled={combinando}
          onClick={alternarModoRapido}
          title="Conserva el primer elemento después de cada intento"
          className={`ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition disabled:cursor-wait disabled:opacity-50 ${
            modoRapido
              ? 'border-spectral text-spectral shadow-[0_0_10px_-5px_var(--color-spectral)]'
              : 'border-line2 text-fog hover:text-parchment'
          }`}
        >
          <Gauge className="h-3.5 w-3.5" aria-hidden />
          Ritmo rápido {modoRapido ? 'activo' : 'inactivo'}
        </button>
      </div>
      <p className="mb-5 text-sm text-fog">
        Arrastra un elemento <span className="text-brass">sobre otro</span> para invocar su
        unión: al instante en la lista, o depositándolos en estos dos receptáculos.
        {modoRapido && (
          <span className="mt-1 block text-xs text-spectral">
            El primer elemento quedará como base; toca otro para encadenar pruebas.
          </span>
        )}
      </p>

      <div
        key={fallo}
        className={`relative mx-auto aspect-square w-full max-w-[18rem] sm:max-w-[20rem] ${
          fallo > 0 && !exito ? 'anim-shake' : ''
        }`}
      >
        <GrabadoRitual resonando={combinando} fallido={fallo > 0 && !exito} />

        <div className="absolute inset-0 flex items-center justify-center gap-3 sm:gap-5">
          {[0, 1].map((i) => (
            <Receptaculo key={i} index={i} iniciarArrastre={iniciarArrastre} />
          ))}
        </div>

        <AnimatePresence>
          {combinando && <Canalizacion key="canalizacion" />}
        </AnimatePresence>
        {exito && <Particulas key={sello} semilla={`${sello}:${resultado.inputKey}`} />}
      </div>

      <BandejaPreparacion iniciarArrastre={iniciarArrastre} />

      {hayElementos && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={limpiar}
            disabled={combinando}
            className="rounded-md border border-line2 px-5 py-2.5 text-sm text-fog transition hover:border-brass-deep hover:text-parchment disabled:cursor-wait disabled:opacity-40"
          >
            Limpiar el círculo
          </button>
        </div>
      )}

      <div className="mt-6 min-h-40" aria-live="polite">
        {combinando && (
          <div className="flex items-center justify-center gap-2 text-center text-sm italic tracking-wide text-spectral">
            <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            <span>
              {fase === 0
                ? 'Trazando la fórmula…'
                : fase === 1
                  ? 'Consultando el archivo…'
                  : 'La fórmula exige una lectura más profunda…'}
            </span>
          </div>
        )}
        {resultado && !resultado.success && !combinando && (
          <p className="anim-rise flex items-center justify-center gap-2 text-center italic text-fog">
            <CircleX className="h-4 w-4 shrink-0 text-wine" aria-hidden />
            {resultado.message}
          </p>
        )}
        {exito && (
          <div key={`res-${sello}`} className="flex flex-wrap justify-center gap-4">
            {resultado.results.map((r, idx) => (
              <motion.button
                key={idx}
                type="button"
                onClick={() => usarResultado(r.element.id)}
                aria-label={`Usar ${r.element.name} en el primer receptáculo del círculo`}
                initial={{ opacity: 0, scale: 0.7, y: 22 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22, delay: idx * 0.08 }}
                className="mx-auto max-w-sm rounded-lg mist-card brass-ring p-5 text-center hover:border-brass-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                {r.isNewDiscovery && (
                  <span className="mb-2 inline-block rounded-full border border-spectral px-3 py-0.5 text-xs uppercase tracking-widest text-spectral">
                    {r.element.kind === 'ADVANCE' ? '¡Nuevo avance!' : '¡Nuevo descubrimiento!'}
                  </span>
                )}
                <div className="anim-glow mx-auto my-3 flex h-20 w-20 items-center justify-center rounded-full border border-brass-deep">
                  <IconoElemento iconKey={r.element.iconKey} className="h-10 w-10 text-brass" />
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-xl text-parchment">
                  {r.element.name}
                  {r.quantity > 1 && (
                    <span className="ml-2 text-sm text-brass-deep">x{r.quantity}</span>
                  )}
                </h3>
                {r.element.sequenceLabel && (
                  <p className="mt-2 text-xs text-brass">{r.element.sequenceLabel}</p>
                )}
                {r.element.description && (
                  <p className="mt-2 text-sm italic text-fog">{r.element.description}</p>
                )}
                {r.element.derivationLabel && (
                  <p className="mt-2 text-xs text-brass-deep">
                    Derivado de: {r.element.derivationLabel}
                  </p>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// Grabado estático del círculo: órbita de glifos, anillo punteado interior,
// pentagrama y núcleo. Todo decorativo; los receptáculos van por encima.
function GrabadoRitual({ resonando, fallido }: { resonando: boolean; fallido: boolean }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className="absolute inset-0 h-full w-full"
      aria-hidden
      style={{
        filter: resonando
          ? 'drop-shadow(0 0 18px rgba(201, 163, 92, 0.35))'
          : fallido
            ? 'drop-shadow(0 0 14px rgba(110, 36, 50, 0.5))'
            : undefined,
        transition: 'filter 0.4s ease',
      }}
    >
      <defs>
        <path
          id="orbita-glifos"
          d="M200,200 m-166,0 a166,166 0 1,1 332,0 a166,166 0 1,1 -332,0"
          fill="none"
        />
        <radialGradient id="nucleo-ritual">
          <stop offset="0%" stopColor="rgba(201, 163, 92, 0.16)" />
          <stop offset="55%" stopColor="rgba(139, 118, 201, 0.07)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      <circle cx="200" cy="200" r="178" fill="none" stroke="var(--color-line)" strokeWidth="1" />
      <circle
        cx="200"
        cy="200"
        r="152"
        fill="none"
        stroke={fallido ? 'var(--color-wine)' : 'var(--color-brass-deep)'}
        strokeWidth="1.5"
        style={{ transition: 'stroke 0.4s ease' }}
      />

      <g className="anillo-gira">
        <text className="glifos">
          <textPath href="#orbita-glifos">{GLIFOS_ORBITA}</textPath>
        </text>
      </g>

      <g className="anillo-gira-rev">
        <circle
          cx="200"
          cy="200"
          r="128"
          fill="none"
          stroke="var(--color-line2)"
          strokeWidth="1"
          strokeDasharray="3 9"
        />
        <circle cx="200" cy="72" r="3" fill="var(--color-brass-deep)" />
        <circle cx="200" cy="328" r="3" fill="var(--color-brass-deep)" />
      </g>

      <path
        d="M200,72 L281.4,311.2 L69.2,158.8 L330.8,158.8 L118.6,311.2 Z"
        fill="none"
        stroke="var(--color-line2)"
        strokeWidth="1"
        opacity="0.55"
      />

      <circle cx="200" cy="200" r="104" fill="url(#nucleo-ritual)" />
    </svg>
  )
}

// Uno de los dos receptáculos del círculo. Cada uno se suscribe solo a su
// propio contenido y a si es el destino del arrastre en curso.
function Receptaculo({
  index,
  iniciarArrastre,
}: {
  index: number
  iniciarArrastre: IniciarArrastre
}) {
  const el = useJuegoStore((s) => s.slots[index])
  const esObjetivo = useJuegoStore(
    (s) => s.objetivo?.tipo === 'slot' && s.objetivo.index === index,
  )
  // Memoria del Aprendiz: este receptáculo es el destino del arrastre y el
  // OTRO receptáculo ya tiene un Elemento normal; el par que se formaría al
  // soltar aquí ya falló antes.
  const previouslyFailed = useJuegoStore((s) => {
    if (!s.arrastre || s.objetivo?.tipo !== 'slot' || s.objetivo.index !== index) return false
    const otro = s.slots[index === 0 ? 1 : 0]
    if (!otro || otro.kind !== 'ELEMENT') return false
    return parPreviamenteFallido(
      s.memoriaAprendiz,
      s.abilities.apprenticeMemory.unlocked,
      s.arrastre.payload.slug,
      otro.slug,
    )
  })
  const retirar = useJuegoStore((s) => s.retirar)
  const combinando = useJuegoStore((s) => s.combinando)
  const modoRapido = useJuegoStore((s) => s.modoRapido)

  return (
    <motion.div
      data-drop-slot={index}
      data-apprentice-failed={previouslyFailed ? 'true' : undefined}
      animate={esObjetivo ? { scale: 1.08 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className={`relative flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-full border-2 sm:h-[7.5rem] sm:w-[7.5rem] ${
        el
          ? 'mist-card border-brass-deep shadow-[0_0_26px_-8px_rgba(201,163,92,0.7)]'
          : 'border-dashed border-line2 bg-ink/40'
      } ${esObjetivo ? 'border-brass ring-2 ring-brass' : ''}`}
    >
      {previouslyFailed && (
        <span className="apprentice-memory-mark" aria-hidden="true">
          <X />
        </span>
      )}
      {el ? (
        <>
          <div
            onPointerDown={(e) =>
              iniciarArrastre(e, {
                slug: el.slug,
                name: el.name,
                iconKey: el.iconKey,
                origen: { tipo: 'slot', index },
              })
            }
            className="flex touch-none select-none flex-col items-center gap-1.5"
          >
            <IconoElemento iconKey={el.iconKey} className="h-8 w-8 text-brass" />
            <span className="max-w-20 px-2 text-center text-[11px] leading-tight text-parchment">
              {el.name}
            </span>
            {el.sequenceLabel && (
              <span className="rounded-full border border-brass-deep px-2 py-0.5 text-[9px] leading-tight text-brass">
                {el.sequenceLabel}
              </span>
            )}
            {el.derivationLabel && (
              <span className="max-w-20 px-2 text-center text-[8px] leading-tight text-brass-deep">
                {el.derivationLabel}
              </span>
            )}
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => retirar(index)}
            disabled={combinando}
            aria-label={`Retirar ${el.name} del receptáculo ${index + 1}`}
            className="absolute -right-1 -top-1 rounded-full border border-line bg-panel p-1.5 text-fog transition hover:border-brass-deep hover:text-parchment disabled:cursor-wait disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
          {modoRapido && index === 0 && !combinando && (
            <span className="absolute -bottom-2 rounded-full border border-spectral/60 bg-ink px-2 py-0.5 text-[8px] uppercase tracking-widest text-spectral">
              Base fija
            </span>
          )}
        </>
      ) : (
        <span className="px-5 text-center text-[10px] uppercase tracking-[0.2em] text-fog/70">
          Receptáculo {index + 1}
        </span>
      )}
    </motion.div>
  )
}

// Mientras el archivo delibera: anillo de energía girando sobre un núcleo
// que respira en el centro del círculo.
function Canalizacion() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      aria-hidden
    >
      <motion.div
        className="canal-nucleo absolute h-32 w-32"
        animate={{ scale: [1, 1.22, 1], opacity: [0.55, 1, 0.55] }}
        transition={{ repeat: Infinity, duration: 1.15, ease: 'easeInOut' }}
      />
      <div className="canal-anillo absolute h-36 w-36" />
    </motion.div>
  )
}
