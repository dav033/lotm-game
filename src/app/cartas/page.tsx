'use client'

import dynamic from 'next/dynamic'
import '@/builder/styles.css'

// El generador usa IndexedDB, html2canvas y drag & drop: solo tiene sentido en
// el navegador, así que se desactiva el prerender del árbol completo.
const BuilderApp = dynamic(() => import('@/builder/App.jsx'), {
  ssr: false,
  loading: () => <div className="app-loading">Loading your cards…</div>,
})

export default function CartasPage() {
  return (
    <div className="builder-root">
      <BuilderApp />
    </div>
  )
}
