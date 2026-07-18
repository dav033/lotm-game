// Tipos, constantes y helpers puros compartidos por todas las vistas del
// árbol de habilidades (explorador, espina de camino y mapa completo).
// Sin React ni dependencias de servidor: se importa desde ambos lados.

export type NodoArbol = {
  id: string
  nombre: string
  clase: 'elemento' | 'secuencia' | 'avance' | 'ritual'
  tipo: string | null
  tier: number
  caminoIndex: number | null
  secuencia: number | null
  inicial: boolean
  activo: boolean
  espontaneo: boolean
  iconKey: string | null
  descripcion: string
  desbloqueo: string | null
  // Número de combinaciones que entran/salen del nodo en el grafo completo.
  // Lo calcula el servidor; el explorador lo usa para los contadores ⊕.
  gradoEntrada?: number
  gradoSalida?: number
}

export type AristaArbol = {
  de: string
  a: string
  tipo:
    | 'receta'
    | 'creacion'
    | 'ascension'
    | 'requisito'
    | 'ritual'
    | 'desbloqueo'
    | 'requisito-conjunto'
    | 'fallo'
  via: string
  // Aristas con el mismo grupo forman una sola combinación (p. ej. los
  // ingredientes de una receta) y se dibujan convergiendo en un punto de unión.
  grupo?: string
}

export type CaminoLeyenda = { nombre: string; index: number; id?: string }

export type Combinacion = {
  id: string
  entradas: string[]
  salidas: string[]
  tipo: AristaArbol['tipo']
  via: string
}

export type ComponentesCaminos = {
  porCamino: Map<number, Set<string>>
  combinacionesPorCamino: Map<number, Set<Combinacion>>
  porNodo: Map<string, number[]>
  union: Set<string>
  interseccion: Set<string>
}

// Paleta categórica por camino sobre fondo oscuro. Se repite solo si el
// contenido supera diez caminos.
export const COLORES_CAMINO = [
  '#3f96c9',
  '#c2841f',
  '#c94f75',
  '#6fae5a',
  '#8d70c9',
  '#d06f43',
  '#4ba6a0',
  '#b8659d',
  '#8f9f42',
  '#6c8fd1',
]
export const COLOR_NEUTRO = '#57492f' // line2: nodos sin camino
export const COLOR_ARISTA_RECETA = '#7d6f57'
export const COLOR_DESBLOQUEO = '#c9a35c' // brass: revelaciones espontáneas
export const COLOR_FALLO = '#a34d5e' // vino claro: consecuencias de fallar un ritual
export const COLOR_INTERSECCION = '#f2d58a'
export const COLOR_DEPENDIENTE = '#77c7e8'
export const COLOR_RAIZ_DEPENDENCIA = '#f3d68d'
export const COLORES_NIVEL_DEPENDENCIA = ['#77d5ea', '#71bdf0', '#829ff0', '#9a89e8', '#b57edc']

export const NODO_W = 128
export const NODO_H = 104
export const PASO_X = 210
export const PASO_Y = 116
export const MARGEN = 40
export const CENTRO_X = NODO_W / 2
export const CENTRO_Y = 38
export const RADIO = 29

export const ETIQUETA_ARISTA: Record<AristaArbol['tipo'], string> = {
  receta: 'Receta',
  creacion: 'Crea el avance',
  ascension: 'Asciende a',
  requisito: 'Se combina con',
  ritual: 'Ritual',
  desbloqueo: 'Desbloqueo espontáneo',
  'requisito-conjunto': 'Desbloqueo conjunto',
  fallo: 'Consecuencia de fallo',
}

// Trazo por tipo de relación: grosor y patrón de guiones.
export const ESTILO_ARISTA: Record<AristaArbol['tipo'], { grosor: number; guiones?: string }> = {
  receta: { grosor: 1.1 },
  creacion: { grosor: 1.5, guiones: '6 4' },
  ascension: { grosor: 2.2 },
  requisito: { grosor: 1.5, guiones: '2 4' },
  ritual: { grosor: 1.8, guiones: '2 4' },
  desbloqueo: { grosor: 1.25, guiones: '1 5' },
  'requisito-conjunto': { grosor: 1.25, guiones: '1 5' },
  fallo: { grosor: 1.4, guiones: '5 3' },
}

// Orden de las conexiones en el panel de detalle: primero lo constructivo,
// después puertas y desbloqueos, al final los castigos.
export const ORDEN_PANEL: Record<AristaArbol['tipo'], number> = {
  receta: 0,
  creacion: 1,
  requisito: 2,
  ascension: 3,
  ritual: 4,
  desbloqueo: 5,
  'requisito-conjunto': 6,
  fallo: 7,
}

// Familias de relación para los filtros del explorador.
export type FamiliaArista = 'receta' | 'desbloqueo' | 'progresion' | 'fallo'
export const ETIQUETA_FAMILIA: Record<FamiliaArista, string> = {
  receta: 'Recetas',
  desbloqueo: 'Desbloqueos',
  progresion: 'Avances y rituales',
  fallo: 'Fallos de ritual',
}
export const FAMILIA_ARISTA: Record<AristaArbol['tipo'], FamiliaArista> = {
  receta: 'receta',
  desbloqueo: 'desbloqueo',
  'requisito-conjunto': 'desbloqueo',
  creacion: 'progresion',
  ascension: 'progresion',
  requisito: 'progresion',
  ritual: 'progresion',
  fallo: 'fallo',
}

export function colorDeCamino(index: number | null): string | null {
  return index !== null && index >= 0
    ? COLORES_CAMINO[index % COLORES_CAMINO.length]
    : null
}

export function colorDeNivelDependencia(nivel: number): string {
  return COLORES_NIVEL_DEPENDENCIA[Math.min(Math.max(nivel - 1, 0), COLORES_NIVEL_DEPENDENCIA.length - 1)]
}

export function recortar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto
}

export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Glifo de texto compacto (nodos fantasma y listados).
export function glifoTexto(nodo: NodoArbol): string {
  if (nodo.clase === 'secuencia') return String(nodo.secuencia)
  if (nodo.clase === 'avance') return '↑'
  if (nodo.clase === 'ritual') return '✦'
  if (nodo.inicial) return '★'
  return nodo.nombre.slice(0, 1).toUpperCase()
}

export function curva(x1: number, y1: number, x2: number, y2: number): string {
  const xm = x1 + (x2 - x1) / 2
  return `M ${x1} ${y1} C ${xm} ${y1}, ${xm} ${y2}, ${x2} ${y2}`
}

// Funde las aristas del mismo grupo (los ingredientes de una receta o un
// requisito conjunto) en una combinación; el resto queda como enlace directo.
export function agruparCombinaciones(aristas: AristaArbol[]): Combinacion[] {
  const porGrupo = new Map<string, Combinacion>()
  const sueltas: Combinacion[] = []
  const repeticiones = new Map<string, number>()
  for (const arista of aristas) {
    if (!arista.grupo) {
      const base = `arista:${claveArista(arista)}`
      const repeticion = repeticiones.get(base) ?? 0
      repeticiones.set(base, repeticion + 1)
      sueltas.push({
        id: `${base}:${repeticion}`,
        entradas: [arista.de],
        salidas: [arista.a],
        tipo: arista.tipo,
        via: arista.via,
      })
      continue
    }
    let combo = porGrupo.get(arista.grupo)
    if (!combo) {
      combo = { id: `grupo:${arista.grupo}`, entradas: [], salidas: [], tipo: arista.tipo, via: arista.via }
      porGrupo.set(arista.grupo, combo)
    }
    if (!combo.entradas.includes(arista.de)) combo.entradas.push(arista.de)
    if (!combo.salidas.includes(arista.a)) combo.salidas.push(arista.a)
  }
  return [...porGrupo.values(), ...sueltas]
}

// Recorre hacia atrás los requisitos de los caminos seleccionados. Las demás
// salidas de una receta multiproducto se incluyen como hojas, pero no se usan
// para continuar el recorrido y absorber ramas ajenas.
export function calcularComponentesCaminos(
  nodos: NodoArbol[],
  combinaciones: Combinacion[],
  caminosSeleccionados: number[],
): ComponentesCaminos {
  const porId = new Map(nodos.map((nodo) => [nodo.id, nodo]))
  const porSalida = new Map<string, Combinacion[]>()
  const porEntrada = new Map<string, Combinacion[]>()
  for (const combo of combinaciones) {
    for (const id of combo.salidas) {
      const lista = porSalida.get(id) ?? []
      lista.push(combo)
      porSalida.set(id, lista)
    }
    for (const id of combo.entradas) {
      const lista = porEntrada.get(id) ?? []
      lista.push(combo)
      porEntrada.set(id, lista)
    }
  }

  const porCamino = new Map<number, Set<string>>()
  const combinacionesPorCamino = new Map<number, Set<Combinacion>>()
  const union = new Set<string>()

  for (const caminoIndex of caminosSeleccionados) {
    const raices = nodos
      .filter((nodo) => nodo.caminoIndex === caminoIndex)
      .map((nodo) => nodo.id)
    const incluidos = new Set(raices)
    const combosIncluidos = new Set<Combinacion>()
    const procesados = new Set<string>()
    const pendientes = [...raices]

    while (pendientes.length > 0) {
      const actual = pendientes.pop()!
      if (procesados.has(actual)) continue
      procesados.add(actual)
      const nodo = porId.get(actual)
      if (
        nodo &&
        nodo.caminoIndex !== null &&
        nodo.caminoIndex !== caminoIndex &&
        nodo.clase !== 'elemento'
      ) {
        continue
      }
      for (const combo of porSalida.get(actual) ?? []) {
        if (combo.tipo === 'fallo') continue
        combosIncluidos.add(combo)
        for (const id of combo.salidas) incluidos.add(id)
        for (const id of combo.entradas) {
          incluidos.add(id)
          if (!procesados.has(id)) pendientes.push(id)
        }
      }
    }

    // Fallos y desbloqueos OR disparados por una secuencia son hojas del
    // camino. Un AND global no pertenece por contener uno solo de sus nodos.
    for (const raiz of raices) {
      for (const combo of porEntrada.get(raiz) ?? []) {
        if (combo.tipo !== 'fallo' && combo.tipo !== 'desbloqueo') continue
        combosIncluidos.add(combo)
        for (const id of [...combo.entradas, ...combo.salidas]) incluidos.add(id)
      }
    }

    porCamino.set(caminoIndex, incluidos)
    combinacionesPorCamino.set(caminoIndex, combosIncluidos)
    for (const id of incluidos) union.add(id)
  }

  const porNodo = new Map<string, number[]>()
  for (const [caminoIndex, ids] of porCamino) {
    for (const id of ids) {
      const indices = porNodo.get(id) ?? []
      indices.push(caminoIndex)
      porNodo.set(id, indices)
    }
  }

  const interseccion = new Set<string>()
  if (caminosSeleccionados.length >= 2) {
    const [primero, ...resto] = caminosSeleccionados
    for (const id of porCamino.get(primero) ?? []) {
      const nodo = porId.get(id)
      if (
        (nodo?.clase === 'elemento' || nodo?.clase === 'secuencia') &&
        resto.every((index) => porCamino.get(index)?.has(id))
      ) {
        interseccion.add(id)
      }
    }
  }

  return { porCamino, combinacionesPorCamino, porNodo, union, interseccion }
}

// Clave estable para deduplicar aristas acumuladas en el cliente.
export function claveArista(arista: AristaArbol): string {
  return `${arista.de}→${arista.a}·${arista.tipo}·${arista.grupo ?? ''}·${arista.via}`
}
