// Datos iniciales del Archivo de Misterios. Todas las escrituras son upserts
// sobre claves únicas: ejecutar el seed varias veces nunca duplica información.

import type { PrismaClient } from '../src/generated/prisma/client'
import { buildRecipeInputKey } from '../src/server/domain/inputKey'

export async function seedGameData(prisma: PrismaClient) {
  // ---------- Categorías ----------
  const mundano = await prisma.category.upsert({
    where: { slug: 'mundano' },
    update: {},
    create: {
      slug: 'mundano',
      name: 'Mundano',
      description: 'Lo que cualquier persona puede tocar sin estremecerse.',
      sortOrder: 1,
    },
  })
  const conceptos = await prisma.category.upsert({
    where: { slug: 'conceptos' },
    update: {},
    create: {
      slug: 'conceptos',
      name: 'Conceptos',
      description: 'Ideas que cobran forma cuando se las contempla demasiado.',
      sortOrder: 2,
    },
  })
  const misticismo = await prisma.category.upsert({
    where: { slug: 'misticismo' },
    update: {},
    create: {
      slug: 'misticismo',
      name: 'Misticismo',
      description: 'Saberes que la razón prefiere no catalogar.',
      sortOrder: 3,
      isHidden: true,
    },
  })
  const beyonder = await prisma.category.upsert({
    where: { slug: 'beyonder' },
    update: {},
    create: {
      slug: 'beyonder',
      name: 'Beyonder',
      description: 'Quienes cruzaron la frontera y ya no pueden regresar.',
      parentId: misticismo.id,
      sortOrder: 4,
      isHidden: true,
    },
  })

  // ---------- Caminos ----------
  const caminoVidente = await prisma.pathway.upsert({
    where: { slug: 'camino-del-vidente' },
    update: {},
    create: {
      slug: 'camino-del-vidente',
      name: 'Camino del Vidente',
      description:
        'La senda de quienes leen el destino en símbolos, cartas y espejos.',
      categoryId: beyonder.id,
      iconKey: 'eye',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoSuplicante = await prisma.pathway.upsert({
    where: { slug: 'camino-del-suplicante-de-secretos' },
    update: {},
    create: {
      slug: 'camino-del-suplicante-de-secretos',
      name: 'Camino del Suplicante de Secretos',
      description:
        'La senda de quienes mendigan saberes prohibidos a puertas que nadie más ve.',
      categoryId: beyonder.id,
      iconKey: 'book-open',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoMonstruo = await prisma.pathway.upsert({
    where: { slug: 'camino-del-monstruo' },
    update: {},
    create: {
      slug: 'camino-del-monstruo',
      name: 'Camino del Monstruo',
      description:
        'La senda de quienes juegan con el destino hasta que el destino juega con ellos.',
      categoryId: beyonder.id,
      iconKey: 'ghost',
      isHiddenUntilDiscovered: true,
    },
  })

  // ---------- Elementos ----------
  type ElementSeed = {
    slug: string
    name: string
    description: string
    iconKey: string
    type: string
    tier: number
    isStarter?: boolean
    isHiddenUntilDiscovered?: boolean
    isMajorDiscovery?: boolean
    revealTitle?: string
    revealText?: string
    unlockedByType?: string
    unlockedBySequenceNumber?: number
    categoryId: string
  }

  const defs: ElementSeed[] = [
    {
      slug: 'ojo',
      name: 'Ojo',
      description: 'Un órgano humilde que, sin embargo, lo observa todo.',
      iconKey: 'eye',
      type: 'MUNDANO',
      tier: 0,
      isStarter: true,
      isHiddenUntilDiscovered: false,
      categoryId: mundano.id,
    },
    {
      slug: 'moneda',
      name: 'Moneda',
      description: 'Metal acuñado. Cara o cruz: alguien siempre pierde.',
      iconKey: 'coins',
      type: 'MUNDANO',
      tier: 0,
      isStarter: true,
      isHiddenUntilDiscovered: false,
      categoryId: mundano.id,
    },
    {
      slug: 'humano',
      name: 'Humano',
      description: 'Frágil, curioso y convencido de que el mundo le pertenece.',
      iconKey: 'user-round',
      type: 'MUNDANO',
      tier: 0,
      isStarter: true,
      isHiddenUntilDiscovered: false,
      categoryId: mundano.id,
    },
    {
      slug: 'vision',
      name: 'Visión',
      description: 'Cuando dos miradas coinciden, algo más que luz se enfoca.',
      iconKey: 'scan-eye',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    // ----- Cadena del Ocultamiento -----
    // Estos slugs coinciden con los elementos ya usados en la base actual.
    {
      slug: 'experiencia-2',
      name: 'Experiencia',
      description: 'Lo vivido deja lecciones que ningún libro puede sustituir.',
      iconKey: 'history',
      type: 'CONCEPTO',
      tier: 0,
      categoryId: conceptos.id,
    },
    {
      slug: 'conocimiento',
      name: 'Conocimiento',
      description: 'Comprensión acumulada y ordenada por la razón.',
      iconKey: 'brain',
      type: 'CONCEPTO',
      tier: 0,
      categoryId: conceptos.id,
    },
    {
      slug: 'informacion',
      name: 'Información',
      description: 'El conocimiento interpreta el dato y le da significado.',
      iconKey: 'file-text',
      type: 'CONCEPTO',
      tier: 2,
      categoryId: conceptos.id,
    },
    {
      slug: 'prudencia',
      name: 'Prudencia',
      description:
        'La experiencia y el conocimiento permiten reconocer qué conviene no revelar.',
      iconKey: 'shield',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'reserva',
      name: 'Reserva',
      description: 'La información manejada con prudencia se mantiene restringida.',
      iconKey: 'lock-keyhole',
      type: 'CONCEPTO',
      tier: 2,
      categoryId: conceptos.id,
    },
    {
      slug: 'ocultamiento',
      name: 'Ocultamiento',
      description:
        'La reserva aplicada a aquello que puede verse o descubrirse produce ocultamiento.',
      iconKey: 'eye-off',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    // ----- Cadenas de esfuerzo, peligro y control -----
    {
      slug: 'tiempo',
      name: 'Tiempo',
      description: 'La medida invisible que transforma toda acción.',
      iconKey: 'alarm-clock',
      type: 'CONCEPTO',
      tier: 0,
      categoryId: conceptos.id,
    },
    {
      slug: 'trabajo',
      name: 'Trabajo',
      description: 'La voluntad humana aplicada a una necesidad material.',
      iconKey: 'briefcase-business',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'esfuerzo',
      name: 'Esfuerzo',
      description: 'Trabajo sostenido a través del tiempo.',
      iconKey: 'footprints',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'fuerza',
      name: 'Fuerza',
      description: 'El esfuerzo humano convertido en capacidad física.',
      iconKey: 'dumbbell',
      type: 'CONCEPTO',
      tier: 2,
      categoryId: conceptos.id,
    },
    {
      slug: 'muerte',
      name: 'Muerte',
      description: 'El límite que vuelve urgente toda percepción.',
      iconKey: 'skull',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'intuicion',
      name: 'Intuición',
      description: 'Una certeza que llega antes que la explicación.',
      iconKey: 'lightbulb',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'peligro',
      name: 'Peligro',
      description: 'La muerte percibida antes de que llegue.',
      iconKey: 'triangle-alert',
      type: 'MISTICISMO',
      tier: 2,
      categoryId: misticismo.id,
    },
    {
      slug: 'danger-intuition',
      name: 'Danger Intuition',
      description: 'La intuición afinada por la presencia constante del peligro.',
      iconKey: 'radar',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    {
      slug: 'control-corporal',
      name: 'Control corporal',
      description: 'La fuerza guiada por la experiencia del propio cuerpo.',
      iconKey: 'biceps-flexed',
      type: 'CONCEPTO',
      tier: 3,
      categoryId: conceptos.id,
    },
    {
      slug: 'existencia-oculta',
      name: 'Existencia oculta',
      description: 'Una presencia peligrosa que permanece fuera de la vista.',
      iconKey: 'eye-off',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    {
      slug: 'revelacion-prohibida',
      name: 'Revelación prohibida',
      description: 'Una verdad que el misticismo mantuvo oculta por una razón.',
      iconKey: 'book-key',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    {
      slug: 'locura',
      name: 'Locura',
      description: 'La mente humana quebrada por aquello que no debía conocer.',
      iconKey: 'circle-help',
      type: 'MISTICISMO',
      tier: 4,
      categoryId: misticismo.id,
    },
    {
      slug: 'robot',
      name: 'Robot',
      description: 'Secuencia 8 del Camino del Monstruo.',
      iconKey: 'bot',
      type: 'BEYONDER',
      tier: 4,
      isMajorDiscovery: true,
      revealTitle: 'El azar aprende a obedecer',
      revealText: 'Tu cuerpo responde con una precisión que ya no parece humana.',
      categoryId: beyonder.id,
    },
    {
      slug: 'clown',
      name: 'Clown',
      description: 'Secuencia 8 del Camino del Vidente.',
      iconKey: 'drama',
      type: 'BEYONDER',
      tier: 4,
      isMajorDiscovery: true,
      revealTitle: 'Una sonrisa cubre el abismo',
      revealText: 'Dominas el cuerpo mientras ocultas el temblor de la mente.',
      categoryId: beyonder.id,
    },
    // ----- Escucha, magia, incertidumbre y suerte -----
    {
      slug: 'escucha',
      name: 'Escucha',
      description: 'La percepción humana dirigida hacia lo que otros no oyen.',
      iconKey: 'ear',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'magia',
      name: 'Magia',
      description: 'El conocimiento aplicado sobre las reglas ocultas del misticismo.',
      iconKey: 'wand',
      type: 'MISTICISMO',
      tier: 2,
      categoryId: misticismo.id,
    },
    {
      slug: 'ilusion',
      name: 'Ilusión',
      description: 'Magia que altera aquello que la percepción acepta como real.',
      iconKey: 'blend',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    {
      slug: 'incertidumbre',
      name: 'Incertidumbre',
      description: 'Información oculta que impide distinguir certeza de posibilidad.',
      iconKey: 'circle-help',
      type: 'CONCEPTO',
      tier: 3,
      categoryId: conceptos.id,
    },
    {
      slug: 'suerte',
      name: 'Suerte',
      description: 'El destino inclinándose dentro de un mar de incertidumbre.',
      iconKey: 'clover',
      type: 'MISTICISMO',
      tier: 4,
      categoryId: misticismo.id,
    },
    {
      slug: 'listener',
      name: 'Listener',
      description: 'Secuencia 8 del Camino del Suplicante de Secretos.',
      iconKey: 'ear',
      type: 'BEYONDER',
      tier: 4,
      isMajorDiscovery: true,
      revealTitle: 'Los susurros encuentran un oído',
      revealText: 'Ahora escuchas aquello que nunca fue pronunciado.',
      categoryId: beyonder.id,
    },
    {
      slug: 'mago',
      name: 'Mago',
      description: 'Secuencia 7 del Camino del Vidente.',
      iconKey: 'wand-sparkles',
      type: 'BEYONDER',
      tier: 5,
      isMajorDiscovery: true,
      revealTitle: 'La realidad acepta el truco',
      revealText: 'La ilusión deja de ser engaño y comienza a obedecerte.',
      categoryId: beyonder.id,
    },
    // ----- Cambio cualitativo, sombras y carne -----
    {
      slug: 'avance',
      name: 'Avance',
      description: 'El paso de un ser más allá de su estado anterior.',
      iconKey: 'move-up-right',
      type: 'CONCEPTO',
      tier: 2,
      categoryId: conceptos.id,
    },
    {
      slug: 'cambio-cualitativo',
      name: 'Cambio cualitativo',
      description: 'Una transformación que altera la naturaleza y no solo la cantidad.',
      iconKey: 'blend',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    {
      slug: 'secuencia-media',
      name: 'Secuencia media',
      description: 'El umbral donde una secuencia deja atrás los primeros pasos del camino.',
      iconKey: 'layers',
      type: 'CONCEPTO',
      tier: 4,
      unlockedBySequenceNumber: 7,
      categoryId: conceptos.id,
    },
    {
      slug: 'divinidad',
      name: 'Divinidad',
      description: 'Una cualidad que comienza a apartarse de lo enteramente humano.',
      iconKey: 'sun',
      type: 'MISTICISMO',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'saint',
      name: 'Saint',
      description: 'Un título para quien ha cruzado un límite cualitativo del camino.',
      iconKey: 'award',
      type: 'MISTICISMO',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'demigod',
      name: 'Demigod',
      description: 'Una existencia situada entre lo mortal y lo divino.',
      iconKey: 'star',
      type: 'MISTICISMO',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'claridad',
      name: 'Claridad',
      description: 'El conocimiento ordena la percepción hasta disipar la confusión.',
      iconKey: 'lightbulb',
      type: 'CONCEPTO',
      tier: 2,
      categoryId: conceptos.id,
    },
    {
      slug: 'luz',
      name: 'Luz',
      description: 'La claridad atravesando las reglas del misticismo.',
      iconKey: 'sun',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    {
      slug: 'silueta',
      name: 'Silueta',
      description: 'Una forma visible cuyo interior permanece oculto.',
      iconKey: 'user-round',
      type: 'CONCEPTO',
      tier: 2,
      categoryId: conceptos.id,
    },
    {
      slug: 'sombra',
      name: 'Sombra',
      description: 'La silueta que la luz proyecta sobre lo desconocido.',
      iconKey: 'moon',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    {
      slug: 'calamidad',
      name: 'Calamidad',
      description: 'Un peligro transformado en desastre de gran escala.',
      iconKey: 'triangle-alert',
      type: 'MISTICISMO',
      tier: 4,
      categoryId: misticismo.id,
    },
    {
      slug: 'disfraz',
      name: 'Disfraz',
      description: 'La apariencia humana usada para ocultar la identidad.',
      iconKey: 'drama',
      type: 'CONCEPTO',
      tier: 2,
      categoryId: conceptos.id,
    },
    {
      slug: 'carne',
      name: 'Carne',
      description: 'El cuerpo pierde su condición de ser vivo y queda como materia orgánica.',
      iconKey: 'beef',
      type: 'MUNDANO',
      tier: 1,
      categoryId: mundano.id,
    },
    {
      slug: 'herida',
      name: 'Herida',
      description: 'La fuerza física aplicada sobre la carne produce daño.',
      iconKey: 'bandage',
      type: 'MUNDANO',
      tier: 2,
      categoryId: mundano.id,
    },
    {
      slug: 'sangre',
      name: 'Sangre',
      description: 'La carne herida deja salir la sangre.',
      iconKey: 'droplets',
      type: 'MUNDANO',
      tier: 2,
      categoryId: mundano.id,
    },
    {
      slug: 'carne-y-sangre',
      name: 'Carne y sangre',
      description: 'Materia orgánica reunida con aquello que le daba vida.',
      iconKey: 'beef',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    {
      slug: 'lucky-one',
      name: 'Lucky One',
      description: 'Secuencia 7 del Camino del Monstruo.',
      iconKey: 'clover',
      type: 'BEYONDER',
      tier: 5,
      isMajorDiscovery: true,
      categoryId: beyonder.id,
    },
    {
      slug: 'shadow-ascetic',
      name: 'Shadow Ascetic',
      description: 'Secuencia 7 del Camino del Suplicante de Secretos.',
      iconKey: 'eye-off',
      type: 'BEYONDER',
      tier: 5,
      isMajorDiscovery: true,
      categoryId: beyonder.id,
    },
    {
      slug: 'calamity-priest',
      name: 'Calamity Priest',
      description: 'Secuencia 6 del Camino del Monstruo.',
      iconKey: 'triangle-alert',
      type: 'BEYONDER',
      tier: 6,
      isMajorDiscovery: true,
      categoryId: beyonder.id,
    },
    {
      slug: 'faceless',
      name: 'Faceless',
      description: 'Secuencia 6 del Camino del Vidente.',
      iconKey: 'drama',
      type: 'BEYONDER',
      tier: 6,
      isMajorDiscovery: true,
      categoryId: beyonder.id,
    },
    {
      slug: 'rose-bishop',
      name: 'Rose Bishop',
      description: 'Secuencia 6 del Camino del Suplicante de Secretos.',
      iconKey: 'droplets',
      type: 'BEYONDER',
      tier: 6,
      isMajorDiscovery: true,
      categoryId: beyonder.id,
    },
    // ----- Alma, hambre y ritual de Shepherd -----
    {
      slug: 'espiritu',
      name: 'Espíritu',
      description: 'La parte inmaterial que permanece cuando la vida abandona al humano.',
      iconKey: 'ghost',
      type: 'MISTICISMO',
      tier: 2,
      categoryId: misticismo.id,
    },
    {
      slug: 'alma',
      name: 'Alma',
      description: 'El espíritu moldeado por toda la experiencia de una existencia.',
      iconKey: 'orbit',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    {
      slug: 'desgaste',
      name: 'Desgaste',
      description: 'El esfuerzo acumulado deteriora lentamente al cuerpo humano.',
      iconKey: 'history',
      type: 'CONCEPTO',
      tier: 2,
      categoryId: conceptos.id,
    },
    {
      slug: 'hambre',
      name: 'Hambre',
      description: 'El desgaste prolongado en el tiempo exige alimento.',
      iconKey: 'beef',
      type: 'MUNDANO',
      tier: 3,
      categoryId: mundano.id,
    },
    {
      slug: 'devoracion',
      name: 'Devoración',
      description: 'El hambre consumiendo carne sin medida ni control.',
      iconKey: 'skull',
      type: 'MISTICISMO',
      tier: 4,
      categoryId: misticismo.id,
    },
    {
      slug: 'influencia',
      name: 'Influencia',
      description: 'Información percibida que altera decisiones y voluntades.',
      iconKey: 'waves',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    {
      slug: 'shepherd',
      name: 'Shepherd',
      description: 'Secuencia 5 del Camino del Suplicante de Secretos.',
      iconKey: 'user-round',
      type: 'BEYONDER',
      tier: 7,
      isMajorDiscovery: true,
      categoryId: beyonder.id,
    },
    {
      slug: 'perdida-de-control',
      name: 'Pérdida de control',
      description: 'El avance fracasa y la voluntad deja de gobernar el cuerpo.',
      iconKey: 'circle-help',
      type: 'MISTICISMO',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'monstruo-descontrol',
      name: 'Monstruo',
      description: 'Una forma nacida de un avance fallido y fuera de control.',
      iconKey: 'ghost',
      type: 'CRIATURA',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'corrupcion-de-alborotador',
      name: 'Corrupción de alborotador',
      description: 'La corrupción que invade el cuerpo tras perturbar un ritual incompleto.',
      iconKey: 'triangle-alert',
      type: 'MISTICISMO',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'percepcion',
      name: 'Percepción',
      description: 'El arte de notar aquello que preferiría no ser notado.',
      iconKey: 'radar',
      type: 'MISTICISMO',
      tier: 2,
      categoryId: misticismo.id,
    },
    {
      slug: 'fortuna',
      name: 'Fortuna',
      description: 'La suma de todas las monedas que aún no han caído.',
      iconKey: 'clover',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'adivinacion',
      name: 'Adivinación',
      description: 'Preguntarle al azar con la esperanza de que responda.',
      iconKey: 'dices',
      type: 'MISTICISMO',
      tier: 2,
      categoryId: misticismo.id,
    },
    {
      slug: 'seer',
      name: 'Seer',
      description:
        'Secuencia 9 del Camino del Vidente. El primer paso más allá del velo.',
      iconKey: 'scan-eye',
      type: 'BEYONDER',
      tier: 3,
      isMajorDiscovery: true,
      revealTitle: 'El velo se ha abierto',
      revealText: 'Has traspasado la frontera de lo mundano.',
      categoryId: beyonder.id,
    },
    // ----- Cadena del Suplicante de Secretos -----
    {
      slug: 'susurro',
      name: 'Susurro',
      description: 'Lo que dos humanos comparten cuando creen que nadie escucha.',
      iconKey: 'feather',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'secreto',
      name: 'Secreto',
      description: 'Un susurro observado el tiempo suficiente se convierte en carga.',
      iconKey: 'lock-keyhole',
      type: 'MISTICISMO',
      tier: 2,
      categoryId: misticismo.id,
    },
    {
      slug: 'secret-suplicant',
      name: 'Secret Suplicant',
      description:
        'Secuencia 9 del Camino del Suplicante de Secretos. Quien pide saber, paga con algo más que monedas.',
      iconKey: 'book-key',
      type: 'BEYONDER',
      tier: 3,
      isMajorDiscovery: true,
      revealTitle: 'Una puerta te ha oído',
      revealText: 'Has susurrado la pregunta correcta al umbral equivocado.',
      categoryId: beyonder.id,
    },
    // ----- Cadena del Monstruo -----
    {
      slug: 'apuesta',
      name: 'Apuesta',
      description: 'Un humano y una moneda: el pacto más antiguo con el azar.',
      iconKey: 'clover',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'destino',
      name: 'Destino',
      description: 'Cuando la apuesta se repite lo bastante, deja de ser azar.',
      iconKey: 'dices',
      type: 'MISTICISMO',
      tier: 2,
      categoryId: misticismo.id,
    },
    {
      slug: 'monster',
      name: 'Monster',
      description:
        'Secuencia 9 del Camino del Monstruo. La suerte lo ama tanto que da miedo.',
      iconKey: 'circle-dot-dashed',
      type: 'BEYONDER',
      tier: 3,
      isMajorDiscovery: true,
      revealTitle: 'La rueda ha girado',
      revealText: 'El destino te ha mirado a los ojos y ha sonreído.',
      categoryId: beyonder.id,
    },
    // Conceptos que ninguna receta fabrica: se revelan solos al descubrir el
    // primer elemento de tipo BEYONDER.
    {
      slug: 'misticismo',
      name: 'Misticismo',
      description: 'Saberes que la razón prefiere no catalogar.',
      iconKey: 'wand-sparkles',
      type: 'CONCEPTO',
      tier: 2,
      unlockedByType: 'BEYONDER',
      categoryId: misticismo.id,
    },
    {
      slug: 'beyonder',
      name: 'Beyonder',
      description: 'La noción de que alguien puede cruzar la frontera y no regresar.',
      iconKey: 'star',
      type: 'CONCEPTO',
      tier: 2,
      unlockedByType: 'BEYONDER',
      categoryId: beyonder.id,
    },
    // ----- Cadena del Mar y la Sirena -----
    {
      slug: 'agua',
      name: 'Agua',
      description: 'El elemento que fluye, se adapta y jamás se rompe.',
      iconKey: 'droplets',
      type: 'MUNDANO',
      tier: 0,
      isStarter: true,
      isHiddenUntilDiscovered: false,
      categoryId: mundano.id,
    },
    {
      slug: 'acumulacion',
      name: 'Acumulación',
      description: 'Lo pequeño repetido sin descanso hasta volverse inmenso.',
      iconKey: 'layers',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'mar',
      name: 'Mar',
      description: 'El agua acumulada hasta perder su orilla.',
      iconKey: 'waves',
      type: 'MUNDANO',
      tier: 2,
      categoryId: mundano.id,
    },
    {
      slug: 'criatura',
      name: 'Criatura',
      description: 'La carne y el alma unidas en una forma que ya no es del todo humana.',
      iconKey: 'ghost',
      type: 'CRIATURA',
      tier: 4,
      categoryId: misticismo.id,
    },
    {
      slug: 'criatura-beyonder',
      name: 'Criatura Beyonder',
      description: 'Una criatura tocada por el poder de quien cruzó la frontera.',
      iconKey: 'skull',
      type: 'CRIATURA',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'ritmo',
      name: 'Ritmo',
      description: 'La escucha que aprende a medirse con el tiempo.',
      iconKey: 'hourglass',
      type: 'CONCEPTO',
      tier: 2,
      categoryId: conceptos.id,
    },
    {
      slug: 'canto',
      name: 'Canto',
      description: 'El ritmo que un humano convierte en voz.',
      iconKey: 'feather',
      type: 'CONCEPTO',
      tier: 3,
      categoryId: conceptos.id,
    },
    {
      slug: 'criatura-beyonder-acuatica',
      name: 'Criatura Beyonder Acuática',
      description: 'Una criatura Beyonder que ha hecho del mar su morada.',
      iconKey: 'anchor',
      type: 'CRIATURA',
      tier: 6,
      categoryId: misticismo.id,
    },
    {
      slug: 'sirena',
      name: 'Sirena',
      description: 'La criatura acuática cuyo canto no promete nada bueno.',
      iconKey: 'moon-star',
      type: 'CRIATURA',
      tier: 7,
      categoryId: misticismo.id,
    },
    {
      slug: 'marionetista',
      name: 'Marionetista',
      description:
        'Secuencia 5 del Camino del Vidente. Quien maneja los hilos ya no distingue su propia mano de la ajena.',
      iconKey: 'drama',
      type: 'BEYONDER',
      tier: 7,
      isMajorDiscovery: true,
      revealTitle: 'Los hilos responden a tu voluntad',
      revealText: 'Faceless deja de fingir un rostro: ahora mueve los de otros.',
      categoryId: beyonder.id,
    },
    // ----- Cadena del Cuerpo Espiritual y la Marioneta -----
    {
      slug: 'cuerpo-espiritual',
      name: 'Cuerpo Espiritual',
      description: 'El humano despojado de su cuerpo mundano, sostenido apenas por el misticismo.',
      iconKey: 'orbit',
      type: 'MISTICISMO',
      tier: 3,
      categoryId: misticismo.id,
    },
    {
      slug: 'espiritualidad',
      name: 'Espiritualidad',
      description: 'Lo que el misticismo revela cuando se posa sobre un humano.',
      iconKey: 'sparkles',
      type: 'CONCEPTO',
      tier: 3,
      categoryId: conceptos.id,
    },
    {
      slug: 'continuidad',
      name: 'Continuidad',
      description: 'El tiempo que se repite sin quebrarse.',
      iconKey: 'hourglass',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'proyeccion',
      name: 'Proyección',
      description: 'Una silueta que avanza más allá de su dueño.',
      iconKey: 'telescope',
      type: 'CONCEPTO',
      tier: 3,
      categoryId: conceptos.id,
    },
    {
      slug: 'extension',
      name: 'Extensión',
      description: 'La proyección sostenida en una continuidad que no termina.',
      iconKey: 'move-up-right',
      type: 'CONCEPTO',
      tier: 4,
      categoryId: conceptos.id,
    },
    {
      slug: 'hilos-del-cuerpo-espiritual',
      name: 'Hilos del Cuerpo Espiritual',
      description: 'El cuerpo espiritual estirado hasta convertirse en cuerdas invisibles.',
      iconKey: 'gem',
      type: 'MISTICISMO',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'marioneta',
      name: 'Marioneta',
      description: 'Los hilos del cuerpo espiritual encontrando algo -o alguien- a quien mover.',
      iconKey: 'drama',
      type: 'OBJETO',
      tier: 6,
      categoryId: misticismo.id,
    },
    {
      slug: 'desastre',
      name: 'Desastre',
      description: 'La ruina que llega sin avisar y no distingue a quién alcanza.',
      iconKey: 'triangle-alert',
      type: 'MISTICISMO',
      tier: 0,
      categoryId: misticismo.id,
    },
    {
      slug: 'mala-suerte',
      name: 'Mala Suerte',
      description: 'La suerte vuelta del revés por el desastre.',
      iconKey: 'skull',
      type: 'MISTICISMO',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'procedimiento',
      name: 'Procedimiento',
      description: 'La información ordenada por el trabajo hasta volverse repetible.',
      iconKey: 'notebook-tabs',
      type: 'CONCEPTO',
      tier: 3,
      categoryId: conceptos.id,
    },
    {
      slug: 'ritual',
      name: 'Ritual',
      description: 'Un procedimiento que el misticismo vuelve sagrado.',
      iconKey: 'scroll-text',
      type: 'MISTICISMO',
      tier: 4,
      categoryId: misticismo.id,
    },
    {
      slug: 'rezar',
      name: 'Rezar',
      description: 'El ritual dirigido hacia lo que permanece oculto, con la esperanza de ser oído.',
      iconKey: 'landmark',
      type: 'MISTICISMO',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'sacrificio',
      name: 'Sacrificio',
      description: 'El ritual que exige algo a cambio de lo oculto.',
      iconKey: 'flame',
      type: 'MISTICISMO',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'otorgamiento',
      name: 'Otorgamiento',
      description: 'Lo oculto que responde al ritual y concede lo pedido.',
      iconKey: 'key-round',
      type: 'MISTICISMO',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'winner',
      name: 'Winner',
      description:
        'Secuencia 5 del Camino del Monstruo. La suerte deja de ser un don y se convierte en destino garantizado.',
      iconKey: 'trophy',
      type: 'BEYONDER',
      tier: 7,
      isMajorDiscovery: true,
      revealTitle: 'Ganar deja de ser cuestión de azar',
      revealText: 'Calamity Priest descubre que el desastre también puede jugar a tu favor.',
      categoryId: beyonder.id,
    },
    {
      slug: 'bizarro-sorcerer',
      name: 'Bizarro Sorcerer',
      description:
        'Secuencia 4 del Camino del Vidente. Los hilos ya no mueven marionetas: mueven la realidad misma.',
      iconKey: 'flask-conical',
      type: 'BEYONDER',
      tier: 8,
      isMajorDiscovery: true,
      revealTitle: 'La magia deja de pedir permiso',
      revealText: 'Marionetista comprende que también la realidad puede tener hilos.',
      categoryId: beyonder.id,
    },
    // ----- Cadena de la Corrupción, el Guerrero y la Comunidad -----
    {
      slug: 'corrupcion',
      name: 'Corrupción',
      description: 'La locura que un Beyonder disemina sin proponérselo.',
      iconKey: 'triangle-alert',
      type: 'MISTICISMO',
      tier: 5,
      categoryId: misticismo.id,
    },
    {
      slug: 'degeneracion',
      name: 'Degeneración',
      description: 'La corrupción que el tiempo no cura, sino que profundiza.',
      iconKey: 'history',
      type: 'MISTICISMO',
      tier: 6,
      categoryId: misticismo.id,
    },
    {
      slug: 'guerrero',
      name: 'Guerrero',
      description: 'El humano que convierte la fuerza en oficio.',
      iconKey: 'swords',
      type: 'MUNDANO',
      tier: 3,
      categoryId: mundano.id,
    },
    {
      slug: 'caballero',
      name: 'Caballero',
      description: 'La experiencia que pule al guerrero hasta volverlo disciplina.',
      iconKey: 'medal',
      type: 'MUNDANO',
      tier: 4,
      categoryId: mundano.id,
    },
    {
      slug: 'familia',
      name: 'Familia',
      description: 'Dos humanos que deciden dejar de estar solos.',
      iconKey: 'user-round',
      type: 'CONCEPTO',
      tier: 1,
      categoryId: conceptos.id,
    },
    {
      slug: 'comunidad',
      name: 'Comunidad',
      description: 'Las familias que comparten algo más que sangre.',
      iconKey: 'landmark',
      type: 'CONCEPTO',
      tier: 2,
      categoryId: conceptos.id,
    },
    {
      slug: 'ciudad',
      name: 'Ciudad',
      description: 'La comunidad que ya no cabe a simple vista.',
      iconKey: 'landmark',
      type: 'MUNDANO',
      tier: 3,
      categoryId: mundano.id,
    },
    {
      slug: 'black-knight',
      name: 'Black Knight',
      description:
        'Secuencia 4 del Camino del Suplicante de Secretos. La degeneración vestida con la disciplina de un caballero.',
      iconKey: 'moon',
      type: 'BEYONDER',
      tier: 8,
      isMajorDiscovery: true,
      revealTitle: 'La armadura ya no protege: contiene',
      revealText: 'Shepherd descubre que también la corrupción puede jurar lealtad.',
      categoryId: beyonder.id,
    },
    // ----- Destino, memoria, vínculos y mundos espirituales -----
    { slug: 'registro', name: 'Registro', description: 'Información preservada para sobrevivir al paso del tiempo.', iconKey: 'file-text', type: 'CONCEPTO', tier: 2, categoryId: conceptos.id },
    { slug: 'bendicion', name: 'Bendición', description: 'Una existencia oculta responde favorablemente a una plegaria o sacrificio.', iconKey: 'award', type: 'MISTICISMO', tier: 5, categoryId: misticismo.id },
    { slug: 'historia', name: 'Historia', description: 'El registro transformado por la distancia del tiempo.', iconKey: 'history', type: 'CONCEPTO', tier: 4, categoryId: conceptos.id },
    { slug: 'vinculo', name: 'Vínculo', description: 'La relación invisible que nace entre dos humanos.', iconKey: 'blend', type: 'CONCEPTO', tier: 1, categoryId: conceptos.id },
    { slug: 'ruptura', name: 'Ruptura', description: 'La fuerza aplicada hasta quebrar un vínculo.', iconKey: 'triangle-alert', type: 'CONCEPTO', tier: 2, categoryId: conceptos.id },
    { slug: 'separacion', name: 'Separación', description: 'La ruptura consolidada por el paso del tiempo.', iconKey: 'move-up-right', type: 'CONCEPTO', tier: 3, categoryId: conceptos.id },
    { slug: 'era', name: 'Era', description: 'Una continuidad tan extensa que adquiere identidad propia.', iconKey: 'hourglass', type: 'CONCEPTO', tier: 3, categoryId: conceptos.id },
    { slug: 'ausencia', name: 'Ausencia', description: 'El vacío que deja un vínculo después de la separación.', iconKey: 'eye-off', type: 'CONCEPTO', tier: 4, categoryId: conceptos.id },
    { slug: 'deseo', name: 'Deseo', description: 'La ausencia percibida se convierte en anhelo.', iconKey: 'flame', type: 'CONCEPTO', tier: 5, categoryId: conceptos.id },
    { slug: 'milagro', name: 'Milagro', description: 'Un deseo que atraviesa un cambio cualitativo y altera lo posible.', iconKey: 'wand-sparkles', type: 'MISTICISMO', tier: 6, categoryId: misticismo.id },
    { slug: 'proyeccion-astral', name: 'Proyección astral', description: 'El cuerpo espiritual proyectado más allá del plano material.', iconKey: 'orbit', type: 'MISTICISMO', tier: 4, categoryId: misticismo.id },
    { slug: 'mundo-espiritual', name: 'Mundo espiritual', description: 'El plano invisible al que conduce una proyección astral.', iconKey: 'moon-star', type: 'MISTICISMO', tier: 5, categoryId: misticismo.id },
    { slug: 'criatura-espiritual', name: 'Criatura espiritual', description: 'Una criatura adaptada a existir en el mundo espiritual.', iconKey: 'ghost', type: 'CRIATURA', tier: 5, categoryId: misticismo.id },
    { slug: 'descripcion-espiritual', name: 'Descripción espiritual', description: 'Un registro preciso de la esencia de una criatura espiritual.', iconKey: 'scroll-text', type: 'MISTICISMO', tier: 6, categoryId: misticismo.id },
    { slug: 'invocacion', name: 'Invocación', description: 'Un ritual capaz de llamar aquello que ha sido descrito.', iconKey: 'circle-dot-dashed', type: 'MISTICISMO', tier: 6, categoryId: misticismo.id },
    { slug: 'invocador', name: 'Invocador', description: 'Un Beyonder que domina el arte de la invocación.', iconKey: 'wand', type: 'BEYONDER', tier: 6, categoryId: beyonder.id },
    { slug: 'ciclo', name: 'Ciclo', description: 'El destino atrapado en una continuidad recurrente.', iconKey: 'circle-dot-dashed', type: 'CONCEPTO', tier: 3, categoryId: conceptos.id },
    { slug: 'retorno', name: 'Retorno', description: 'El ciclo que completa su recorrido a través del tiempo.', iconKey: 'history', type: 'CONCEPTO', tier: 4, categoryId: conceptos.id },
    { slug: 'consecuencia', name: 'Consecuencia', description: 'El resultado inevitable de una influencia prolongada.', iconKey: 'move-up-right', type: 'CONCEPTO', tier: 4, categoryId: conceptos.id },
    { slug: 'inevitabilidad', name: 'Inevitabilidad', description: 'La consecuencia unida al destino hasta no admitir alternativa.', iconKey: 'lock-keyhole', type: 'MISTICISMO', tier: 5, categoryId: misticismo.id },
    { slug: 'nacion', name: 'Nación', description: 'Dos ciudades unidas bajo una identidad y un destino comunes.', iconKey: 'landmark', type: 'MUNDANO', tier: 4, categoryId: mundano.id },
    { slug: 'simbolismo', name: 'Simbolismo', description: 'La información expresada mediante correspondencias místicas.', iconKey: 'book-key', type: 'MISTICISMO', tier: 4, categoryId: misticismo.id },
    { slug: 'mundo-astral', name: 'Mundo Astral', description: 'El dominio de los símbolos y la divinidad.', iconKey: 'star', type: 'MISTICISMO', tier: 6, categoryId: misticismo.id },
    { slug: 'rio', name: 'Río', description: 'Agua que encuentra un cauce y comienza a avanzar.', iconKey: 'waves', type: 'MUNDANO', tier: 1, categoryId: mundano.id },
    { slug: 'river-of-fate', name: 'River of Fate', description: 'Un río cuyo cauce sigue el destino en lugar de la geografía.', iconKey: 'waves', type: 'MISTICISMO', tier: 5, categoryId: misticismo.id },
    { slug: 'ley', name: 'Ley', description: 'El procedimiento aceptado por toda una comunidad.', iconKey: 'scroll-text', type: 'CONCEPTO', tier: 3, categoryId: conceptos.id },
    { slug: 'orden', name: 'Orden', description: 'La ley extendida sobre una ciudad.', iconKey: 'layers', type: 'CONCEPTO', tier: 4, categoryId: conceptos.id },
    { slug: 'distorsion', name: 'Distorsión', description: 'El orden deformado por la corrupción.', iconKey: 'blend', type: 'MISTICISMO', tier: 5, categoryId: misticismo.id },
    { slug: 'desorden', name: 'Desorden', description: 'La distorsión liberada por la incertidumbre.', iconKey: 'dices', type: 'MISTICISMO', tier: 6, categoryId: misticismo.id },
    { slug: 'revelacion', name: 'Revelación', description: 'El destino expuesto por medio de la adivinación.', iconKey: 'scan-eye', type: 'MISTICISMO', tier: 4, categoryId: misticismo.id },
    { slug: 'profecia', name: 'Profecía', description: 'Una revelación fijada en un registro antes de que ocurra.', iconKey: 'book-open', type: 'MISTICISMO', tier: 5, categoryId: misticismo.id },
    { slug: 'misfortune-mage', name: 'Misfortune Mage', description: 'Secuencia 4 del Camino del Monstruo. Convierte la desgracia en un arte dirigido.', iconKey: 'wand-sparkles', type: 'BEYONDER', tier: 8, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'chaoswalker', name: 'Chaoswalker', description: 'Secuencia 3 del Camino del Monstruo. Camina donde el destino pierde todo orden.', iconKey: 'dices', type: 'BEYONDER', tier: 9, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'soothsayer', name: 'Soothsayer', description: 'Secuencia 2 del Camino del Monstruo. Contempla los cauces futuros del destino.', iconKey: 'scan-eye', type: 'BEYONDER', tier: 10, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'scholar-of-yore', name: 'Scholar of Yore', description: 'Secuencia 3 del Camino del Vidente. Extrae poder de la historia y de eras olvidadas.', iconKey: 'history', type: 'BEYONDER', tier: 9, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'miracle-invoker', name: 'Invocador de Milagros', description: 'Secuencia 2 del Camino del Vidente. Hace que los deseos imposibles encuentren respuesta.', iconKey: 'wand-sparkles', type: 'BEYONDER', tier: 10, isMajorDiscovery: true, categoryId: beyonder.id },
    // ----- Trinidad, profanación y el mundo de sombras -----
    { slug: 'diferenciacion', name: 'Diferenciación', description: 'La percepción que reconoce aquello que la separación vuelve distinto.', iconKey: 'layers', type: 'CONCEPTO', tier: 4, categoryId: conceptos.id },
    { slug: 'trinidad', name: 'Trinidad', description: 'Tres aspectos diferenciados que comparten una misma divinidad.', iconKey: 'triangle-alert', type: 'MISTICISMO', tier: 6, categoryId: misticismo.id },
    { slug: 'autocontrol', name: 'Autocontrol', description: 'La claridad guiada por la prudencia para dominar el propio impulso.', iconKey: 'shield', type: 'CONCEPTO', tier: 4, categoryId: conceptos.id },
    { slug: 'lenguaje', name: 'Lenguaje', description: 'Información organizada mediante un procedimiento compartido.', iconKey: 'book-open', type: 'CONCEPTO', tier: 4, categoryId: conceptos.id },
    { slug: 'profanacion', name: 'Profanación', description: 'La divinidad degradada por una degeneración persistente.', iconKey: 'triangle-alert', type: 'MISTICISMO', tier: 6, categoryId: misticismo.id },
    { slug: 'dominacion', name: 'Dominación', description: 'La fuerza ejercida a través de la influencia sobre otra voluntad.', iconKey: 'lock-keyhole', type: 'MISTICISMO', tier: 5, categoryId: misticismo.id },
    { slug: 'sombra-independiente', name: 'Sombra independiente', description: 'Una sombra separada de aquello que debía proyectarla.', iconKey: 'moon', type: 'MISTICISMO', tier: 5, categoryId: misticismo.id },
    { slug: 'sombra-dominada', name: 'Sombra dominada', description: 'Una sombra independiente sometida a una voluntad ajena.', iconKey: 'moon-star', type: 'MISTICISMO', tier: 6, categoryId: misticismo.id },
    { slug: 'continente', name: 'Continente', description: 'Dos naciones extendidas sobre una misma gran masa de tierra.', iconKey: 'landmark', type: 'MUNDANO', tier: 5, categoryId: mundano.id },
    { slug: 'mundo', name: 'Mundo', description: 'La totalidad formada por continentes, pueblos y fronteras.', iconKey: 'orbit', type: 'MUNDANO', tier: 6, categoryId: mundano.id },
    { slug: 'mundo-de-sombra', name: 'Mundo de sombra', description: 'Un mundo completo cubierto por una sombra que le pertenece.', iconKey: 'moon', type: 'MISTICISMO', tier: 7, categoryId: misticismo.id },
    { slug: 'dominio-en-el-mundo-de-sombras', name: 'Dominio en el mundo de sombras', description: 'La dominación convertida en ley dentro de un mundo de sombras.', iconKey: 'key-round', type: 'MISTICISMO', tier: 8, categoryId: misticismo.id },
    { slug: 'trinity-templar', name: 'Trinity Templar', description: 'Secuencia 3 del Camino del Suplicante de Secretos. Encarna tres aspectos de una misma carne divina.', iconKey: 'shield', type: 'BEYONDER', tier: 9, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'profane-presbyter', name: 'Profane Presbyter', description: 'Secuencia 2 del Camino del Suplicante de Secretos. Convierte la profanación en doctrina y dominio.', iconKey: 'book-key', type: 'BEYONDER', tier: 10, isMajorDiscovery: true, categoryId: beyonder.id },
    // ----- Psique y Camino del Visionario -----
    { slug: 'observacion', name: 'Observación', description: 'La atención sostenida que registra sin intervenir.', iconKey: 'eye', type: 'CONCEPTO', tier: 1, categoryId: conceptos.id },
    { slug: 'pensamiento', name: 'Pensamiento', description: 'La información procesada dentro de una mente humana.', iconKey: 'brain', type: 'CONCEPTO', tier: 2, categoryId: conceptos.id },
    { slug: 'psique', name: 'Psique', description: 'El alma organizada mediante el pensamiento consciente e inconsciente.', iconKey: 'brain', type: 'MISTICISMO', tier: 4, categoryId: misticismo.id },
    { slug: 'intervencion', name: 'Intervención', description: 'Una influencia aplicada siguiendo un procedimiento preciso.', iconKey: 'move-up-right', type: 'CONCEPTO', tier: 4, categoryId: conceptos.id },
    { slug: 'sugestion', name: 'Sugestión', description: 'Un pensamiento implantado mediante influencia.', iconKey: 'waves', type: 'MISTICISMO', tier: 4, categoryId: misticismo.id },
    { slug: 'subconsciente', name: 'Subconsciente', description: 'La parte oculta de la psique que actúa sin ser percibida.', iconKey: 'eye-off', type: 'MISTICISMO', tier: 5, categoryId: misticismo.id },
    { slug: 'punto-ciego', name: 'Punto ciego', description: 'Aquello que la percepción no alcanza debido al ocultamiento.', iconKey: 'eye-off', type: 'CONCEPTO', tier: 4, categoryId: conceptos.id },
    { slug: 'invisibilidad-psicologica', name: 'Invisibilidad psicológica', description: 'Una presencia borrada de la percepción por medio de la psique.', iconKey: 'ghost', type: 'MISTICISMO', tier: 5, categoryId: misticismo.id },
    { slug: 'sueno', name: 'Sueño', description: 'Una ilusión sostenida dentro de la psique.', iconKey: 'moon-star', type: 'MISTICISMO', tier: 5, categoryId: misticismo.id },
    { slug: 'pesadilla', name: 'Pesadilla', description: 'Un sueño invadido por la percepción del peligro.', iconKey: 'moon', type: 'MISTICISMO', tier: 6, categoryId: misticismo.id },
    { slug: 'harpia', name: 'Harpía', description: 'Una criatura espiritual nacida de una pesadilla.', iconKey: 'feather', type: 'CRIATURA', tier: 6, categoryId: misticismo.id },
    { slug: 'contrato', name: 'Contrato', description: 'Un lenguaje fijado en un registro con voluntad de permanencia.', iconKey: 'file-text', type: 'CONCEPTO', tier: 5, categoryId: conceptos.id },
    { slug: 'contrato-con-harpia', name: 'Contrato con Harpía', description: 'Un pacto formal con una criatura de las pesadillas.', iconKey: 'scroll-text', type: 'MISTICISMO', tier: 7, categoryId: misticismo.id },
    { slug: 'alegria', name: 'Alegría', description: 'La fortuna experimentada por una mente humana.', iconKey: 'sun', type: 'CONCEPTO', tier: 2, categoryId: conceptos.id },
    { slug: 'extasis', name: 'Éxtasis', description: 'La alegría intensificada por la fuerza hasta desbordar la razón.', iconKey: 'sparkles', type: 'MISTICISMO', tier: 4, categoryId: misticismo.id },
    { slug: 'ira', name: 'Ira', description: 'La respuesta humana ante una herida.', iconKey: 'flame', type: 'CONCEPTO', tier: 3, categoryId: conceptos.id },
    { slug: 'furia', name: 'Furia', description: 'La ira alimentada por la fuerza hasta perder todo límite.', iconKey: 'flame', type: 'MISTICISMO', tier: 4, categoryId: misticismo.id },
    { slug: 'mar-del-subconsciente-colectivo', name: 'Mar del Subconsciente Colectivo', description: 'Los subconscientes de una comunidad unidos en una profundidad común.', iconKey: 'waves', type: 'MISTICISMO', tier: 7, categoryId: misticismo.id },
    { slug: 'multitud', name: 'Multitud', description: 'Una comunidad aumentada por la acumulación de individuos.', iconKey: 'user-round', type: 'MUNDANO', tier: 4, categoryId: mundano.id },
    { slug: 'gran-evento', name: 'Gran evento', description: 'Una multitud coordinada mediante un procedimiento.', iconKey: 'landmark', type: 'CONCEPTO', tier: 5, categoryId: conceptos.id },
    { slug: 'estimulo', name: 'Estímulo', description: 'Una influencia percibida por la mente y el cuerpo.', iconKey: 'radar', type: 'CONCEPTO', tier: 4, categoryId: conceptos.id },
    { slug: 'emocion', name: 'Emoción', description: 'La respuesta de la psique ante un estímulo.', iconKey: 'waves', type: 'CONCEPTO', tier: 5, categoryId: conceptos.id },
    { slug: 'emocion-colectiva', name: 'Emoción colectiva', description: 'Una emoción compartida por toda una multitud.', iconKey: 'waves', type: 'MISTICISMO', tier: 6, categoryId: misticismo.id },
    { slug: 'resonancia-emocional', name: 'Resonancia emocional', description: 'La percepción amplifica y sincroniza una emoción colectiva.', iconKey: 'radar', type: 'MISTICISMO', tier: 7, categoryId: misticismo.id },
    { slug: 'imaginacion', name: 'Imaginación', description: 'El pensamiento capaz de dar forma a una ilusión.', iconKey: 'lightbulb', type: 'CONCEPTO', tier: 5, categoryId: conceptos.id },
    { slug: 'influencia-de-sueno', name: 'Influencia de sueño', description: 'Una influencia ejercida desde el interior de un sueño.', iconKey: 'moon-star', type: 'MISTICISMO', tier: 7, categoryId: misticismo.id },
    { slug: 'discernimiento', name: 'Discernimiento', description: 'La percepción afinada por la claridad para separar lo verdadero.', iconKey: 'scan-eye', type: 'CONCEPTO', tier: 6, categoryId: conceptos.id },
    { slug: 'spectator', name: 'Spectator', description: 'Secuencia 9 del Camino del Visionario. Observa la conducta sin perturbarla.', iconKey: 'eye', type: 'BEYONDER', tier: 1, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'telepathist', name: 'Telepathist', description: 'Secuencia 8 del Camino del Visionario. Percibe el pensamiento ajeno.', iconKey: 'brain', type: 'BEYONDER', tier: 2, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'psychiatrist', name: 'Psychiatrist', description: 'Secuencia 7 del Camino del Visionario. Interviene directamente sobre la psique.', iconKey: 'brain', type: 'BEYONDER', tier: 3, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'hypnotist', name: 'Hypnotist', description: 'Secuencia 6 del Camino del Visionario. Implanta sugestiones en el subconsciente.', iconKey: 'eye-off', type: 'BEYONDER', tier: 4, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'dreamwalker', name: 'Dreamwalker', description: 'Secuencia 5 del Camino del Visionario. Recorre sueños y pesadillas.', iconKey: 'moon-star', type: 'BEYONDER', tier: 5, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'manipulator', name: 'Manipulator', description: 'Secuencia 4 del Camino del Visionario. Domina el subconsciente colectivo.', iconKey: 'waves', type: 'BEYONDER', tier: 6, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'dream-weaver', name: 'Dream Weaver', description: 'Secuencia 3 del Camino del Visionario. Teje imaginación y sueño en una sola realidad.', iconKey: 'wand-sparkles', type: 'BEYONDER', tier: 7, isMajorDiscovery: true, categoryId: beyonder.id },
    { slug: 'discerner', name: 'Discerner', description: 'Secuencia 2 del Camino del Visionario. Distingue la verdad dentro de cualquier psique.', iconKey: 'scan-eye', type: 'BEYONDER', tier: 8, isMajorDiscovery: true, categoryId: beyonder.id },
  ]

  const bySlug = new Map<string, { id: string }>()
  for (const def of defs) {
    const { categoryId, ...data } = def
    const element = await prisma.element.upsert({
      where: { slug: def.slug },
      update: {},
      create: {
        ...data,
        isStarter: data.isStarter ?? false,
        isHiddenUntilDiscovered: data.isHiddenUntilDiscovered ?? true,
        isMajorDiscovery: data.isMajorDiscovery ?? false,
      },
    })
    bySlug.set(def.slug, element)
    await prisma.elementCategory.upsert({
      where: { elementId_categoryId: { elementId: element.id, categoryId } },
      update: {},
      create: { elementId: element.id, categoryId, isPrimary: true },
    })
  }

  const id = (slug: string) => {
    const e = bySlug.get(slug)
    if (!e) throw new Error(`Elemento del seed no encontrado: ${slug}`)
    return e.id
  }

  await prisma.elementUnlockTrigger.upsert({
    where: {
      elementId_triggerId: {
        elementId: id('mundo-espiritual'),
        triggerId: id('proyeccion-astral'),
      },
    },
    update: {},
    create: {
      elementId: id('mundo-espiritual'),
      triggerId: id('proyeccion-astral'),
    },
  })
  const caminoVisionario = await prisma.pathway.upsert({
    where: { slug: 'camino-del-visionario' },
    update: {},
    create: {
      slug: 'camino-del-visionario',
      name: 'Camino del Visionario',
      description: 'La senda que observa, comprende y finalmente gobierna la mente y los sueños.',
      categoryId: beyonder.id,
      iconKey: 'brain',
      isHiddenUntilDiscovered: true,
    },
  })

  // ---------- Secuencias ----------
  const secuencias: { camino: { id: string }; number: number; name: string; slug: string }[] = [
    { camino: caminoVidente, number: 9, name: 'Seer', slug: 'seer' },
    {
      camino: caminoSuplicante,
      number: 9,
      name: 'Secret Suplicant',
      slug: 'secret-suplicant',
    },
    { camino: caminoMonstruo, number: 9, name: 'Monster', slug: 'monster' },
    { camino: caminoMonstruo, number: 8, name: 'Robot', slug: 'robot' },
    { camino: caminoVidente, number: 8, name: 'Clown', slug: 'clown' },
    {
      camino: caminoSuplicante,
      number: 8,
      name: 'Listener',
      slug: 'listener',
    },
    { camino: caminoVidente, number: 7, name: 'Mago', slug: 'mago' },
    { camino: caminoMonstruo, number: 7, name: 'Lucky One', slug: 'lucky-one' },
    {
      camino: caminoSuplicante,
      number: 7,
      name: 'Shadow Ascetic',
      slug: 'shadow-ascetic',
    },
    {
      camino: caminoMonstruo,
      number: 6,
      name: 'Calamity Priest',
      slug: 'calamity-priest',
    },
    { camino: caminoVidente, number: 6, name: 'Faceless', slug: 'faceless' },
    {
      camino: caminoSuplicante,
      number: 6,
      name: 'Rose Bishop',
      slug: 'rose-bishop',
    },
    {
      camino: caminoSuplicante,
      number: 5,
      name: 'Shepherd',
      slug: 'shepherd',
    },
    {
      camino: caminoVidente,
      number: 5,
      name: 'Marionetista',
      slug: 'marionetista',
    },
    {
      camino: caminoMonstruo,
      number: 5,
      name: 'Winner',
      slug: 'winner',
    },
    {
      camino: caminoVidente,
      number: 4,
      name: 'Bizarro Sorcerer',
      slug: 'bizarro-sorcerer',
    },
    {
      camino: caminoSuplicante,
      number: 4,
      name: 'Black Knight',
      slug: 'black-knight',
    },
    { camino: caminoMonstruo, number: 4, name: 'Misfortune Mage', slug: 'misfortune-mage' },
    { camino: caminoMonstruo, number: 3, name: 'Chaoswalker', slug: 'chaoswalker' },
    { camino: caminoMonstruo, number: 2, name: 'Soothsayer', slug: 'soothsayer' },
    { camino: caminoVidente, number: 3, name: 'Scholar of Yore', slug: 'scholar-of-yore' },
    { camino: caminoVidente, number: 2, name: 'Invocador de Milagros', slug: 'miracle-invoker' },
    { camino: caminoSuplicante, number: 3, name: 'Trinity Templar', slug: 'trinity-templar' },
    { camino: caminoSuplicante, number: 2, name: 'Profane Presbyter', slug: 'profane-presbyter' },
    { camino: caminoVisionario, number: 9, name: 'Spectator', slug: 'spectator' },
    { camino: caminoVisionario, number: 8, name: 'Telepathist', slug: 'telepathist' },
    { camino: caminoVisionario, number: 7, name: 'Psychiatrist', slug: 'psychiatrist' },
    { camino: caminoVisionario, number: 6, name: 'Hypnotist', slug: 'hypnotist' },
    { camino: caminoVisionario, number: 5, name: 'Dreamwalker', slug: 'dreamwalker' },
    { camino: caminoVisionario, number: 4, name: 'Manipulator', slug: 'manipulator' },
    { camino: caminoVisionario, number: 3, name: 'Dream Weaver', slug: 'dream-weaver' },
    { camino: caminoVisionario, number: 2, name: 'Discerner', slug: 'discerner' },
  ]
  const sequenceBySlug = new Map<string, { id: string }>()
  for (const s of secuencias) {
    const sequence = await prisma.sequence.upsert({
      where: { elementId: id(s.slug) },
      update: {},
      create: {
        pathwayId: s.camino.id,
        number: s.number,
        name: s.name,
        elementId: id(s.slug),
      },
    })
    sequenceBySlug.set(s.slug, sequence)
  }

  // ---------- Recetas ----------
  const recetas: { ings: [string, number][]; outputs: string[] }[] = [
    // Camino del Vidente
    { ings: [['ojo', 2]], outputs: ['vision'] },
    { ings: [['vision', 1], ['ojo', 1]], outputs: ['percepcion'] },
    { ings: [['moneda', 2]], outputs: ['fortuna'] },
    { ings: [['fortuna', 1], ['moneda', 1]], outputs: ['adivinacion'] },
    { ings: [['adivinacion', 1], ['percepcion', 1]], outputs: ['seer'] },
    // Camino del Suplicante de Secretos
    { ings: [['humano', 2]], outputs: ['susurro', 'familia', 'vinculo'] },
    { ings: [['susurro', 1], ['ojo', 1]], outputs: ['secreto'] },
    { ings: [['secreto', 1], ['humano', 1]], outputs: ['secret-suplicant'] },
    // Camino del Monstruo
    { ings: [['humano', 1], ['moneda', 1]], outputs: ['apuesta', 'trabajo'] },
    { ings: [['apuesta', 1], ['moneda', 1]], outputs: ['destino'] },
    { ings: [['destino', 1], ['humano', 1]], outputs: ['monster'] },
    // Cadena del Ocultamiento
    { ings: [['experiencia-2', 1], ['conocimiento', 1]], outputs: ['prudencia'] },
    { ings: [['prudencia', 1], ['informacion', 1]], outputs: ['reserva'] },
    { ings: [['reserva', 1], ['vision', 1]], outputs: ['ocultamiento'] },
    // Trabajo, peligro y control corporal
    { ings: [['trabajo', 1], ['tiempo', 1]], outputs: ['esfuerzo'] },
    { ings: [['humano', 1], ['esfuerzo', 1]], outputs: ['fuerza', 'desgaste'] },
    { ings: [['muerte', 1], ['percepcion', 1]], outputs: ['peligro'] },
    { ings: [['peligro', 1], ['intuicion', 1]], outputs: ['danger-intuition'] },
    { ings: [['fuerza', 1], ['experiencia-2', 1]], outputs: ['control-corporal'] },
    {
      ings: [['peligro', 1], ['misticismo', 1]],
      outputs: ['existencia-oculta', 'revelacion-prohibida'],
    },
    { ings: [['revelacion-prohibida', 1], ['humano', 1]], outputs: ['locura'] },
    // Escucha, magia, incertidumbre y suerte
    { ings: [['humano', 1], ['percepcion', 1]], outputs: ['escucha'] },
    { ings: [['misticismo', 1], ['conocimiento', 1]], outputs: ['magia'] },
    { ings: [['percepcion', 1], ['magia', 1]], outputs: ['ilusion'] },
    { ings: [['adivinacion', 1], ['tiempo', 1]], outputs: ['destino'] },
    { ings: [['informacion', 1], ['ocultamiento', 1]], outputs: ['incertidumbre'] },
    { ings: [['destino', 1], ['incertidumbre', 1]], outputs: ['suerte'] },
    // Cambio cualitativo, sombras y carne
    { ings: [['beyonder', 1], ['tiempo', 1]], outputs: ['avance'] },
    { ings: [['avance', 1], ['fuerza', 1]], outputs: ['cambio-cualitativo'] },
    {
      ings: [['secuencia-media', 1], ['cambio-cualitativo', 1]],
      outputs: ['divinidad', 'saint', 'demigod'],
    },
    { ings: [['conocimiento', 1], ['percepcion', 1]], outputs: ['claridad'] },
    { ings: [['claridad', 1], ['misticismo', 1]], outputs: ['luz'] },
    { ings: [['vision', 1], ['ocultamiento', 1]], outputs: ['silueta'] },
    { ings: [['silueta', 1], ['luz', 1]], outputs: ['sombra'] },
    { ings: [['peligro', 1], ['cambio-cualitativo', 1]], outputs: ['calamidad'] },
    { ings: [['peligro', 1], ['fuerza', 1]], outputs: ['desastre'] },
    { ings: [['humano', 1], ['ocultamiento', 1]], outputs: ['disfraz'] },
    { ings: [['humano', 1], ['muerte', 1]], outputs: ['carne', 'espiritu'] },
    { ings: [['carne', 1], ['fuerza', 1]], outputs: ['herida'] },
    { ings: [['carne', 1], ['herida', 1]], outputs: ['sangre'] },
    { ings: [['carne', 1], ['sangre', 1]], outputs: ['carne-y-sangre'] },
    { ings: [['espiritu', 1], ['experiencia-2', 1]], outputs: ['alma'] },
    { ings: [['desgaste', 1], ['tiempo', 1]], outputs: ['hambre'] },
    { ings: [['hambre', 1], ['carne', 1]], outputs: ['devoracion'] },
    { ings: [['informacion', 1], ['percepcion', 1]], outputs: ['influencia'] },
    // Cadena del Mar y la Sirena
    { ings: [['moneda', 1], ['tiempo', 1]], outputs: ['acumulacion'] },
    { ings: [['agua', 1], ['acumulacion', 1]], outputs: ['mar'] },
    { ings: [['carne', 1], ['alma', 1]], outputs: ['criatura'] },
    { ings: [['criatura', 1], ['beyonder', 1]], outputs: ['criatura-beyonder'] },
    { ings: [['escucha', 1], ['tiempo', 1]], outputs: ['ritmo'] },
    { ings: [['ritmo', 1], ['humano', 1]], outputs: ['canto'] },
    { ings: [['criatura-beyonder', 1], ['mar', 1]], outputs: ['criatura-beyonder-acuatica'] },
    { ings: [['criatura-beyonder-acuatica', 1], ['canto', 1]], outputs: ['sirena'] },
    // Cadena del Cuerpo Espiritual y la Marioneta
    { ings: [['humano', 1], ['misticismo', 1]], outputs: ['cuerpo-espiritual', 'espiritualidad'] },
    { ings: [['tiempo', 2]], outputs: ['continuidad'] },
    { ings: [['silueta', 1], ['avance', 1]], outputs: ['proyeccion'] },
    { ings: [['proyeccion', 1], ['continuidad', 1]], outputs: ['extension'] },
    { ings: [['cuerpo-espiritual', 1], ['extension', 1]], outputs: ['hilos-del-cuerpo-espiritual'] },
    { ings: [['hilos-del-cuerpo-espiritual', 1], ['influencia', 1]], outputs: ['marioneta'] },
    { ings: [['suerte', 1], ['desastre', 1]], outputs: ['mala-suerte'] },
    { ings: [['informacion', 1], ['trabajo', 1]], outputs: ['procedimiento'] },
    { ings: [['procedimiento', 1], ['misticismo', 1]], outputs: ['ritual'] },
    { ings: [['ritual', 1], ['existencia-oculta', 1]], outputs: ['rezar', 'sacrificio', 'otorgamiento'] },
    // Bendición y memoria histórica
    { ings: [['existencia-oculta', 1], ['sacrificio', 1]], outputs: ['bendicion'] },
    { ings: [['existencia-oculta', 1], ['rezar', 1]], outputs: ['bendicion'] },
    { ings: [['registro', 1], ['tiempo', 1]], outputs: ['historia'] },
    // Vínculos, separación y milagros
    { ings: [['vinculo', 1], ['fuerza', 1]], outputs: ['ruptura'] },
    { ings: [['ruptura', 1], ['tiempo', 1]], outputs: ['separacion'] },
    { ings: [['continuidad', 1], ['tiempo', 1]], outputs: ['era'] },
    { ings: [['vinculo', 1], ['separacion', 1]], outputs: ['ausencia'] },
    { ings: [['ausencia', 1], ['percepcion', 1]], outputs: ['deseo'] },
    { ings: [['deseo', 1], ['cambio-cualitativo', 1]], outputs: ['milagro'] },
    // Mundo espiritual e invocación
    { ings: [['cuerpo-espiritual', 1], ['proyeccion', 1]], outputs: ['proyeccion-astral'] },
    { ings: [['proyeccion-astral', 1], ['misticismo', 1]], outputs: ['mundo-espiritual'] },
    { ings: [['mundo-espiritual', 1], ['criatura', 1]], outputs: ['criatura-espiritual'] },
    { ings: [['criatura-espiritual', 1], ['registro', 1]], outputs: ['descripcion-espiritual'] },
    { ings: [['descripcion-espiritual', 1], ['ritual', 1]], outputs: ['invocacion'] },
    { ings: [['beyonder', 1], ['invocacion', 1]], outputs: ['invocador'] },
    // Destino, ley y los planos superiores
    { ings: [['destino', 1], ['continuidad', 1]], outputs: ['ciclo'] },
    { ings: [['ciclo', 1], ['tiempo', 1]], outputs: ['retorno'] },
    { ings: [['influencia', 1], ['tiempo', 1]], outputs: ['consecuencia'] },
    { ings: [['consecuencia', 1], ['destino', 1]], outputs: ['inevitabilidad'] },
    { ings: [['ciudad', 2]], outputs: ['nacion'] },
    { ings: [['informacion', 1], ['misticismo', 1]], outputs: ['simbolismo'] },
    { ings: [['simbolismo', 1], ['divinidad', 1]], outputs: ['mundo-astral'] },
    { ings: [['agua', 2]], outputs: ['rio'] },
    { ings: [['rio', 1], ['destino', 1]], outputs: ['river-of-fate'] },
    { ings: [['comunidad', 1], ['procedimiento', 1]], outputs: ['ley'] },
    { ings: [['ley', 1], ['ciudad', 1]], outputs: ['orden'] },
    { ings: [['orden', 1], ['corrupcion', 1]], outputs: ['distorsion'] },
    { ings: [['distorsion', 1], ['incertidumbre', 1]], outputs: ['desorden'] },
    { ings: [['adivinacion', 1], ['destino', 1]], outputs: ['revelacion'] },
    { ings: [['revelacion', 1], ['registro', 1]], outputs: ['profecia'] },
    // Trinidad, profanación y dominio de sombras
    { ings: [['percepcion', 1], ['separacion', 1]], outputs: ['diferenciacion'] },
    { ings: [['diferenciacion', 1], ['divinidad', 1]], outputs: ['trinidad'] },
    { ings: [['claridad', 1], ['prudencia', 1]], outputs: ['autocontrol'] },
    { ings: [['informacion', 1], ['procedimiento', 1]], outputs: ['lenguaje'] },
    { ings: [['divinidad', 1], ['degeneracion', 1]], outputs: ['profanacion'] },
    { ings: [['fuerza', 1], ['influencia', 1]], outputs: ['dominacion'] },
    { ings: [['sombra', 1], ['separacion', 1]], outputs: ['sombra-independiente'] },
    { ings: [['sombra-independiente', 1], ['dominacion', 1]], outputs: ['sombra-dominada'] },
    { ings: [['nacion', 2]], outputs: ['continente'] },
    { ings: [['continente', 2]], outputs: ['mundo'] },
    { ings: [['mundo', 1], ['sombra', 1]], outputs: ['mundo-de-sombra'] },
    { ings: [['mundo-de-sombra', 1], ['dominacion', 1]], outputs: ['dominio-en-el-mundo-de-sombras'] },
    // Psique, emociones y Camino del Visionario
    { ings: [['observacion', 1], ['prudencia', 1]], outputs: ['spectator'] },
    { ings: [['humano', 1], ['informacion', 1]], outputs: ['pensamiento'] },
    { ings: [['alma', 1], ['pensamiento', 1]], outputs: ['psique'] },
    { ings: [['influencia', 1], ['procedimiento', 1]], outputs: ['intervencion'] },
    { ings: [['pensamiento', 1], ['influencia', 1]], outputs: ['sugestion'] },
    { ings: [['psique', 1], ['ocultamiento', 1]], outputs: ['subconsciente'] },
    { ings: [['percepcion', 1], ['ocultamiento', 1]], outputs: ['punto-ciego'] },
    { ings: [['punto-ciego', 1], ['psique', 1]], outputs: ['invisibilidad-psicologica'] },
    { ings: [['psique', 1], ['ilusion', 1]], outputs: ['sueno'] },
    { ings: [['sueno', 1], ['peligro', 1]], outputs: ['pesadilla'] },
    { ings: [['cuerpo-espiritual', 1], ['criatura', 1]], outputs: ['criatura-espiritual'] },
    { ings: [['criatura-espiritual', 1], ['pesadilla', 1]], outputs: ['harpia'] },
    { ings: [['lenguaje', 1], ['registro', 1]], outputs: ['contrato'] },
    { ings: [['harpia', 1], ['contrato', 1]], outputs: ['contrato-con-harpia'] },
    { ings: [['humano', 1], ['fortuna', 1]], outputs: ['alegria'] },
    { ings: [['alegria', 1], ['fuerza', 1]], outputs: ['extasis'] },
    { ings: [['humano', 1], ['herida', 1]], outputs: ['ira'] },
    { ings: [['ira', 1], ['fuerza', 1]], outputs: ['furia'] },
    { ings: [['subconsciente', 1], ['comunidad', 1]], outputs: ['mar-del-subconsciente-colectivo'] },
    { ings: [['comunidad', 1], ['acumulacion', 1]], outputs: ['multitud'] },
    { ings: [['multitud', 1], ['procedimiento', 1]], outputs: ['gran-evento'] },
    { ings: [['percepcion', 1], ['influencia', 1]], outputs: ['estimulo'] },
    { ings: [['psique', 1], ['estimulo', 1]], outputs: ['emocion'] },
    { ings: [['emocion', 1], ['multitud', 1]], outputs: ['emocion-colectiva'] },
    { ings: [['emocion-colectiva', 1], ['percepcion', 1]], outputs: ['resonancia-emocional'] },
    { ings: [['pensamiento', 1], ['ilusion', 1]], outputs: ['imaginacion'] },
    { ings: [['sueno', 1], ['influencia', 1]], outputs: ['influencia-de-sueno'] },
    { ings: [['percepcion', 1], ['claridad', 1]], outputs: ['discernimiento'] },
    // Cadena de la Corrupción, el Guerrero y la Comunidad
    { ings: [['locura', 1], ['beyonder', 1]], outputs: ['perdida-de-control', 'corrupcion'] },
    { ings: [['corrupcion', 1], ['tiempo', 1]], outputs: ['degeneracion'] },
    { ings: [['humano', 1], ['fuerza', 1]], outputs: ['guerrero'] },
    { ings: [['experiencia-2', 1], ['guerrero', 1]], outputs: ['caballero'] },
    { ings: [['familia', 2]], outputs: ['comunidad'] },
    { ings: [['comunidad', 2]], outputs: ['ciudad'] },
  ]

  for (const r of recetas) {
    const inputKey = buildRecipeInputKey(
      r.ings.map(([slug, quantity]) => ({ slug, quantity })),
    )
    const recipe = await prisma.recipe.upsert({
      where: { inputKey },
      update: {},
      create: {
        inputKey,
        ingredients: {
          create: r.ings.map(([slug, quantity]) => ({
            elementId: id(slug),
            quantity,
          })),
        },
        outputs: {
          create: r.outputs.map((output, sortOrder) => ({
            elementId: id(output),
            quantity: 1,
            chance: 1.0,
            sortOrder,
          })),
        },
      },
    })
    for (const [sortOrder, output] of r.outputs.entries()) {
      await prisma.recipeOutput.upsert({
        where: { recipeId_elementId: { recipeId: recipe.id, elementId: id(output) } },
        update: { sortOrder },
        create: {
          recipeId: recipe.id,
          elementId: id(output),
          quantity: 1,
          chance: 1.0,
          sortOrder,
        },
      })
    }
  }

  // ---------- Avances ----------
  const avances = [
    {
      internalName: 'Avance a Robot',
      ingredients: ['fuerza', 'adivinacion'],
      source: 'monster',
      target: 'robot',
    },
    {
      internalName: 'Avance a Clown',
      ingredients: ['control-corporal', 'danger-intuition'],
      source: 'seer',
      target: 'clown',
    },
    {
      internalName: 'Avance a Listener',
      ingredients: ['escucha', 'locura'],
      source: 'secret-suplicant',
      target: 'listener',
    },
    {
      internalName: 'Avance a Mago',
      ingredients: ['ilusion', 'magia'],
      source: 'clown',
      target: 'mago',
    },
    {
      internalName: 'Avance a Lucky One',
      ingredients: ['suerte', 'cambio-cualitativo'],
      source: 'robot',
      target: 'lucky-one',
    },
    {
      internalName: 'Avance a Shadow Ascetic',
      ingredients: ['ocultamiento', 'sombra'],
      source: 'listener',
      target: 'shadow-ascetic',
    },
    {
      internalName: 'Avance a Calamity Priest',
      ingredients: ['danger-intuition', 'calamidad'],
      source: 'lucky-one',
      target: 'calamity-priest',
    },
    {
      internalName: 'Avance a Faceless',
      ingredients: ['disfraz', 'control-corporal'],
      source: 'mago',
      target: 'faceless',
    },
    {
      internalName: 'Avance a Rose Bishop',
      ingredients: ['carne-y-sangre', 'magia'],
      source: 'shadow-ascetic',
      target: 'rose-bishop',
    },
    {
      internalName: 'Avance a Shepherd',
      ingredients: ['devoracion', 'alma'],
      source: 'rose-bishop',
      target: 'shepherd',
    },
    {
      internalName: 'Avance a Marionetista',
      ingredients: ['hilos-del-cuerpo-espiritual', 'marioneta'],
      source: 'faceless',
      target: 'marionetista',
    },
    {
      internalName: 'Avance a Winner',
      ingredients: ['suerte', 'fortuna'],
      source: 'calamity-priest',
      target: 'winner',
    },
    {
      internalName: 'Avance a Bizarro Sorcerer',
      ingredients: ['otorgamiento', 'marioneta'],
      source: 'marionetista',
      target: 'bizarro-sorcerer',
    },
    {
      internalName: 'Avance a Black Knight',
      ingredients: ['degeneracion', 'caballero'],
      source: 'shepherd',
      target: 'black-knight',
    },
    {
      internalName: 'Avance a Misfortune Mage',
      ingredients: ['bendicion', 'mala-suerte'],
      source: 'winner',
      target: 'misfortune-mage',
    },
    {
      internalName: 'Avance a Scholar of Yore',
      ingredients: ['proyeccion', 'historia'],
      source: 'bizarro-sorcerer',
      target: 'scholar-of-yore',
    },
    {
      internalName: 'Avance a Invocador de Milagros',
      ingredients: ['invocador', 'milagro'],
      source: 'scholar-of-yore',
      target: 'miracle-invoker',
    },
    {
      internalName: 'Avance a Chaoswalker',
      ingredients: ['desorden', 'destino'],
      source: 'misfortune-mage',
      target: 'chaoswalker',
    },
    {
      internalName: 'Avance a Soothsayer',
      ingredients: ['profecia', 'mundo-espiritual'],
      source: 'chaoswalker',
      target: 'soothsayer',
    },
    {
      internalName: 'Avance a Trinity Templar',
      ingredients: ['trinidad', 'carne-y-sangre'],
      source: 'black-knight',
      target: 'trinity-templar',
    },
    {
      internalName: 'Avance a Profane Presbyter',
      ingredients: ['lenguaje', 'profanacion'],
      source: 'trinity-templar',
      target: 'profane-presbyter',
    },
    {
      internalName: 'Avance a Telepathist',
      ingredients: ['pensamiento', 'percepcion'],
      source: 'spectator',
      target: 'telepathist',
    },
    {
      internalName: 'Avance a Psychiatrist',
      ingredients: ['psique', 'intervencion'],
      source: 'telepathist',
      target: 'psychiatrist',
    },
    {
      internalName: 'Avance a Hypnotist',
      ingredients: ['sugestion', 'subconsciente'],
      source: 'psychiatrist',
      target: 'hypnotist',
    },
    {
      internalName: 'Avance a Dreamwalker',
      ingredients: ['sueno', 'proyeccion-astral'],
      source: 'hypnotist',
      target: 'dreamwalker',
    },
    {
      internalName: 'Avance a Manipulator',
      ingredients: ['dominacion', 'mar-del-subconsciente-colectivo'],
      source: 'dreamwalker',
      target: 'manipulator',
    },
    {
      internalName: 'Avance a Dream Weaver',
      ingredients: ['sueno', 'imaginacion'],
      source: 'manipulator',
      target: 'dream-weaver',
    },
    {
      internalName: 'Avance a Discerner',
      ingredients: ['discernimiento', 'psique'],
      source: 'dream-weaver',
      target: 'discerner',
    },
  ]
  const advanceByName = new Map<string, { id: string }>()
  for (const advance of avances) {
    const sourceSequence = sequenceBySlug.get(advance.source)
    const targetSequence = sequenceBySlug.get(advance.target)
    if (!sourceSequence || !targetSequence) {
      throw new Error(`Secuencias del avance no encontradas: ${advance.internalName}`)
    }
    const inputKey = buildRecipeInputKey(
      advance.ingredients.map((slug) => ({ slug, quantity: 1 })),
    )
    const savedAdvance = await prisma.advance.upsert({
      where: { inputKey },
      update: {},
      create: {
        internalName: advance.internalName,
        inputKey,
        sourceSequenceId: sourceSequence.id,
        targetSequenceId: targetSequence.id,
        ingredients: {
          create: advance.ingredients.map((slug) => ({ elementId: id(slug), quantity: 1 })),
        },
      },
    })
    advanceByName.set(advance.internalName, savedAdvance)
  }

  // ---------- Rituales ----------
  const shepherdAdvance = advanceByName.get('Avance a Shepherd')
  if (!shepherdAdvance) throw new Error('No se encontró el avance a Shepherd para su ritual.')
  const ritualInputKey = buildRecipeInputKey([
    { slug: 'influencia', quantity: 1 },
    { slug: 'alma', quantity: 1 },
  ])
  await prisma.ritual.upsert({
    where: { inputKey: ritualInputKey },
    update: {},
    create: {
      name: 'Ritual de avance a Shepherd',
      inputKey: ritualInputKey,
      advanceId: shepherdAdvance.id,
      requiredSequenceNumber: 6,
      ingredients: {
        create: [
          { elementId: id('influencia'), quantity: 1 },
          { elementId: id('alma'), quantity: 1 },
        ],
      },
      failureOutputs: {
        create: [
          { elementId: id('perdida-de-control') },
          { elementId: id('monstruo-descontrol') },
          { elementId: id('corrupcion-de-alborotador') },
        ],
      },
    },
  })

  const marionetistaAdvance = advanceByName.get('Avance a Marionetista')
  if (!marionetistaAdvance) throw new Error('No se encontró el avance a Marionetista para su ritual.')
  const marionetistaRitualKey = buildRecipeInputKey([
    { slug: 'sirena', quantity: 1 },
    { slug: 'canto', quantity: 1 },
  ])
  await prisma.ritual.upsert({
    where: { inputKey: marionetistaRitualKey },
    update: {},
    create: {
      name: 'Ritual de avance a Marionetista',
      inputKey: marionetistaRitualKey,
      advanceId: marionetistaAdvance.id,
      requiredSequenceNumber: 6,
      ingredients: {
        create: [
          { elementId: id('sirena'), quantity: 1 },
          { elementId: id('canto'), quantity: 1 },
        ],
      },
      failureOutputs: {
        create: [
          { elementId: id('perdida-de-control') },
          { elementId: id('monstruo-descontrol') },
          { elementId: id('corrupcion-de-alborotador') },
        ],
      },
    },
  })

  const winnerAdvance = advanceByName.get('Avance a Winner')
  if (!winnerAdvance) throw new Error('No se encontró el avance a Winner para su ritual.')
  const winnerRitualKey = buildRecipeInputKey([
    { slug: 'mala-suerte', quantity: 1 },
    { slug: 'tiempo', quantity: 1 },
  ])
  await prisma.ritual.upsert({
    where: { inputKey: winnerRitualKey },
    update: {},
    create: {
      name: 'Ritual de avance a Winner',
      inputKey: winnerRitualKey,
      advanceId: winnerAdvance.id,
      requiredSequenceNumber: 6,
      ingredients: {
        create: [
          { elementId: id('mala-suerte'), quantity: 1 },
          { elementId: id('tiempo'), quantity: 1 },
        ],
      },
      failureOutputs: {
        create: [
          { elementId: id('perdida-de-control') },
          { elementId: id('monstruo-descontrol') },
          { elementId: id('corrupcion-de-alborotador') },
        ],
      },
    },
  })

  const bizarroAdvance = advanceByName.get('Avance a Bizarro Sorcerer')
  if (!bizarroAdvance) throw new Error('No se encontró el avance a Bizarro Sorcerer para su ritual.')
  const bizarroRitualKey = buildRecipeInputKey([
    { slug: 'demigod', quantity: 1 },
    { slug: 'muerte', quantity: 1 },
  ])
  await prisma.ritual.upsert({
    where: { inputKey: bizarroRitualKey },
    update: {},
    create: {
      name: 'Ritual de avance a Bizarro Sorcerer',
      inputKey: bizarroRitualKey,
      advanceId: bizarroAdvance.id,
      requiredSequenceNumber: 5,
      ingredients: {
        create: [
          { elementId: id('demigod'), quantity: 1 },
          { elementId: id('muerte'), quantity: 1 },
        ],
      },
      failureOutputs: {
        create: [
          { elementId: id('perdida-de-control') },
          { elementId: id('monstruo-descontrol') },
          { elementId: id('corrupcion-de-alborotador') },
        ],
      },
    },
  })

  const blackKnightAdvance = advanceByName.get('Avance a Black Knight')
  if (!blackKnightAdvance) throw new Error('No se encontró el avance a Black Knight para su ritual.')
  const blackKnightRitualKey = buildRecipeInputKey([
    { slug: 'comunidad', quantity: 1 },
    { slug: 'degeneracion', quantity: 1 },
  ])
  await prisma.ritual.upsert({
    where: { inputKey: blackKnightRitualKey },
    update: {},
    create: {
      name: 'Ritual de avance a Black Knight',
      inputKey: blackKnightRitualKey,
      advanceId: blackKnightAdvance.id,
      requiredSequenceNumber: 5,
      ingredients: {
        create: [
          { elementId: id('comunidad'), quantity: 1 },
          { elementId: id('degeneracion'), quantity: 1 },
        ],
      },
      failureOutputs: {
        create: [
          { elementId: id('perdida-de-control') },
          { elementId: id('monstruo-descontrol') },
          { elementId: id('corrupcion-de-alborotador') },
        ],
      },
    },
  })

  const nuevosRituales = [
    {
      name: 'Ritual de avance a Misfortune Mage',
      advanceName: 'Avance a Misfortune Mage',
      ingredients: ['calamidad', 'mala-suerte'],
      requiredSequenceNumber: 5,
    },
    {
      name: 'Ritual de avance a Scholar of Yore',
      advanceName: 'Avance a Scholar of Yore',
      ingredients: ['era', 'separacion'],
      requiredSequenceNumber: 4,
    },
    {
      name: 'Ritual de avance a Chaoswalker',
      advanceName: 'Avance a Chaoswalker',
      ingredients: ['inevitabilidad', 'destino'],
      requiredSequenceNumber: 4,
    },
    {
      name: 'Ritual de avance a Soothsayer',
      advanceName: 'Avance a Soothsayer',
      ingredients: ['river-of-fate', 'nacion'],
      requiredSequenceNumber: 3,
    },
    {
      name: 'Ritual de avance a Trinity Templar',
      advanceName: 'Avance a Trinity Templar',
      ingredients: ['separacion', 'autocontrol'],
      requiredSequenceNumber: 4,
    },
    {
      name: 'Ritual de avance a Profane Presbyter',
      advanceName: 'Avance a Profane Presbyter',
      ingredients: ['dominio-en-el-mundo-de-sombras', 'sombra-dominada'],
      requiredSequenceNumber: 3,
    },
    {
      name: 'Ritual de avance a Hypnotist',
      advanceName: 'Avance a Hypnotist',
      ingredients: ['gran-evento', 'resonancia-emocional'],
      requiredSequenceNumber: 7,
    },
    {
      name: 'Ritual de Dreamwalker: Éxtasis',
      advanceName: 'Avance a Dreamwalker',
      ingredients: ['contrato-con-harpia', 'extasis'],
      requiredSequenceNumber: 6,
    },
    {
      name: 'Ritual de Dreamwalker: Furia',
      advanceName: 'Avance a Dreamwalker',
      ingredients: ['contrato-con-harpia', 'furia'],
      requiredSequenceNumber: 6,
    },
    {
      name: 'Ritual de avance a Dream Weaver',
      advanceName: 'Avance a Dream Weaver',
      ingredients: ['comunidad', 'influencia-de-sueno'],
      requiredSequenceNumber: 4,
    },
    {
      name: 'Ritual de avance a Discerner',
      advanceName: 'Avance a Discerner',
      ingredients: ['mar-del-subconsciente-colectivo', 'discernimiento'],
      requiredSequenceNumber: 3,
    },
  ]
  for (const ritual of nuevosRituales) {
    const advance = advanceByName.get(ritual.advanceName)
    if (!advance) throw new Error(`No se encontró ${ritual.advanceName} para su ritual.`)
    const inputKey = buildRecipeInputKey(
      ritual.ingredients.map((slug) => ({ slug, quantity: 1 })),
    )
    await prisma.ritual.upsert({
      where: { inputKey },
      update: {},
      create: {
        name: ritual.name,
        inputKey,
        advanceId: advance.id,
        requiredSequenceNumber: ritual.requiredSequenceNumber,
        ingredients: {
          create: ritual.ingredients.map((slug) => ({ elementId: id(slug), quantity: 1 })),
        },
        failureOutputs: {
          create: [
            { elementId: id('perdida-de-control') },
            { elementId: id('monstruo-descontrol') },
            { elementId: id('corrupcion-de-alborotador') },
          ],
        },
      },
    })
  }
}
