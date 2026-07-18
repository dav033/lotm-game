export type RitualSeed = {
  name: string
  advanceName: string
  ingredients: string[]
  requiredSequenceNumber: number
}

export function getRitualDefinitions(): RitualSeed[] {
  return [
    {
      name: 'Ritual de avance a Priest of Light',
      advanceName: 'Avance a Priest of Light',
      ingredients: ['hielo-eterno', 'oscuridad'],
      requiredSequenceNumber: 6,
    },
    {
      name: 'Ritual de avance a Unshadowed',
      advanceName: 'Avance a Unshadowed',
      ingredients: ['emocion', 'ciclo'],
      requiredSequenceNumber: 5,
    },
    {
      name: 'Ritual de avance a Justice Mentor',
      advanceName: 'Avance a Justice Mentor',
      ingredients: ['codigos', 'continuidad'],
      requiredSequenceNumber: 4,
    },
    {
      name: 'Ritual de avance a Lightseeker',
      advanceName: 'Avance a Lightseeker',
      ingredients: ['memoria', 'reliquia-solar'],
      requiredSequenceNumber: 3,
    },
    {
      name: 'Ritual de avance a Disciplinary Paladin',
      advanceName: 'Avance a Disciplinary Paladin',
      ingredients: ['investigacion', 'muerte'],
      requiredSequenceNumber: 6,
    },
    {
      name: 'Ritual de avance a Imperative Mage',
      advanceName: 'Avance a Imperative Mage',
      ingredients: ['legislacion', 'castigo'],
      requiredSequenceNumber: 5,
    },
    {
      name: 'Ritual de avance a Chaos Hunter',
      advanceName: 'Avance a Chaos Hunter',
      ingredients: ['angel', 'intervencion'],
      requiredSequenceNumber: 4,
    },
    {
      name: 'Ritual de avance a Balancer',
      advanceName: 'Avance a Balancer',
      ingredients: ['desorden', 'equilibrio'],
      requiredSequenceNumber: 3,
    },
    {
      name: 'Ritual de avance a Soul Assurer',
      advanceName: 'Avance a Soul Assurer',
      ingredients: ['mundo-espiritual', 'identidad'],
      requiredSequenceNumber: 7,
    },
    {
      name: 'Ritual de avance a Nightwatcher',
      advanceName: 'Avance a Nightwatcher',
      ingredients: ['linaje', 'divinidad'],
      requiredSequenceNumber: 5,
    },
    {
      name: 'Ritual de avance a Horror Bishop',
      advanceName: 'Avance a Horror Bishop',
      ingredients: ['muerte', 'valor'],
      requiredSequenceNumber: 4,
    },
    {
      name: 'Ritual de avance a Servant of Concealment',
      advanceName: 'Avance a Servant of Concealment',
      ingredients: ['tiempo', 'autocontrol'],
      requiredSequenceNumber: 3,
    },
    {
      name: 'Ritual de avance a Gatekeeper',
      advanceName: 'Avance a Gatekeeper',
      ingredients: ['resistencia', 'inframundo'],
      requiredSequenceNumber: 6,
    },
    {
      name: 'Ritual de avance a Undying',
      advanceName: 'Avance a Undying',
      ingredients: ['rio', 'funeral'],
      requiredSequenceNumber: 5,
    },
    {
      name: 'Ritual de avance a Ferryman',
      advanceName: 'Avance a Ferryman',
      ingredients: ['muerte', 'inframundo'],
      requiredSequenceNumber: 4,
    },
    {
      name: 'Ritual de Death Consul: Inframundo',
      advanceName: 'Avance a Death Consul',
      ingredients: ['dominacion', 'inframundo'],
      requiredSequenceNumber: 3,
    },
    {
      name: 'Ritual de Death Consul: Nación',
      advanceName: 'Avance a Death Consul',
      ingredients: ['nacion', 'muerte'],
      requiredSequenceNumber: 3,
    },
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
    {
      name: 'Ritual de avance a Ocean Songster',
      advanceName: 'Avance a Ocean Songster',
      ingredients: ['obninsk', 'canto'],
      requiredSequenceNumber: 6,
    },
    {
      name: 'Ritual de avance a Cataclysmic Interrer',
      advanceName: 'Avance a Cataclysmic Interrer',
      ingredients: ['terremoto', 'tsunami'],
      requiredSequenceNumber: 5,
    },
    {
      name: 'Ritual de avance a Sea King',
      advanceName: 'Avance a Sea King',
      ingredients: ['torre', 'dominacion'],
      requiredSequenceNumber: 4,
    },
    {
      name: 'Ritual de avance a Calamidad',
      advanceName: 'Avance a Calamidad',
      ingredients: ['calamidad', 'multitud'],
      requiredSequenceNumber: 3,
    },
    {
      name: 'Ritual de avance a Dream Stealer',
      advanceName: 'Avance a Dream Stealer',
      ingredients: ['sueno', 'multitud'],
      requiredSequenceNumber: 6,
    },
    {
      name: 'Ritual de avance a Parasite',
      advanceName: 'Avance a Parasite',
      ingredients: ['robo', 'multitud'],
      requiredSequenceNumber: 5,
    },
    {
      name: 'Ritual de avance a Mentor of Deceit',
      advanceName: 'Avance a Mentor of Deceit',
      ingredients: ['laguna', 'desorden'],
      requiredSequenceNumber: 4,
    },
    {
      name: 'Ritual de avance a Trojan Horse of Destiny',
      advanceName: 'Avance a Trojan Horse of Destiny',
      ingredients: ['suplantacion', 'continuidad'],
      requiredSequenceNumber: 3,
    },
    {
      name: 'Ritual de avance a Traveler',
      advanceName: 'Avance a Traveler',
      ingredients: ['carta-nautica', 'mundo-espiritual'],
      requiredSequenceNumber: 6,
    },
    {
      name: 'Ritual de avance a Secrets Sorcerer',
      advanceName: 'Avance a Secrets Sorcerer',
      ingredients: ['ocultamiento', 'simbolismo'],
      requiredSequenceNumber: 5,
    },
    {
      name: 'Ritual de avance a Wanderer',
      advanceName: 'Avance a Wanderer',
      ingredients: ['mundo-astral', 'separacion'],
      requiredSequenceNumber: 4,
    },
  ]
}
