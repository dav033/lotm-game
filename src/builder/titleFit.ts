// El nombre de una ficha va en Playfair 900 enorme y una sola palabra larga no
// entra en el ancho util: el navegador la parte por la mitad ("Concealm/ent").
// La talla se elige por la palabra mas larga, que es justo la que no puede
// romperse; los espacios ya permiten repartir el resto en varias lineas.
export type TitleSize = 'xl' | 'lg' | 'md' | 'sm'

export function titleSizeClass(title: string): TitleSize {
  const longest = (title || '')
    .split(/\s+/)
    .reduce((longest, word) => Math.max(longest, word.length), 0)
  if (longest <= 6) return 'xl'
  if (longest <= 9) return 'lg'
  if (longest <= 12) return 'md'
  return 'sm'
}
