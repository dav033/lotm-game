import React, { forwardRef, useRef, useState } from 'react'

const FullImageCoverCard = forwardRef(function FullImageCoverCard(
  { image, title, onUploadImage },
  ref,
) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const upload = (file) => {
    if (file?.type.startsWith('image/')) onUploadImage(file, 'fullCoverImage')
  }

  return (
    <article className="full-image-cover" id="card" ref={ref} aria-label={title || 'Full image cover'}>
      <button
        type="button"
        className={'full-cover-image' + (image ? '' : ' empty') + (dragging ? ' dragover' : '')}
        style={image ? { backgroundImage: `url("${image}")` } : undefined}
        aria-label="Upload full cover image"
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          upload([...event.dataTransfer.files].find((file) => file.type.startsWith('image/')))
        }}
      >
        {!image && <span>{dragging ? 'Drop image here' : 'Drop or click to upload image'}</span>}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label="Choose full cover image"
        hidden
        onChange={(event) => upload(event.target.files[0])}
      />
      <footer className="full-cover-title">{title || 'Cover title'}</footer>
    </article>
  )
})

export default FullImageCoverCard
