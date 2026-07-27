import { useRef, useState } from 'react'

// Bandeja de imagenes importadas. A diferencia del filmstrip de cartas, aqui
// no se edita nada: solo se importa, se ordena, se borra y se exporta a MP4.
export default function ImageTray({
  images, busy, seconds, onImport, onDelete, onReorder, onExportVideo,
}) {
  const inputRef = useRef(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const [dropping, setDropping] = useState(false)

  const pick = (fileList) => {
    const files = [...fileList].filter((file) => file.type.startsWith('image/'))
    if (files.length) void onImport(files)
  }

  const handleDrop = (to) => {
    if (dragIndex !== null && dragIndex !== to) {
      const next = [...images]
      next.splice(to, 0, ...next.splice(dragIndex, 1))
      void onReorder(next.map((image) => image.id))
    }
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="image-tray">
      <div className="image-tray-head">
        <span className="image-tray-title">Imagenes ({images.length})</span>
        <button
          className="image-tray-add"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >Importar</button>
        <button
          className="image-tray-video"
          disabled={busy || !images.length}
          title={`Exportar ${images.length} imagenes en MP4 · ${seconds}s cada una`}
          onClick={() => onExportVideo()}
        >🎬</button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { pick(e.target.files); e.target.value = '' }}
        />
      </div>

      <div
        className={'image-tray-rail' + (dropping ? ' dropping' : '')}
        onDragOver={(e) => {
          // Solo se resalta cuando lo que se arrastra son archivos; reordenar
          // dentro de la bandeja no debe parecer una importacion.
          if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true) }
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          setDropping(false)
          pick(e.dataTransfer.files)
        }}
      >
        {images.length === 0 ? (
          <p className="image-tray-empty">Arrastra imagenes aqui o pulsa Importar.</p>
        ) : images.map((image, index) => (
          <div
            key={image.id}
            className={'image-thumb' + (overIndex === index && dragIndex !== null ? ' over' : '')}
            title={image.name}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => { e.preventDefault(); setOverIndex(index) }}
            onDragLeave={() => setOverIndex((o) => (o === index ? null : o))}
            onDrop={(e) => { e.preventDefault(); handleDrop(index) }}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
          >
            <span className="image-no">{index + 1}</span>
            <img src={image.url} alt={image.name} />
            <button
              className="image-rm"
              aria-label={`Quitar ${image.name}`}
              onClick={() => onDelete(image.id)}
            >×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
