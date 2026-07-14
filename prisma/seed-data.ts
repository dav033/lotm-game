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
      slug: 'vidente',
      name: 'Vidente',
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
      slug: 'suplicante-de-secretos',
      name: 'Suplicante de Secretos',
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
      slug: 'monstruo',
      name: 'Monstruo',
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

  // ---------- Secuencias ----------
  const secuencias: { camino: { id: string }; number: number; name: string; slug: string }[] = [
    { camino: caminoVidente, number: 9, name: 'Vidente', slug: 'vidente' },
    {
      camino: caminoSuplicante,
      number: 9,
      name: 'Suplicante de Secretos',
      slug: 'suplicante-de-secretos',
    },
    { camino: caminoMonstruo, number: 9, name: 'Monstruo', slug: 'monstruo' },
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
    { ings: [['adivinacion', 1], ['percepcion', 1]], outputs: ['vidente'] },
    // Camino del Suplicante de Secretos
    { ings: [['humano', 2]], outputs: ['susurro'] },
    { ings: [['susurro', 1], ['ojo', 1]], outputs: ['secreto'] },
    { ings: [['secreto', 1], ['humano', 1]], outputs: ['suplicante-de-secretos'] },
    // Camino del Monstruo
    { ings: [['humano', 1], ['moneda', 1]], outputs: ['apuesta', 'trabajo'] },
    { ings: [['apuesta', 1], ['moneda', 1]], outputs: ['destino'] },
    { ings: [['destino', 1], ['humano', 1]], outputs: ['monstruo'] },
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
    { ings: [['humano', 1], ['ocultamiento', 1]], outputs: ['disfraz'] },
    { ings: [['humano', 1], ['muerte', 1]], outputs: ['carne', 'espiritu'] },
    { ings: [['carne', 1], ['fuerza', 1]], outputs: ['herida'] },
    { ings: [['carne', 1], ['herida', 1]], outputs: ['sangre'] },
    { ings: [['carne', 1], ['sangre', 1]], outputs: ['carne-y-sangre'] },
    { ings: [['espiritu', 1], ['experiencia-2', 1]], outputs: ['alma'] },
    { ings: [['desgaste', 1], ['tiempo', 1]], outputs: ['hambre'] },
    { ings: [['hambre', 1], ['carne', 1]], outputs: ['devoracion'] },
    { ings: [['informacion', 1], ['percepcion', 1]], outputs: ['influencia'] },
  ]

  for (const r of recetas) {
    const inputKey = buildRecipeInputKey(
      r.ings.map(([slug, quantity]) => ({ slug, quantity })),
    )
    await prisma.recipe.upsert({
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
  }

  // ---------- Avances ----------
  const avances = [
    {
      internalName: 'Avance a Robot',
      ingredients: ['fuerza', 'adivinacion'],
      source: 'monstruo',
      target: 'robot',
    },
    {
      internalName: 'Avance a Clown',
      ingredients: ['control-corporal', 'danger-intuition'],
      source: 'vidente',
      target: 'clown',
    },
    {
      internalName: 'Avance a Listener',
      ingredients: ['escucha', 'locura'],
      source: 'suplicante-de-secretos',
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
}
