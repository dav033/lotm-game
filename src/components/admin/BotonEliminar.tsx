'use client'

// Botón de borrado con confirmación. Los server components no pueden adjuntar
// manejadores de eventos, así que la confirmación vive en este client
// component; recibe la server action ya vinculada (bind) desde la página.
export function BotonEliminar({
  action,
  confirmacion,
  className,
  children,
}: {
  action: () => Promise<unknown>
  confirmacion: string
  className?: string
  children: React.ReactNode
}) {
  // Las actions devuelven EstadoAccion; el atributo action del form exige
  // void, así que aquí se descarta el resultado.
  const ejecutar = async () => {
    await action()
  }

  return (
    <form action={ejecutar}>
      <button
        type="submit"
        className={className}
        onClick={(e) => {
          if (!window.confirm(confirmacion)) e.preventDefault()
        }}
      >
        {children}
      </button>
    </form>
  )
}
