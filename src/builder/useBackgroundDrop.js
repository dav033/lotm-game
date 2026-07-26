import { useState } from 'react'

// Soltar una imagen en cualquier punto de la carta cambia su fondo. Sin
// manejador (vista en vivo, render a PNG) no engancha nada y la carta se
// comporta como estatica.
export function useBackgroundDrop(onDropBackground) {
  const [dragging, setDragging] = useState(false)
  if (!onDropBackground) return { dragging: false, dropProps: {} }

  return {
    dragging,
    dropProps: {
      onDragOver: (event) => { event.preventDefault(); setDragging(true) },
      onDragLeave: () => setDragging(false),
      onDrop: (event) => {
        event.preventDefault()
        setDragging(false)
        const file = [...event.dataTransfer.files].find((f) => f.type.startsWith('image/'))
        if (file) onDropBackground(file)
      },
    },
  }
}
