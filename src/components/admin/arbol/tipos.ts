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
  entradas: string[]
  salidas: string[]
  tipo: AristaArbol['tipo']
  via: string
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
  for (const arista of aristas) {
    if (!arista.grupo) {
      sueltas.push({ entradas: [arista.de], salidas: [arista.a], tipo: arista.tipo, via: arista.via })
      continue
    }
    let combo = porGrupo.get(arista.grupo)
    if (!combo) {
      combo = { entradas: [], salidas: [], tipo: arista.tipo, via: arista.via }
      porGrupo.set(arista.grupo, combo)
    }
    if (!combo.entradas.includes(arista.de)) combo.entradas.push(arista.de)
    if (!combo.salidas.includes(arista.a)) combo.salidas.push(arista.a)
  }
  return [...porGrupo.values(), ...sueltas]
}

// Clave estable para deduplicar aristas acumuladas en el cliente.
export function claveArista(arista: AristaArbol): string {
  return `${arista.de}→${arista.a}·${arista.tipo}·${arista.grupo ?? ''}·${arista.via}`
}
