// Tipos compartidos por el constructor de recetas y sus componentes auxiliares.

export type ElementoOpcion = {
  id: string
  name: string
  slug: string
  iconKey: string
  isActive: boolean
}

export type RecetaOutputEditable = {
  elementId: string
  quantity: number
  chance: number
  sortOrder: number
}

export type RecetaEditable = {
  id: string
  name: string
  outputs: RecetaOutputEditable[]
  successText: string
  hintText: string
  isActive: boolean
  ingredientes: { elementId: string; quantity: number }[]
}
