// Construcción del grafo del árbol de habilidades y sus rebanadas bajo
// demanda: el explorador pide vecindarios y espinas en lugar de recibir el
// contenido completo, así la página no crece con el volumen del juego.

import { prisma } from '@/server/db'
import { etiquetaTipo } from '@/server/domain/tipos'
import {
  agruparCombinaciones,
  normalizarTexto,
  type AristaArbol,
  type CaminoLeyenda,
  type NodoArbol,
} from '@/components/admin/arbol/tipos'

export type GrafoArbol = {
  nodos: NodoArbol[]
  aristas: AristaArbol[]
  caminos: CaminoLeyenda[]
}

// Grafo completo: elementos, secuencias, avances, rituales y todas las
// relaciones (recetas, ascensiones, desbloqueos espontáneos, fallos). Los
// grados por nodo cuentan combinaciones (no aristas sueltas): es lo que el
// explorador revela al expandir.
export async function construirGrafo(): Promise<GrafoArbol> {
  const [elementos, recetas, avances, rituales, caminos] = await Promise.all([
    prisma.element.findMany({
      include: {
        sequence: { include: { pathway: true } },
        unlockTriggers: { select: { triggerId: true } },
        unlockRequirements: { select: { requiredElementId: true } },
      },
    }),
    prisma.recipe.findMany({
      include: {
        ingredients: { include: { element: { select: { id: true, name: true } } } },
        outputs: { include: { element: { select: { id: true } } } },
      },
    }),
    prisma.advance.findMany({
      include: {
        ingredients: { include: { element: { select: { id: true, name: true } } } },
        sourceSequence: { include: { pathway: true } },
        targetSequence: { include: { pathway: true } },
      },
    }),
    prisma.ritual.findMany({
      include: {
        ingredients: { include: { element: { select: { id: true, name: true } } } },
        failureOutputs: { select: { elementId: true } },
        advance: { select: { targetSequence: { select: { pathwayId: true } } } },
      },
    }),
    prisma.pathway.findMany({ orderBy: { createdAt: 'asc' } }),
  ])

  // El índice del camino decide su color en el cliente; orden estable por
  // fecha de creación para que no cambie al renombrar.
  const indiceCamino = new Map(caminos.map((camino, index) => [camino.id, index]))
  const leyenda: CaminoLeyenda[] = caminos.map((camino, index) => ({
    id: camino.id,
    nombre: camino.name,
    index,
  }))
  const nombreElemento = new Map(elementos.map((el) => [el.id, el.name]))

  const nodos: NodoArbol[] = []
  const aristas: AristaArbol[] = []

  for (const el of elementos) {
    // Condiciones de desbloqueo sin elemento origen concreto: se describen en
    // el panel de detalle porque no pueden dibujarse como arista.
    const condiciones: string[] = []
    if (el.unlockedByType !== null) {
      condiciones.push(`al descubrir cualquier elemento de tipo ${etiquetaTipo(el.unlockedByType)}`)
    }
    if (el.unlockedBySequenceNumber !== null) {
      condiciones.push(`al alcanzar la secuencia ${el.unlockedBySequenceNumber} de cualquier camino`)
    }
    if (el.unlockedAtDiscoveryCount !== null) {
      condiciones.push(`al tener al menos ${el.unlockedAtDiscoveryCount} elementos activos descubiertos`)
    }

    nodos.push({
      id: `el:${el.id}`,
      nombre: el.name,
      clase: el.sequence ? 'secuencia' : 'elemento',
      tipo: etiquetaTipo(el.type),
      tier: el.tier,
      caminoIndex: el.sequence ? (indiceCamino.get(el.sequence.pathwayId) ?? null) : null,
      secuencia: el.sequence?.number ?? null,
      inicial: el.isStarter,
      activo: el.isActive,
      espontaneo:
        condiciones.length > 0 || el.unlockTriggers.length > 0 || el.unlockRequirements.length > 0,
      iconKey: el.iconKey,
      descripcion: el.description,
      desbloqueo: condiciones.length > 0 ? `Se desbloquea ${condiciones.join(' y ')}.` : null,
    })

    // Desbloqueo espontáneo OR: descubrir cualquiera de los desencadenantes
    // revela este elemento. Cada arista es independiente (no convergen).
    for (const desencadenante of el.unlockTriggers) {
      aristas.push({
        de: `el:${desencadenante.triggerId}`,
        a: `el:${el.id}`,
        tipo: 'desbloqueo',
        via: `Descubrir ${nombreElemento.get(desencadenante.triggerId) ?? '?'} revela ${el.name}`,
      })
    }

    // Requisitos AND: hace falta descubrir TODOS; convergen como una receta.
    if (el.unlockRequirements.length > 0) {
      const nombres = el.unlockRequirements
        .map((req) => nombreElemento.get(req.requiredElementId) ?? '?')
        .join(' + ')
      for (const req of el.unlockRequirements) {
        aristas.push({
          de: `el:${req.requiredElementId}`,
          a: `el:${el.id}`,
          tipo: 'requisito-conjunto',
          via: `Requiere descubrir ${nombres}`,
          grupo: `req:${el.id}`,
        })
      }
    }
  }

  for (const receta of recetas) {
    const via =
      receta.name ??
      receta.ingredients
        .map((i) => (i.quantity > 1 ? `${i.element.name} × ${i.quantity}` : i.element.name))
        .join(' + ')
    for (const ingrediente of receta.ingredients) {
      for (const salida of receta.outputs) {
        aristas.push({
          de: `el:${ingrediente.elementId}`,
          a: `el:${salida.elementId}`,
          tipo: 'receta',
          via,
          // Todas las aristas de la receta comparten grupo: el cliente las
          // dibuja convergiendo en un punto de unión en lugar de sueltas.
          grupo: `rec:${receta.id}`,
        })
      }
    }
  }

  for (const avance of avances) {
    const idAvance = `av:${avance.id}`
    nodos.push({
      id: idAvance,
      nombre: avance.internalName,
      clase: 'avance',
      tipo: 'Avance',
      tier: 0,
      caminoIndex: indiceCamino.get(avance.targetSequence.pathwayId) ?? null,
      secuencia: null,
      inicial: false,
      activo: avance.isActive,
      espontaneo: false,
      iconKey: null,
      descripcion: `Asciende de la secuencia ${avance.sourceSequence.number} a la ${avance.targetSequence.number} de ${avance.targetSequence.pathway.name}.`,
      desbloqueo: null,
    })
    const viaIngredientes = avance.ingredients
      .map((i) => (i.quantity > 1 ? `${i.element.name} × ${i.quantity}` : i.element.name))
      .join(' + ')
    for (const ingrediente of avance.ingredients) {
      aristas.push({
        de: `el:${ingrediente.elementId}`,
        a: idAvance,
        tipo: 'creacion',
        via: viaIngredientes,
        grupo: `crear-av:${avance.id}`,
      })
    }
    // La secuencia origen se combina con el avance; el resultado es la destino.
    aristas.push({
      de: `el:${avance.sourceSequence.elementId}`,
      a: `el:${avance.targetSequence.elementId}`,
      tipo: 'ascension',
      via: `${avance.sourceSequence.pathway.name} · Secuencia ${avance.sourceSequence.number} + ${avance.internalName}`,
      grupo: `asc:${avance.id}`,
    })
    aristas.push({
      de: idAvance,
      a: `el:${avance.targetSequence.elementId}`,
      tipo: 'ascension',
      via: `${avance.targetSequence.pathway.name} · Secuencia ${avance.targetSequence.number}`,
      grupo: `asc:${avance.id}`,
    })
  }

  for (const ritual of rituales) {
    const idRitual = `rit:${ritual.id}`
    nodos.push({
      id: idRitual,
      nombre: ritual.name,
      clase: 'ritual',
      tipo: 'Ritual',
      tier: 0,
      // Hereda el camino del avance que protege: así se agrupa y colorea junto a él.
      caminoIndex: indiceCamino.get(ritual.advance.targetSequence.pathwayId) ?? null,
      secuencia: null,
      inicial: false,
      activo: ritual.isActive,
      espontaneo: false,
      iconKey: null,
      descripcion: `Exige haber alcanzado la secuencia ${ritual.requiredSequenceNumber} para intentarse.`,
      desbloqueo: null,
    })
    for (const ingrediente of ritual.ingredients) {
      aristas.push({
        de: `el:${ingrediente.elementId}`,
        a: idRitual,
        tipo: 'ritual',
        via: ritual.name,
        grupo: `crear-rit:${ritual.id}`,
      })
    }
    aristas.push({
      de: idRitual,
      a: `av:${ritual.advanceId}`,
      tipo: 'ritual',
      via: 'Requisito para sobrevivir al avance',
    })
    // Consecuencias de fallar el ritual: elementos que aparecen como castigo.
    for (const fallo of ritual.failureOutputs) {
      aristas.push({
        de: idRitual,
        a: `el:${fallo.elementId}`,
        tipo: 'fallo',
        via: `Fallar «${ritual.name}»`,
      })
    }
  }

  // Grados por combinación: cuántas combinaciones entran/salen de cada nodo.
  const gradoEntrada = new Map<string, number>()
  const gradoSalida = new Map<string, number>()
  for (const combo of agruparCombinaciones(aristas)) {
    for (const de of combo.entradas) gradoSalida.set(de, (gradoSalida.get(de) ?? 0) + 1)
    for (const a of combo.salidas) gradoEntrada.set(a, (gradoEntrada.get(a) ?? 0) + 1)
  }
  for (const nodo of nodos) {
    nodo.gradoEntrada = gradoEntrada.get(nodo.id) ?? 0
    nodo.gradoSalida = gradoSalida.get(nodo.id) ?? 0
  }

  return { nodos, aristas, caminos: leyenda }
}

// Carga inicial del explorador: solo los elementos iniciales y la leyenda.
export async function datosIniciales() {
  const { nodos, aristas, caminos } = await construirGrafo()
  return {
    nodos: nodos.filter((n) => n.inicial),
    caminos,
    totales: { nodos: nodos.length, aristas: aristas.length },
  }
}

// Vecindario de un nodo: todas las combinaciones que lo tocan, completas
// (con sus coingredientes), más los nodos participantes.
export async function vecinosDeNodo(id: string) {
  const { nodos, aristas } = await construirGrafo()
  const porGrupo = new Map<string, AristaArbol[]>()
  const sueltas: AristaArbol[] = []
  for (const arista of aristas) {
    if (arista.grupo) {
      porGrupo.set(arista.grupo, [...(porGrupo.get(arista.grupo) ?? []), arista])
    } else {
      sueltas.push(arista)
    }
  }
  const incluidas: AristaArbol[] = []
  for (const grupo of porGrupo.values()) {
    if (grupo.some((a) => a.de === id || a.a === id)) incluidas.push(...grupo)
  }
  for (const arista of sueltas) {
    if (arista.de === id || arista.a === id) incluidas.push(arista)
  }
  const participantes = new Set<string>([id])
  for (const arista of incluidas) {
    participantes.add(arista.de)
    participantes.add(arista.a)
  }
  return {
    nodos: nodos.filter((n) => participantes.has(n.id)),
    aristas: incluidas,
  }
}

// Esqueleto estructural de un camino para añadirlo al explorador: sus
// secuencias, avances y rituales con las aristas internas entre ellos.
export async function grafoCamino(indice: number) {
  const { nodos, aristas } = await construirGrafo()
  const ids = new Set(nodos.filter((n) => n.caminoIndex === indice).map((n) => n.id))
  const porGrupo = new Map<string, AristaArbol[]>()
  const sueltas: AristaArbol[] = []
  for (const arista of aristas) {
    if (arista.grupo) {
      porGrupo.set(arista.grupo, [...(porGrupo.get(arista.grupo) ?? []), arista])
    } else {
      sueltas.push(arista)
    }
  }
  const internas: AristaArbol[] = []
  for (const grupo of porGrupo.values()) {
    if (grupo.every((a) => ids.has(a.de) && ids.has(a.a))) internas.push(...grupo)
  }
  for (const arista of sueltas) {
    if (ids.has(arista.de) && ids.has(arista.a)) internas.push(arista)
  }
  return {
    nodos: nodos.filter((n) => ids.has(n.id)),
    aristas: internas,
  }
}

// Búsqueda por nombre para añadir nodos al explorador.
export async function buscarNodos(consulta: string) {
  const q = normalizarTexto(consulta.trim())
  if (q.length < 2) return { nodos: [] as NodoArbol[] }
  // La búsqueda solo necesita nodos: cargar recetas, ingredientes y construir
  // más de mil aristas en cada pulsación era trabajo desperdiciado.
  const [caminos, elementos, avances, rituales] = await Promise.all([
    prisma.pathway.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true } }),
    prisma.element.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        tier: true,
        isStarter: true,
        isActive: true,
        iconKey: true,
        description: true,
        unlockedByType: true,
        unlockedBySequenceNumber: true,
        unlockedAtDiscoveryCount: true,
        sequence: { select: { number: true, pathwayId: true } },
      },
    }),
    prisma.advance.findMany({
      select: {
        id: true,
        internalName: true,
        isActive: true,
        targetSequence: { select: { pathwayId: true } },
      },
    }),
    prisma.ritual.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        requiredSequenceNumber: true,
        advance: { select: { targetSequence: { select: { pathwayId: true } } } },
      },
    }),
  ])
  const indiceCamino = new Map(caminos.map((camino, index) => [camino.id, index]))
  const nodos: NodoArbol[] = elementos.map((el) => {
    const condiciones: string[] = []
    if (el.unlockedByType !== null) {
      condiciones.push(`al descubrir cualquier elemento de tipo ${etiquetaTipo(el.unlockedByType)}`)
    }
    if (el.unlockedBySequenceNumber !== null) {
      condiciones.push(`al alcanzar la secuencia ${el.unlockedBySequenceNumber} de cualquier camino`)
    }
    if (el.unlockedAtDiscoveryCount !== null) {
      condiciones.push(`al tener al menos ${el.unlockedAtDiscoveryCount} elementos activos descubiertos`)
    }
    return {
      id: `el:${el.id}`,
      nombre: el.name,
      clase: el.sequence ? 'secuencia' : 'elemento',
      tipo: etiquetaTipo(el.type),
      tier: el.tier,
      caminoIndex: el.sequence ? (indiceCamino.get(el.sequence.pathwayId) ?? null) : null,
      secuencia: el.sequence?.number ?? null,
      inicial: el.isStarter,
      activo: el.isActive,
      espontaneo: condiciones.length > 0,
      iconKey: el.iconKey,
      descripcion: el.description,
      desbloqueo: condiciones.length > 0 ? `Se desbloquea ${condiciones.join(' y ')}.` : null,
    }
  })
  for (const avance of avances) {
    nodos.push({
      id: `av:${avance.id}`,
      nombre: avance.internalName,
      clase: 'avance',
      tipo: 'Avance',
      tier: 0,
      caminoIndex: indiceCamino.get(avance.targetSequence.pathwayId) ?? null,
      secuencia: null,
      inicial: false,
      activo: avance.isActive,
      espontaneo: false,
      iconKey: null,
      descripcion: '',
      desbloqueo: null,
    })
  }
  for (const ritual of rituales) {
    nodos.push({
      id: `rit:${ritual.id}`,
      nombre: ritual.name,
      clase: 'ritual',
      tipo: 'Ritual',
      tier: 0,
      caminoIndex: indiceCamino.get(ritual.advance.targetSequence.pathwayId) ?? null,
      secuencia: null,
      inicial: false,
      activo: ritual.isActive,
      espontaneo: false,
      iconKey: null,
      descripcion: `Exige haber alcanzado la secuencia ${ritual.requiredSequenceNumber} para intentarse.`,
      desbloqueo: null,
    })
  }
  const coincide = nodos.filter((n) => normalizarTexto(n.nombre).includes(q))
  coincide.sort((a, b) => {
    const aEmpieza = normalizarTexto(a.nombre).startsWith(q) ? 0 : 1
    const bEmpieza = normalizarTexto(b.nombre).startsWith(q) ? 0 : 1
    return aEmpieza - bEmpieza || a.nombre.localeCompare(b.nombre, 'es')
  })
  return { nodos: coincide.slice(0, 12) }
}

// ---------- Espina de camino (vista estructurada en HTML) ----------

export type EspinaSecuencia = {
  numero: number
  nombre: string
  descripcion: string | null
  elementoId: string
  elementoNombre: string
  elementoDescripcion: string
  iconKey: string
  tipo: string
  activo: boolean
  recetas: string[]
  desbloqueos: string[]
  usadoEnRecetas: number
}

export type EspinaRitual = {
  nombre: string
  exigeSecuencia: number
  ingredientes: string
  fallos: string[]
  activo: boolean
}

export type EspinaAvance = {
  nombre: string
  deNumero: number
  aNumero: number
  ingredientes: string
  activo: boolean
  rituales: EspinaRitual[]
}

export type EspinaCamino = {
  camino: { id: string; nombre: string; descripcion: string; index: number }
  secuencias: EspinaSecuencia[]
  avances: EspinaAvance[]
}

function nombresIngredientes(
  ingredientes: { quantity: number; element: { name: string } }[],
): string {
  return ingredientes
    .map((i) => (i.quantity > 1 ? `${i.element.name} × ${i.quantity}` : i.element.name))
    .join(' + ')
}

export async function espinaCamino(pathwayId: string): Promise<EspinaCamino | null> {
  const [camino, todos] = await Promise.all([
    prisma.pathway.findUnique({ where: { id: pathwayId } }),
    prisma.pathway.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true } }),
  ])
  if (!camino) return null
  const index = todos.findIndex((p) => p.id === pathwayId)

  const [secuencias, avances] = await Promise.all([
    prisma.sequence.findMany({
      where: { pathwayId },
      orderBy: { number: 'desc' },
      include: {
        element: {
          include: {
            outputs: {
              include: {
                recipe: {
                  include: {
                    ingredients: { include: { element: { select: { name: true } } } },
                  },
                },
              },
            },
            unlockTriggers: { include: { trigger: { select: { name: true } } } },
            unlockRequirements: { include: { required: { select: { name: true } } } },
            _count: { select: { usedIn: true } },
          },
        },
      },
    }),
    prisma.advance.findMany({
      where: { targetSequence: { pathwayId } },
      include: {
        ingredients: { include: { element: { select: { name: true } } } },
        sourceSequence: { select: { number: true } },
        targetSequence: { select: { number: true } },
        rituals: {
          include: {
            ingredients: { include: { element: { select: { name: true } } } },
            failureOutputs: { include: { element: { select: { name: true } } } },
          },
        },
      },
    }),
  ])

  return {
    camino: {
      id: camino.id,
      nombre: camino.name,
      descripcion: camino.description,
      index,
    },
    secuencias: secuencias.map((secuencia) => {
      const el = secuencia.element
      const desbloqueos: string[] = []
      if (el.unlockedByType !== null) {
        desbloqueos.push(`Al descubrir cualquier elemento de tipo ${etiquetaTipo(el.unlockedByType)}`)
      }
      if (el.unlockedBySequenceNumber !== null) {
        desbloqueos.push(`Al alcanzar la secuencia ${el.unlockedBySequenceNumber} de cualquier camino`)
      }
      if (el.unlockedAtDiscoveryCount !== null) {
        desbloqueos.push(`Al tener al menos ${el.unlockedAtDiscoveryCount} elementos activos descubiertos`)
      }
      for (const t of el.unlockTriggers) desbloqueos.push(`Al descubrir ${t.trigger.name}`)
      if (el.unlockRequirements.length > 0) {
        desbloqueos.push(
          `Tras descubrir todos: ${el.unlockRequirements.map((r) => r.required.name).join(' + ')}`,
        )
      }
      return {
        numero: secuencia.number,
        nombre: secuencia.name,
        descripcion: secuencia.description,
        elementoId: `el:${el.id}`,
        elementoNombre: el.name,
        elementoDescripcion: el.description,
        iconKey: el.iconKey,
        tipo: etiquetaTipo(el.type),
        activo: el.isActive,
        recetas: el.outputs.map(
          (salida) => salida.recipe.name ?? nombresIngredientes(salida.recipe.ingredients),
        ),
        desbloqueos,
        usadoEnRecetas: el._count.usedIn,
      }
    }),
    avances: avances.map((avance) => ({
      nombre: avance.internalName,
      deNumero: avance.sourceSequence.number,
      aNumero: avance.targetSequence.number,
      ingredientes: nombresIngredientes(avance.ingredients),
      activo: avance.isActive,
      rituales: avance.rituals.map((ritual) => ({
        nombre: ritual.name,
        exigeSecuencia: ritual.requiredSequenceNumber,
        ingredientes: nombresIngredientes(ritual.ingredients),
        fallos: ritual.failureOutputs.map((f) => f.element.name),
        activo: ritual.isActive,
      })),
    })),
  }
}
