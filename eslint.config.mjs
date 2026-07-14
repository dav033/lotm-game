import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
      'legacy/**',
      'src/generated/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      // El generador de cartas heredado usa <img> con data-URLs (html2canvas);
      // next/image no aplica ahí.
      '@next/next/no-img-element': 'off',
      // Regla pensada para pages/_document; en App Router las fuentes van en el
      // layout raíz y sí aplican a todas las rutas.
      '@next/next/no-page-custom-font': 'off',
    },
  },
]

export default eslintConfig
