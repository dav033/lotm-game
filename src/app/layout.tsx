import type { Metadata } from 'next'
import NavPrincipal from '@/components/NavPrincipal'
import './globals.css'

export const metadata: Metadata = {
  title: 'Archivo de Misterios',
  description:
    'Un juego de combinación y descubrimiento de ambientación victoriana y esotérica.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Cinzel: títulos del juego · Inter: texto legible · Space Grotesk: generador de cartas */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NavPrincipal />
        {children}
      </body>
    </html>
  )
}
