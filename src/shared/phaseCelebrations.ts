const DEFAULT_MESSAGES: Record<number, string> = {
  2: 'Vas entendiendo cómo va esto.',
  3: 'El tiempo pone todas las cosas en su lugar.',
  4: 'Vamos a necesitar un poco más de espacio para todo esto.',
  5: 'Ya eres un maestro del misticismo.',
  6: 'Se desbloquearon los rituales de ascensión. La verdadera divinidad es solo cuestión de tiempo.',
}

export function defaultPhaseCelebrationMessage(sortOrder: number): string {
  return DEFAULT_MESSAGES[sortOrder] ?? ''
}
