import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { cargarAnalisisProgresion } from '@/server/services/progresion'
import { colorDificultad } from '@/components/admin/dificultad'
import {
  detectarCiclos,
  DIFICULTAD_LABELS,
  DIFICULTAD_ORDEN,
  elementosInalcanzables,
  elementosSinUso,
  etiquetaRuta,
  recetasDuplicadas,
  ritualesConSecuenciaOrigenInconsistente,
  resumenParticipacion,
  type DiagElementResult,
} from '@/server/domain/diagnostico'
import {
  EXPLOSION_REGRESSION_SLUGS,
  PHASE1_CLOSURE_SLUGS,
  PHASE2_CLOSURE_SLUGS,
  PHASE3_CLOSURE_SLUGS,
} from '../../../../../prisma/seed-content/progression'

export const runtime = 'nodejs'

export default async function PaginaDiagnostico() {
  await exigirAdminPagina()

  const {
    analisis,
    elementos,
    recetas,
    desencadenantes,
    elementosDiag,
    recetasDiag,
    secuenciasDiag,
    avancesDiag,
    ritualesDiag,
  } = await cargarAnalisisProgresion(prisma)

  const nombreDe = new Map(elementos.map((e) => [e.id, e.name]))

  const inalcanzables = elementosInalcanzables(
    elementosDiag,
    recetasDiag,
    secuenciasDiag,
    avancesDiag,
    desencadenantes,
  )
  const duplicadas = recetasDuplicadas(recetasDiag)
  const ritualesInconsistentes = ritualesConSecuenciaOrigenInconsistente(
    ritualesDiag,
    avancesDiag,
    secuenciasDiag,
  )
  const ciclos = detectarCiclos(recetasDiag)
  const sinUso = elementosSinUso(
    elementosDiag,
    recetasDiag,
    secuenciasDiag,
    avancesDiag,
    ritualesDiag,
    desencadenantes,
  )

  const idPorSlug = new Map(elementos.map((e) => [e.slug, e.id]))
  const auditoriaFase = (slugs: readonly string[]) => {
    const faltantes = slugs.filter((slug) => {
      const id = idPorSlug.get(slug)
      return id == null || !(analisis.get(id)?.reachable ?? false)
    })
    return { total: slugs.length, alcanzados: slugs.length - faltantes.length, faltantes }
  }
  const fase1 = auditoriaFase(PHASE1_CLOSURE_SLUGS)
  const fase2 = auditoriaFase(PHASE2_CLOSURE_SLUGS)
  const fase3 = auditoriaFase(PHASE3_CLOSURE_SLUGS)
  const fugasDeExplosion = EXPLOSION_REGRESSION_SLUGS.filter((slug) => {
    const id = idPorSlug.get(slug)
    return id != null && (analisis.get(id)?.reachable ?? false)
  })

  const referenciasInactivas = recetas.filter(
    (r) =>
      r.isActive &&
      (r.outputs.some((o) => !o.element.isActive) ||
        r.ingredients.some((i) => !i.element.isActive) ||
        r.outputs.some((o) => o.element.sequence && !o.element.sequence.pathway.isActive)),
  )

  const filas = elementos
    .filter((e) => e.isActive)
    .map((e) => ({ elemento: e, res: analisis.get(e.id)! }))
    .sort(compararFilas)

  const Seccion = ({
    titulo,
    vacio,
    children,
    alerta,
  }: {
    titulo: string
    vacio: boolean
    children: React.ReactNode
    alerta?: boolean
  }) => (
    <section className="rounded-lg mist-card p-4">
      <h2
        className={`font-[family-name:var(--font-display)] text-lg ${
          vacio ? 'text-parchment' : alerta ? 'text-wine' : 'text-brass'
        }`}
      >
        {titulo} {vacio ? '· sin hallazgos ✓' : ''}
      </h2>
      {!vacio && <div className="mt-2 text-sm">{children}</div>}
    </section>
  )

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Diagnóstico del árbol de combinaciones
      </h1>
      <p className="mb-4 text-sm text-fog">
        Revisiones automáticas para detectar contenido roto o huérfano antes de
        que un jugador lo encuentre.
      </p>

      <div className="space-y-4">
        <Seccion
          titulo="Auditoría de fases (1-3)"
          vacio={fase1.faltantes.length === 0 && fase2.faltantes.length === 0 && fase3.faltantes.length === 0 && fugasDeExplosion.length === 0}
          alerta
        >
          <ul className="mb-2 space-y-1 text-parchment">
            <li>Fase 1: {fase1.alcanzados}/{fase1.total}</li>
            <li>Fase 2: {fase2.alcanzados}/{fase2.total}</li>
            <li>Fase 3: {fase3.alcanzados}/{fase3.total}</li>
          </ul>
          {[
            ['Fase 1', fase1.faltantes],
            ['Fase 2', fase2.faltantes],
            ['Fase 3', fase3.faltantes],
          ].map(([etiqueta, faltantes]) =>
            faltantes.length > 0 ? (
              <p key={etiqueta as string} className="text-wine">
                {etiqueta} — esperados y no alcanzables: {(faltantes as string[]).join(', ')}
              </p>
            ) : null,
          )}
          {fugasDeExplosion.length > 0 && (
            <p className="text-wine">
              Fuga de contenido reservado (no debería ser alcanzable en fases 1-3):{' '}
              {fugasDeExplosion.join(', ')}
            </p>
          )}
        </Seccion>

        <Seccion titulo="Elementos inalcanzables" vacio={inalcanzables.length === 0} alerta>
          <p className="mb-2 text-fog">
            Elementos activos que no se pueden obtener desde los iniciales
            usando recetas, ascensiones, rituales o desbloqueos espontáneos:
          </p>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {inalcanzables.map((e) => (
              <li key={e.id}>
                {e.name} <code className="text-xs text-fog">({e.slug})</code>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Recetas duplicadas" vacio={duplicadas.size === 0} alerta>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {[...duplicadas.entries()].map(([key, lista]) => (
              <li key={key}>
                <code className="text-xs">{key}</code> — {lista.length} recetas comparten esta clave.
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion
          titulo="Rituales con secuencia de origen inconsistente"
          vacio={ritualesInconsistentes.length === 0}
          alerta
        >
          <p className="mb-2 text-fog">
            El número configurado debe coincidir con la secuencia origen del avance protegido.
          </p>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {ritualesInconsistentes.map((ritual) => (
              <li key={ritual.ritualId}>
                {ritual.ritualName}: configurado {ritual.requiredSequenceNumber}, origen{' '}
                {ritual.sourceSequenceNumber ?? 'inexistente'}.
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Recetas con referencias inactivas" vacio={referenciasInactivas.length === 0} alerta>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {referenciasInactivas.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/recetas/${r.id}`} className="text-brass underline">
                  <code className="text-xs">{r.inputKey}</code>
                </Link>{' '}
                — {r.outputs.some((o) => !o.element.isActive) && 'produce un elemento desactivado. '}
                {r.ingredients.some((i) => !i.element.isActive) && 'usa ingredientes desactivados. '}
                {r.outputs.some((o) => o.element.sequence && !o.element.sequence.pathway.isActive) &&
                  'vinculada a un camino desactivado.'}
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Ciclos (advertencia, pueden ser intencionales)" vacio={ciclos.length === 0}>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {ciclos.map((ciclo, i) => (
              <li key={i}>{ciclo.map((id) => nombreDe.get(id) ?? id).join(' → ')}</li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Elementos sin uso" vacio={sinUso.length === 0}>
          <p className="mb-2 text-fog">
            No son iniciales, no aparecen en recetas, avances, rituales,
            desbloqueos ni representan una secuencia:
          </p>
          <ul className="list-inside list-disc space-y-1 text-parchment">
            {sinUso.map((e) => (
              <li key={e.id}>
                {e.name} <code className="text-xs text-fog">({e.slug})</code>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Progresión completa" vacio={filas.length === 0}>
          <p className="mb-4 text-fog">
            Métricas estimadas del árbol activo. La <strong>profundidad</strong> es
            el número de pasos de la ruta más corta; las{' '}
            <strong>combinaciones</strong> son una estimación mínima de operaciones
            de combinación (receta +1, crear avance +1, aplicarlo +1; ritual +0).
            Las <strong>rutas</strong> cuentan recetas o avances/rituales válidos.
            La <strong>participación</strong> resume en cuántas recetas (R),
            avances (A), rituales (Ri) y desbloqueos (D) interviene cada elemento.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-fog/30 text-fog">
                  <th className="pb-2 pr-4">Elemento</th>
                  <th className="pb-2 pr-4">Vía</th>
                  <th className="pb-2 pr-4">Profundidad</th>
                  <th className="pb-2 pr-4">Combinaciones</th>
                  <th className="pb-2 pr-4">Rutas</th>
                  <th className="pb-2 pr-4">Participación</th>
                  <th className="pb-2">Dificultad</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ elemento, res }) => (
                  <tr
                    key={elemento.id}
                    className={`border-b border-fog/10 ${
                      !res.reachable ? 'opacity-70' : ''
                    }`}
                  >
                    <td className="py-2 pr-4 text-parchment">
                      {elemento.name}{' '}
                      <code className="text-xs text-fog">({elemento.slug})</code>
                    </td>
                    <td className="py-2 pr-4 text-parchment">
                      {etiquetaRuta(res.bestRoute)}
                    </td>
                    <td className="py-2 pr-4 text-fog">
                      {res.depth == null ? '—' : res.depth}
                    </td>
                    <td className="py-2 pr-4 text-fog">
                      {res.cost == null ? '—' : res.cost}
                    </td>
                    <td className="py-2 pr-4 text-fog">{res.routeSummary}</td>
                    <td className="py-2 pr-4 text-fog">
                      <span title={tooltipParticipacion(res.participation)}>
                        {resumenParticipacion(res.participation)}
                      </span>
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${colorDificultad(
                          res.difficulty,
                        )}`}
                      >
                        {DIFICULTAD_LABELS[res.difficulty]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      </div>
    </div>
  )
}

function compararFilas(
  a: { elemento: { name: string }; res: DiagElementResult },
  b: { elemento: { name: string }; res: DiagElementResult },
): number {
  if (a.res.reachable !== b.res.reachable) return a.res.reachable ? 1 : -1
  const ordenA = DIFICULTAD_ORDEN[a.res.difficulty]
  const ordenB = DIFICULTAD_ORDEN[b.res.difficulty]
  if (ordenA !== ordenB) return ordenB - ordenA
  const costoA = a.res.cost ?? -1
  const costoB = b.res.cost ?? -1
  if (costoA !== costoB) return costoB - costoA
  return a.elemento.name.localeCompare(b.elemento.name, 'es')
}

function tooltipParticipacion(p: DiagElementResult['participation']): string {
  return `Recetas: ${p.recipes}, Avances: ${p.advances}, Rituales: ${p.rituals}, Desbloqueos: ${p.spontaneous}`
}
