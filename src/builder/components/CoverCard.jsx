import React, { forwardRef, useRef, useState } from 'react'

const coverDefaultImage = '/cover-default.jpg'

// A dropzone that fills with an uploaded image; drag & drop or click to upload.
function CoverSlot({ image, field, onUploadImage, placeholder, className = '', children }) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'))
    if (file) onUploadImage(file, field)
  }

  return (
    <div
      className={'cover-slot' + (image ? '' : ' empty') + (dragging ? ' dragover' : '') + ' ' + className}
      style={image ? { backgroundImage: `url("${image}")` } : undefined}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
      onDrop={handleDrop}
      onClick={() => fileRef.current?.click()}
    >
      {!image && <span className="cover-ph">{dragging ? 'Drop image here' : placeholder}</span>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onUploadImage(e.target.files[0], field)}
      />
      {children}
    </div>
  )
}

// "Lord of Mysteries" is this app's one constant crossover partner, so only
// the other series' title and the part number are ever user input — every
// other word in the text block is fixed.
const CoverCard = forwardRef(function CoverCard({ image1, image2, title, part, onUploadImage }, ref) {
  return (
    <div className="cover-card" id="card" ref={ref}>
      <CoverSlot
        image={image1}
        field="coverImage1"
        onUploadImage={onUploadImage}
        placeholder="Drop or click to upload top image"
        className="cover-slot-1"
      />

      <CoverSlot
        image={image2 || coverDefaultImage}
        field="coverImage2"
        onUploadImage={onUploadImage}
        placeholder="Drop or click to upload main image"
        className="cover-slot-2"
      />

      <div className="cover-text">
        <div className="cover-header">
          <span className="cover-hl">PATHWAYS IN</span> <span className="cover-rest">{title}</span>
        </div>
        <div className="cover-part">PART {part}</div>
        <div className="cover-subtitle">LORD OF MYSTERIES × {(title || '').toUpperCase()}</div>
      </div>
    </div>
  )
})

export default CoverCard
