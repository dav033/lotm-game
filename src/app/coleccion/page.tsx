import { Lock } from 'lucide-react'
import { prisma } from '@/server/db'
import { obtenerPerfilActual } from '@/server/perfil'
import { IconoElemento } from '@/components/game/IconoElemento'
import { descubrirIniciales } from '@/server/domain/descubrimientos'
import { faseActualParaPerfil, filtroElementoDisponiblePorPhaseIds } from '@/server/domain/fases'
import { ELEMENT_TYPE_LABELS, etiquetaTipo } from '@/server/domain/tipos'

export const runtime = 'nodejs'

export default async function PaginaColeccion() {
  const perfil = await obtenerPerfilActual()
  if (perfil) await descubrirIniciales(prisma, perfil.id)
  const phaseState = perfil ? await faseActualParaPerfil(prisma, perfil.id) : null
  const availablePhaseIds = [...(phaseState?.availablePhaseIds ?? [])]
  const availableElementFilter = filtroElementoDisponiblePorPhaseIds(availablePhaseIds)

  const [categoriasCargadas, elementos, caminos, descubrimientos, desbloqueos, pistas] =
    await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.element.findMany({
        where: availableElementFilter,
        include: { categories: true, sequence: true },
        orderBy: [{ tier: 'asc' }, { name: 'asc' }],
      }),
      prisma.pathway.findMany({
        where: {
          isActive: true,
          sequences: {
            some: {
              element: availableElementFilter,
            },
          },
        },
        include: {
          sequences: {
            where: {
              element: availableElementFilter,
            },
            orderBy: { number: 'desc' },
            include: { element: true },
          },
        },
      }),
      perfil
          ? prisma.playerDiscovery.findMany({
            where: {
              profileId: perfil.id,
              element: availableElementFilter,
            },
            select: { elementId: true },
          })
        : Promise.resolve([]),
      perfil
        ? prisma.playerPathwayUnlock.findMany({
            where: { profileId: perfil.id },
            select: { pathwayId: true },
          })
        : Promise.resolve([]),
      prisma.recipe.findMany({
        where: {
          isActive: true,
          hintText: { not: null },
          outputs: {
            some: {
              element: availableElementFilter,
            },
          },
        },
        select: {
          hintText: true,
          outputs: {
            where: {
              element: availableElementFilter,
            },
            select: { elementId: true },
          },
        },
      }),
    ])

  const categoryById = new Map(categoriasCargadas.map((category) => [category.id, category]))
  const visibleCategoryIds = new Set(
    elementos.flatMap((element) => element.categories.map((category) => category.categoryId)),
  )
  const pendingCategoryIds = [...visibleCategoryIds]
  while (pendingCategoryIds.length > 0) {
    const parentId = categoryById.get(pendingCategoryIds.pop()!)?.parentId
    if (parentId && !visibleCategoryIds.has(parentId)) {
      visibleCategoryIds.add(parentId)
      pendingCategoryIds.push(parentId)
    }
  }
  const categorias = categoriasCargadas.filter((category) => visibleCategoryIds.has(category.id))

  const descubierto = new Set(descubrimientos.map((d) => d.elementId))
  const desbloqueado = new Set(desbloqueos.map((u) => u.pathwayId))
  const caminosDesbloqueados = caminos.filter((camino) => desbloqueado.has(camino.id)).length
  const pistaDe = new Map<string, string>()
  for (const p of pistas) {
    for (const output of p.outputs) {
      pistaDe.set(output.elementId, p.hintText ?? '')
    }
  }

  const total = elementos.length
  const nDescubiertos = elementos.filter((e) => descubierto.has(e.id)).length
  const porcentaje = total === 0 ? 0 : Math.round((nDescubiertos / total) * 100)

  const secuenciasTotales = caminos.flatMap((c) => c.sequences)
  const secuenciasDescubiertas = secuenciasTotales.filter((s) => descubierto.has(s.elementId))

  const porTipo = (tipo: string) => {
    const del = elementos.filter((e) => e.type === tipo)
    return { total: del.length, descubiertos: del.filter((e) => descubierto.has(e.id)).length }
  }

  const elementosDe = (categoriaId: string) =>
    elementos.filter((e) => e.categories.some((c) => c.categoryId === categoriaId))

  // Una categoría oculta permanece sellada hasta que se descubre algo dentro
  // de ella o de sus descendientes.
  const tieneDescubiertos = (categoriaId: string): boolean => {
    if (elementosDe(categoriaId).some((e) => descubierto.has(e.id))) return true
    return categorias
      .filter((c) => c.parentId === categoriaId)
      .some((hija) => tieneDescubiertos(hija.id))
  }

  const raices = categorias.filter((c) => !c.parentId)
  const hijasDe = (id: string) => categorias.filter((c) => c.parentId === id)

  const TarjetaElemento = ({ e }: { e: (typeof elementos)[number] }) => {
    const visible = descubierto.has(e.id) || !e.isHiddenUntilDiscovered
    if (!visible) {
      return (
        <li className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-line p-3 text-center opacity-70">
          <span className="flex h-7 w-7 items-center justify-center text-fog/50" aria-hidden>?</span>
          <span className="text-xs text-fog/60">Sin descubrir</span>
          {pistaDe.get(e.id) && (
            <span className="text-[10px] italic text-fog/50">«{pistaDe.get(e.id)}»</span>
          )}
        </li>
      )
    }
    const logrado = descubierto.has(e.id)
    return (
      <li
        className={`flex flex-col items-center gap-1.5 rounded-lg p-3 text-center ${
          logrado ? 'mist-card' : 'border border-dashed border-line opacity-80'
        }`}
      >
        <IconoElemento iconKey={e.iconKey} className={`h-7 w-7 ${logrado ? 'text-brass' : 'text-fog/60'}`} />
        <span className="text-xs text-parchment">{e.name}</span>
        <span className="text-[10px] uppercase tracking-wider text-fog/70">
          {etiquetaTipo(e.type)}{!logrado && ' · sin descubrir'}
        </span>
        {logrado && e.description && (
          <span className="text-[10px] italic leading-snug text-fog">{e.description}</span>
        )}
      </li>
    )
  }

  const SeccionCategoria = ({ id, nivel }: { id: string; nivel: number }) => {
    const cat = categorias.find((c) => c.id === id)
    if (!cat) return null
    const sellada = cat.isHidden && !tieneDescubiertos(cat.id)
    const lista = elementosDe(cat.id)
    return (
      <section className={nivel > 0 ? 'ml-4 border-l border-line pl-4' : ''}>
        {sellada ? (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-dashed border-line p-4 text-fog/60">
            <Lock className="h-4 w-4" aria-hidden />
            <span className="italic">
              Una sección del archivo permanece sellada. Sigue combinando…
            </span>
          </div>
        ) : (
          <>
            <h3 className="mb-1 font-[family-name:var(--font-display)] text-lg text-brass">
              {cat.name}
            </h3>
            {cat.description && <p className="mb-3 text-sm italic text-fog">{cat.description}</p>}
            {lista.length > 0 && (
              <ul className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {lista.map((e) => <TarjetaElemento key={e.id} e={e} />)}
              </ul>
            )}
            {hijasDe(cat.id).map((hija) => (
              <SeccionCategoria key={hija.id} id={hija.id} nivel={nivel + 1} />
            ))}
          </>
        )}
      </section>
    )
  }

  return (
    <div className="mist-bg min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-brass">
            Colección · Enciclopedia
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* ===== Resumen ===== */}
        <section aria-label="Resumen de progreso" className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg mist-card p-4">
            <div className="text-2xl font-bold text-brass">{nDescubiertos}/{total}</div>
            <div className="text-xs uppercase tracking-wider text-fog">Elementos · {porcentaje}%</div>
          </div>
          {(['MUNDANO', 'CONCEPTO', 'MISTICISMO', 'BEYONDER'] as const).map((t) => {
            const { total: tt, descubiertos: dd } = porTipo(t)
            return (
              <div key={t} className="rounded-lg mist-card p-4">
                <div className="text-2xl font-bold text-parchment">{dd}/{tt}</div>
                <div className="text-xs uppercase tracking-wider text-fog">{ELEMENT_TYPE_LABELS[t]}</div>
              </div>
            )
          })}
          <div className="rounded-lg mist-card p-4">
            <div className="text-2xl font-bold text-parchment">
              {caminosDesbloqueados}/{caminos.length}
            </div>
            <div className="text-xs uppercase tracking-wider text-fog">
              Caminos · {secuenciasDescubiertas.length}/{secuenciasTotales.length} secuencias
            </div>
          </div>
        </section>

        {/* ===== Categorías ===== */}
        {raices.map((cat) => (
          <SeccionCategoria key={cat.id} id={cat.id} nivel={0} />
        ))}

        {/* ===== Caminos ===== */}
        <section aria-label="Caminos" className="mt-10">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl text-brass">Caminos</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {caminos.map((camino) => {
              const abierto = desbloqueado.has(camino.id) || !camino.isHiddenUntilDiscovered
              if (!abierto) {
                return (
                  <div
                    key={camino.id}
                    className="flex items-center gap-3 rounded-lg border border-dashed border-line p-5 text-fog/60"
                  >
                    <Lock className="h-5 w-5" aria-hidden />
                    <span className="italic">Un camino permanece sellado.</span>
                  </div>
                )
              }
              return (
                <div key={camino.id} className="rounded-lg mist-card brass-ring p-5">
                  <h3 className="font-[family-name:var(--font-display)] text-lg text-brass">
                    {camino.name}
                  </h3>
                  {camino.description && (
                    <p className="mt-1 text-sm italic text-fog">{camino.description}</p>
                  )}
                  <ul className="mt-3 space-y-1">
                    {camino.sequences.map((s) => {
                      const logrado = descubierto.has(s.elementId)
                      return (
                        <li key={s.id} className={`text-sm ${logrado ? 'text-parchment' : 'text-fog/60'}`}>
                          Secuencia {s.number}: {logrado ? s.name : '???'}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
            {caminos.length === 0 && (
              <p className="italic text-fog">El archivo aún no registra ningún camino.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
