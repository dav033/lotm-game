import { exigirAdminPagina } from '@/server/adminAuth'
import { datosIniciales } from '@/server/services/arbolGrafo'
import { ArbolPestanas } from '@/components/admin/arbol/ArbolPestanas'
import { normalizarPestanaArbol } from '@/components/admin/arbol/pestanasArbol'

export const runtime = 'nodejs'

// Árbol de habilidades en cinco vistas: explorador expandible (por defecto),
// caminos, editor de fases, mapa por fases y mapa completo. La página solo embebe los elementos
// iniciales; el resto llega bajo demanda desde /api/admin/arbol, así el peso
// no crece con el contenido del juego.
export default async function PaginaArbolAdmin({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  await exigirAdminPagina()
  const params = await searchParams
  const pestanaInicial = normalizarPestanaArbol(params.tab)

  const { nodos, caminos, totales } = await datosIniciales()

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Árbol de habilidades
      </h1>
      <p className="mb-4 text-sm text-fog">
        {totales.nodos} habilidades y {totales.aristas} conexiones. Explora expandiendo desde los
        elementos iniciales, revisa cada camino como espina o abre el mapa completo.
      </p>
      <ArbolPestanas
        inicial={nodos}
        caminos={caminos}
        totales={totales}
        pestanaInicial={pestanaInicial}
      />
    </div>
  )
}
