// Reexporta la implementación pura desde src/shared para no romper los
// imports existentes ('@/server/domain/inputKey' y rutas relativas). La
// lógica real vive en src/shared/inputKey.ts porque también la necesita el
// cliente (la Memoria del Aprendiz calcula la misma clave en el navegador).
export * from '@/shared/inputKey'
