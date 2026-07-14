// Each of the 22 pathways mapped to its icon (filenames don't always match the
// name). Served from /public so the paths work the same in dev and production.
const icon = (file) => `/pathway-icons/${file}.webp`

export const PATHWAY_ICONS = {
  "Fool": icon('fool'),
  "Door": icon('door'),
  "Error": icon('error'),
  "Visionary": icon('visionary'),
  "Sun": icon('sun'),
  "Tyrant": icon('tyrant'),
  "White Tower": icon('white-tower'),
  "Hanged Man": icon('hanged-man'),
  "Darkness": icon('darkness'),
  "Death": icon('death'),
  "Twilight Giant": icon('giant'),
  "Demoness": icon('demoness'),
  "Red Priest": icon('red-priest'),
  "Hermit": icon('hermit'),
  "Paragon": icon('paragon'),
  "Wheel of Fortune": icon('fortune'),
  "Mother": icon('mother'),
  "Moon": icon('moon'),
  "Abyss": icon('abyss'),
  "Chained": icon('chained'),
  "Black Emperor": icon('black-emperor'),
  "Justiciar": icon('justiciar'),
}
