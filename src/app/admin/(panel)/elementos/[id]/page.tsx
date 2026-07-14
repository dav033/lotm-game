import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { elementoEstaReferenciado, eliminarElemento } from '@/server/actions/elementos'
import FormularioElemento from '@/components/admin/FormularioElemento'
import ConstructorReceta from '@/components/admin/ConstructorReceta'
import { BotonEliminar } from '@/components/admin/BotonEliminar'

export const runtime = 'nodejs'

export default async function PaginaEditarElemento({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirAdminPagina()
  const { id } = await params

  const [elemento, categorias, todosElementos, caminos] = await Promise.all([
    prisma.element.findUnique({
      where: { id },
      include: {
        categories: true,
        sequence: { include: { pathway: true } },
        unlockTriggers: { select: { triggerId: true } },
        outputs: {
          include: {
            recipe: { include: { ingredients: { include: { element: true } }, outputs: true } },
          },
        },
        usedIn: { include: { recipe: { include: { outputs: { include: { element: true } } } } } },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.element.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, iconKey: true, isActive: true },
    }),
    prisma.pathway.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  if (!elemento) notFound()

  const referenciado = await elementoEstaReferenciado(id)
  const principal = elemento.categories.find((c) => c.isPrimary)

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Editar: {elemento.name}
      </h1>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <FormularioElemento
          elemento={{
            id: elemento.id,
            slug: elemento.slug,
            name: elemento.name,
            description: elemento.description,
            iconKey: elemento.iconKey,
            imageUrl: elemento.imageUrl,
            type: elemento.type,
            tier: elemento.tier,
            isStarter: elemento.isStarter,
            isHiddenUntilDiscovered: elemento.isHiddenUntilDiscovered,
            isMajorDiscovery: elemento.isMajorDiscovery,
            revealTitle: elemento.revealTitle,
            revealText: elemento.revealText,
            unlockedByType: elemento.unlockedByType,
            unlockedBySequenceNumber: elemento.unlockedBySequenceNumber,
            triggerIds: elemento.unlockTriggers.map((t) => t.triggerId),
            isActive: elemento.isActive,
            categoriaIds: elemento.categories.map((c) => c.categoryId),
            categoriaPrincipalId: principal?.categoryId ?? '',
          }}
          categorias={categorias}
          elementos={todosElementos}
          slugBloqueado={referenciado}
        />

        <aside className="space-y-4 text-sm">
          <div className="rounded-lg mist-card p-4">
            <h2 className="etiqueta">Secuencia vinculada</h2>
            {elemento.sequence ? (
              <p className="text-parchment">
                {elemento.sequence.pathway.name} · Secuencia {elemento.sequence.number}:{' '}
                {elemento.sequence.name}
              </p>
            ) : (
              <p className="text-fog">Ninguna.</p>
            )}
            <Link href="/admin/caminos" className="mt-1 inline-block text-brass underline">
              Gestionar en Caminos →
            </Link>
          </div>

          <div className="rounded-lg mist-card p-4">
            <h2 className="etiqueta">Recetas que lo producen</h2>
            {elemento.outputs.length === 0 && <p className="text-fog">Ninguna.</p>}
            <ul className="space-y-3">
              {elemento.outputs.map((o) => {
                const ingredientes = o.recipe.ingredients.map((i) => ({
                  elementId: i.elementId,
                  quantity: i.quantity,
                }))
                const outputs = o.recipe.outputs.map((ro) => ({
                  elementId: ro.elementId,
                  quantity: ro.quantity,
                  chance: ro.chance,
                  sortOrder: ro.sortOrder,
                }))
                return (
                  <li key={o.id} className="rounded-md border border-line p-3">
                    <details className="group">
                      <summary className="cursor-pointer list-none text-parchment hover:text-brass">
                        <span className="text-brass underline">
                          {o.recipe.ingredients.map((i) => `${i.element.name} × ${i.quantity}`).join(' + ')}
                        </span>
                        <span className="ml-2 text-xs text-fog">— clic para editar</span>
                      </summary>
                      <div className="mt-3">
                        <ConstructorReceta
                          elementos={todosElementos}
                          receta={{
                            id: o.recipeId,
                            name: o.recipe.name ?? '',
                            outputs,
                            successText: o.recipe.successText ?? '',
                            hintText: o.recipe.hintText ?? '',
                            isActive: o.recipe.isActive,
                            ingredientes,
                          }}
                          ingredientesIniciales={[]}
                          caminos={caminos}
                          categorias={categorias}
                        />
                      </div>
                    </details>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="rounded-lg mist-card p-4">
            <h2 className="etiqueta">Recetas donde participa como ingrediente</h2>
            {elemento.usedIn.length === 0 && <p className="text-fog">Ninguna.</p>}
            <ul className="space-y-1">
              {elemento.usedIn.map((i) => {
                const outputNames = i.recipe.outputs.map((o) => o.element.name).join(', ')
                return (
                  <li key={i.id}>
                    <Link href={`/admin/recetas/${i.recipeId}`} className="text-brass underline">
                      → produce {outputNames}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {referenciado && (
            <p className="rounded-lg border border-line p-3 text-xs text-fog">
              Este elemento está referenciado por recetas, secuencias o progreso
              de jugadores: su slug es inmutable y no puede eliminarse
              físicamente, solo desactivarse.
            </p>
          )}

          {!elemento.isStarter && (
            <BotonEliminar
              action={eliminarElemento.bind(null, elemento.id)}
              confirmacion="¿Eliminar este elemento? También se eliminarán las recetas donde participa. Esta acción no se puede deshacer."
              className="w-full rounded-md border border-wine/30 bg-wine/10 px-3 py-2 text-sm text-wine hover:bg-wine/20"
            >
              Eliminar elemento
            </BotonEliminar>
          )}
        </aside>
      </div>
    </div>
  )
}
