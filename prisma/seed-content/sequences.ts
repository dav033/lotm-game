export type PathwayReference = { id: string }

export type SequencePathways = {
  vidente: PathwayReference
  sol: PathwayReference
  puerta: PathwayReference
  arbitro: PathwayReference
  abogado: PathwayReference
  sleepless: PathwayReference
  muerte: PathwayReference
  savant: PathwayReference
  mysteryPryer: PathwayReference
  error: PathwayReference
  suplicante: PathwayReference
  monstruo: PathwayReference
  visionario: PathwayReference
  tirano: PathwayReference
}

export type SequenceSeed = {
  camino: PathwayReference
  number: number
  name: string
  slug: string
}

export function getSequenceDefinitions({
  vidente,
  sol,
  puerta,
  arbitro,
  abogado,
  sleepless,
  muerte,
  savant,
  mysteryPryer,
  error,
  suplicante,
  monstruo,
  visionario,
  tirano,
}: SequencePathways): SequenceSeed[] {
  return [
    { camino: vidente, number: 9, name: 'Seer', slug: 'seer' },
    { camino: sol, number: 9, name: 'Bard', slug: 'bard' },
    { camino: sol, number: 8, name: 'Light Supplicant', slug: 'light-supplicant' },
    { camino: sol, number: 7, name: 'Solar High Priest', slug: 'solar-high-priest' },
    { camino: sol, number: 6, name: 'Notario', slug: 'notary' },
    { camino: sol, number: 5, name: 'Priest of Light', slug: 'priest-of-light' },
    { camino: sol, number: 4, name: 'Unshadowed', slug: 'unshadowed' },
    { camino: sol, number: 3, name: 'Justice Mentor', slug: 'justice-mentor' },
    { camino: sol, number: 2, name: 'Lightseeker', slug: 'lightseeker' },
    { camino: puerta, number: 9, name: 'Aprendiz', slug: 'aprendiz' },
    { camino: puerta, number: 8, name: 'Trickmaster', slug: 'trickmaster' },
    { camino: puerta, number: 7, name: 'Astrólogo', slug: 'astrologo' },
    { camino: puerta, number: 6, name: 'Escriba', slug: 'escriba' },
    { camino: puerta, number: 5, name: 'Traveler', slug: 'traveler' },
    { camino: puerta, number: 4, name: 'Secrets Sorcerer', slug: 'secrets-sorcerer' },
    { camino: puerta, number: 3, name: 'Wanderer', slug: 'wanderer' },
    { camino: puerta, number: 2, name: 'Planeswalker', slug: 'planeswalker' },
    { camino: arbitro, number: 9, name: 'Árbitro', slug: 'arbitro' },
    { camino: arbitro, number: 8, name: 'Sheriff', slug: 'sheriff' },
    { camino: arbitro, number: 7, name: 'Interrogator', slug: 'interrogator' },
    { camino: arbitro, number: 6, name: 'Judge', slug: 'judge' },
    { camino: arbitro, number: 5, name: 'Disciplinary Paladin', slug: 'disciplinary-paladin' },
    { camino: arbitro, number: 4, name: 'Imperative Mage', slug: 'imperative-mage' },
    { camino: arbitro, number: 3, name: 'Chaos Hunter', slug: 'chaos-hunter' },
    { camino: arbitro, number: 2, name: 'Balancer', slug: 'balancer' },
    { camino: abogado, number: 9, name: 'Abogado', slug: 'abogado' },
    { camino: sleepless, number: 9, name: 'Sleepless', slug: 'sleepless' },
    { camino: sleepless, number: 8, name: 'Midnight Poet', slug: 'midnight-poet' },
    { camino: sleepless, number: 7, name: 'Nightmare', slug: 'nightmare' },
    { camino: sleepless, number: 6, name: 'Soul Assurer', slug: 'soul-assurer' },
    { camino: sleepless, number: 5, name: 'Spirit Warlock', slug: 'spirit-warlock' },
    { camino: sleepless, number: 4, name: 'Nightwatcher', slug: 'nightwatcher' },
    { camino: sleepless, number: 3, name: 'Horror Bishop', slug: 'horror-bishop' },
    {
      camino: sleepless,
      number: 2,
      name: 'Servant of Concealment',
      slug: 'servant-of-concealment',
    },
    { camino: muerte, number: 9, name: 'Corpse Collector', slug: 'corpse-collector' },
    { camino: muerte, number: 8, name: 'Gravedigger', slug: 'gravedigger' },
    { camino: muerte, number: 7, name: 'Spirit Medium', slug: 'spirit-medium' },
    { camino: muerte, number: 6, name: 'Spirit Guide', slug: 'spirit-guide' },
    { camino: muerte, number: 5, name: 'Gatekeeper', slug: 'gatekeeper' },
    { camino: muerte, number: 4, name: 'Undying', slug: 'undying' },
    { camino: muerte, number: 3, name: 'Ferryman', slug: 'ferryman' },
    { camino: muerte, number: 2, name: 'Death Consul', slug: 'death-consul' },
    { camino: savant, number: 9, name: 'Savant', slug: 'savant' },
    { camino: mysteryPryer, number: 9, name: 'Mystery Pryer', slug: 'mystery-pryer' },
    { camino: error, number: 9, name: 'Marauder', slug: 'marauder' },
    { camino: error, number: 8, name: 'Swindler', slug: 'swindler' },
    { camino: error, number: 7, name: 'Cryptologist', slug: 'cryptologist' },
    { camino: error, number: 6, name: 'Prometheus', slug: 'prometheus' },
    { camino: error, number: 5, name: 'Dream Stealer', slug: 'dream-stealer' },
    { camino: error, number: 4, name: 'Parasite', slug: 'parasite' },
    { camino: error, number: 3, name: 'Mentor of Deceit', slug: 'mentor-of-deceit' },
    { camino: error, number: 2, name: 'Trojan Horse of Destiny', slug: 'trojan-horse-of-destiny' },
    {
      camino: suplicante,
      number: 9,
      name: 'Secret Suplicant',
      slug: 'secret-suplicant',
    },
    { camino: monstruo, number: 9, name: 'Monster', slug: 'monster' },
    { camino: monstruo, number: 8, name: 'Robot', slug: 'robot' },
    { camino: vidente, number: 8, name: 'Clown', slug: 'clown' },
    {
      camino: suplicante,
      number: 8,
      name: 'Listener',
      slug: 'listener',
    },
    { camino: vidente, number: 7, name: 'Mago', slug: 'mago' },
    { camino: monstruo, number: 7, name: 'Lucky One', slug: 'lucky-one' },
    {
      camino: suplicante,
      number: 7,
      name: 'Shadow Ascetic',
      slug: 'shadow-ascetic',
    },
    {
      camino: monstruo,
      number: 6,
      name: 'Calamity Priest',
      slug: 'calamity-priest',
    },
    { camino: vidente, number: 6, name: 'Faceless', slug: 'faceless' },
    {
      camino: suplicante,
      number: 6,
      name: 'Rose Bishop',
      slug: 'rose-bishop',
    },
    {
      camino: suplicante,
      number: 5,
      name: 'Shepherd',
      slug: 'shepherd',
    },
    {
      camino: vidente,
      number: 5,
      name: 'Marionetista',
      slug: 'marionetista',
    },
    {
      camino: monstruo,
      number: 5,
      name: 'Winner',
      slug: 'winner',
    },
    {
      camino: vidente,
      number: 4,
      name: 'Bizarro Sorcerer',
      slug: 'bizarro-sorcerer',
    },
    {
      camino: suplicante,
      number: 4,
      name: 'Black Knight',
      slug: 'black-knight',
    },
    { camino: monstruo, number: 4, name: 'Misfortune Mage', slug: 'misfortune-mage' },
    { camino: monstruo, number: 3, name: 'Chaoswalker', slug: 'chaoswalker' },
    { camino: monstruo, number: 2, name: 'Soothsayer', slug: 'soothsayer' },
    { camino: vidente, number: 3, name: 'Scholar of Yore', slug: 'scholar-of-yore' },
    { camino: vidente, number: 2, name: 'Invocador de Milagros', slug: 'miracle-invoker' },
    { camino: suplicante, number: 3, name: 'Trinity Templar', slug: 'trinity-templar' },
    { camino: suplicante, number: 2, name: 'Profane Presbyter', slug: 'profane-presbyter' },
    { camino: visionario, number: 9, name: 'Spectator', slug: 'spectator' },
    { camino: visionario, number: 8, name: 'Telepathist', slug: 'telepathist' },
    { camino: visionario, number: 7, name: 'Psychiatrist', slug: 'psychiatrist' },
    { camino: visionario, number: 6, name: 'Hypnotist', slug: 'hypnotist' },
    { camino: visionario, number: 5, name: 'Dreamwalker', slug: 'dreamwalker' },
    { camino: visionario, number: 4, name: 'Manipulator', slug: 'manipulator' },
    { camino: visionario, number: 3, name: 'Dream Weaver', slug: 'dream-weaver' },
    { camino: visionario, number: 2, name: 'Discerner', slug: 'discerner' },
    { camino: tirano, number: 9, name: 'Sailor', slug: 'sailor' },
    { camino: tirano, number: 8, name: 'Folk of Rage', slug: 'folk-of-rage' },
    { camino: tirano, number: 7, name: 'Seafarer', slug: 'seafarer' },
    { camino: tirano, number: 6, name: 'Wind-blessed', slug: 'wind-blessed' },
    { camino: tirano, number: 5, name: 'Ocean Songster', slug: 'ocean-songster' },
    { camino: tirano, number: 4, name: 'Cataclysmic Interrer', slug: 'cataclysmic-interrer' },
    { camino: tirano, number: 3, name: 'Sea King', slug: 'sea-king' },
    { camino: tirano, number: 2, name: 'Calamidad', slug: 'calamity' },
  ]
}
