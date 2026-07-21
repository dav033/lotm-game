import { NextResponse } from 'next/server'
import { haySesionAdmin } from '@/server/adminAuth'
import {
  buscarNodos,
  construirGrafo,
  datosIniciales,
  espinaCamino,
  grafoCamino,
  vecinosDeNodo,
} from '@/server/services/arbolGrafo'
import { prisma } from '@/server/db'
import { cargarVistaFases } from '@/server/services/fasesProgresion'

export const runtime = 'nodejs'

// Subgrafos del árbol de habilidades bajo demanda (requiere sesión admin):
//   ?vista=inicial                 → elementos iniciales + leyenda + totales
//   ?vista=vecinos&id=el:...       → combinaciones que tocan un nodo
//   ?vista=camino-grafo&indice=N   → esqueleto de un camino para el explorador
//   ?vista=espina&id=<pathwayId>   → espina estructurada para la vista de camino
//   ?vista=buscar&q=texto          → nodos por nombre
//   ?vista=completo                → grafo entero (solo lo pide el mapa completo)
//   ?vista=fases                  → fases y grafo completo para su mapa editable
export async function GET(req: Request) {
  if (!(await haySesionAdmin())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const vista = searchParams.get('vista')
  if (!vista) {
    return NextResponse.json({ error: 'Falta el parámetro vista.' }, { status: 400 })
  }
  try {
    switch (vista) {
      case 'completo':
        return NextResponse.json(await construirGrafo())
      case 'inicial':
        return NextResponse.json(await datosIniciales())
      case 'fases': {
        const [fases, grafo] = await Promise.all([
          cargarVistaFases(prisma),
          construirGrafo(),
        ])
        return NextResponse.json({ fases, grafo })
      }
      case 'vecinos': {
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'Falta el parámetro id.' }, { status: 400 })
        return NextResponse.json(await vecinosDeNodo(id))
      }
      case 'camino-grafo': {
        const indiceParam = searchParams.get('indice')
        const indice = Number(indiceParam)
        if (indiceParam === null || !Number.isInteger(indice) || indice < 0) {
          return NextResponse.json({ error: 'Índice de camino inválido.' }, { status: 400 })
        }
        return NextResponse.json(await grafoCamino(indice))
      }
      case 'espina': {
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'Falta el parámetro id.' }, { status: 400 })
        const espina = await espinaCamino(id)
        if (!espina) return NextResponse.json({ error: 'Camino no encontrado.' }, { status: 404 })
        return NextResponse.json(espina)
      }
      case 'buscar': {
        const consulta = (searchParams.get('q') ?? '').slice(0, 80)
        return NextResponse.json(await buscarNodos(consulta))
      }
      default:
        return NextResponse.json({ error: `Vista desconocida: ${vista}.` }, { status: 400 })
    }
  } catch (err) {
    console.error('[api/admin/arbol]', err)
    return NextResponse.json({ error: 'No se pudo construir el árbol.' }, { status: 500 })
  }
}
