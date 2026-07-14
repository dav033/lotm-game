// Convierte un nombre visible («Adivinación Mayor») en un slug estable y sin
// acentos («adivinacion-mayor»), el formato que exige buildRecipeInputKey.
export function generarSlug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // quita tildes y diéresis (ñ → n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
