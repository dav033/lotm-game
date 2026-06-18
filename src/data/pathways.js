export const PATHWAYS = {
  "Fool": ["Seer", "Clown", "Magician", "Faceless", "Marionettist", "Bizarro Sorcerer", "Scholar of Yore", "Miracle Invoker", "Attendant of Mysteries", "Fool"],
  "Door": ["Apprentice", "Trickmaster", "Astrologer", "Scribe", "Traveler", "Secrets Sorcerer", "Wanderer", "Planeswalker", "Key of Stars", "Door"],
  "Error": ["Marauder", "Swindler", "Cryptologist", "Prometheus", "Dream Stealer", "Parasite", "Mentor of Deceit", "Trojan Horse of Destiny", "Worm of Time", "Error"],
  "Visionary": ["Spectator", "Telepathist", "Psychiatrist", "Hypnotist", "Dreamwalker", "Manipulator", "Dream Weaver", "Discerner", "Author", "Visionary"],
  "Sun": ["Bard", "Light Supplicant", "Solar High Priest", "Notary", "Priest of Light", "Unshadowed", "Justice Mentor", "Lightseeker", "White Angel", "Sun"],
  "Tyrant": ["Sailor", "Folk of Rage", "Seafarer", "Wind-blessed", "Ocean Songster", "Cataclysmic Interrer", "Sea King", "Calamity", "Thunder God", "Tyrant"],
  "White Tower": ["Reader", "Student of Ratiocination", "Detective", "Polymath", "Mysticism Magister", "Prophet", "Cognizer", "Wisdom Angel", "Omniscient Eye", "White Tower"],
  "Hanged Man": ["Secrets Suppliant", "Listener", "Shadow Ascetic", "Rose Bishop", "Shepherd", "Black Knight", "Trinity Templar", "Profane Presbyter", "Dark Angel", "Hanged Man"],
  "Darkness": ["Sleepless", "Midnight Poet", "Nightmare", "Soul Assurer", "Spirit Warlock", "Nightwatcher", "Horror Bishop", "Servant of Concealment", "Knight of Misfortune", "Darkness"],
  "Death": ["Corpse Collector", "Gravedigger", "Spirit Medium", "Spirit Guide", "Gatekeeper", "Undying", "Ferryman", "Death Consul", "Pale Emperor", "Death"],
  "Twilight Giant": ["Warrior", "Pugilist", "Weapon Master", "Dawn Paladin", "Guardian", "Demon Hunter", "Silver Knight", "Glory", "Hand of God", "Twilight Giant"],
  "Demoness": ["Assassin", "Instigator", "Witch", "Pleasure", "Affliction", "Despair", "Unaging", "Catastrophe", "Apocalypse", "Demoness"],
  "Red Priest": ["Hunter", "Provoker", "Pyromaniac", "Conspirer", "Reaper", "Iron-blooded Knight", "War Bishop", "Weather Warlock", "Conqueror", "Red Priest"],
  "Hermit": ["Mystery Pryer", "Melee Scholar", "Warlock", "Scrolls Professor", "Constellations Master", "Mysticologist", "Clairvoyant", "Sage", "Knowledge Emperor", "Hermit"],
  "Paragon": ["Savant", "Archaeologist", "Appraiser", "Artisan", "Astronomer", "Alchemist", "Arcane Scholar", "Knowledge Magister", "Illuminator", "Paragon"],
  "Wheel of Fortune": ["Monster", "Robot", "Lucky One", "Calamity Priest", "Winner", "Misfortune Mage", "Chaoswalker", "Soothsayer", "Snake of Mercury", "Wheel of Fortune"],
  "Mother": ["Planter", "Doctor", "Harvest Priest", "Biologist", "Druid", "Ancient Alchemist", "Pallbearer", "Desolate Matriarch", "Naturewalker", "Mother"],
  "Moon": ["Apothecary", "Beast Tamer", "Vampire", "Potions Professor", "Scarlet Scholar", "Shaman King", "High Summoner", "Life-Giver", "Beauty Goddess", "Moon"],
  "Abyss": ["Criminal", "Unwinged Angel", "Serial Killer", "Devil", "Desire Apostle", "Demon", "Blatherer", "Bloody Archduke", "Filthy Monarch", "Abyss"],
  "Chained": ["Prisoner", "Lunatic", "Werewolf", "Zombie", "Wraith", "Puppet", "Disciple of Silence", "Ancient Bane", "Abomination", "Chained"],
  "Black Emperor": ["Lawyer", "Barbarian", "Briber", "Baron of Corruption", "Mentor of Disorder", "Earl of the Fallen", "Frenzied Mage", "Duke of Entropy", "Prince of Abolition", "Black Emperor"],
  "Justiciar": ["Arbiter", "Sheriff", "Interrogator", "Judge", "Disciplinary Paladin", "Imperative Mage", "Chaos Hunter", "Balancer", "Hand of Order", "Justiciar"],
};

export const PATH_NAMES = Object.keys(PATHWAYS);

// Per-sequence color (used only for the big sequence number).
export function tierColor(seq) {
  seq = Number(seq);
  if (seq === 0) return { c: "#e8c36b", d: "#5a4416" };
  if (seq <= 3) return { c: "#b07ce0", d: "#3d2557" };
  if (seq <= 6) return { c: "#46c2a0", d: "#15473a" };
  return { c: "#6e8bc0", d: "#22324f" };
}

// Power-level progression (weakest -> apex). Drives the card accent and the
// progress bar. Index order matters: it defines the bar fill amount.
export const POWER_LEVELS = [
  { key: "Human", c: "#6b6b80", d: "#2a2a36" },        // neutral — "no color"
  { key: "Low Sequence", c: "#5b8def", d: "#1f3358" }, // blue
  { key: "Mid Sequence", c: "#2bc4b0", d: "#114740" }, // teal
  { key: "Saint", c: "#6fcf5f", d: "#214a1c" },        // green
  { key: "Angel", c: "#b07ce0", d: "#3d2557" },        // purple
  { key: "King of Angels", c: "#e8a23c", d: "#5a3c12" }, // gold
  { key: "True God", c: "#f25f6b", d: "#5a1c24" },     // crimson/radiant
];

// Artifact grades, 5 (weakest) -> 0 (apex), aligned to the same color ramp.
const GRADE_LEVELS = {
  5: { c: "#6b6b80", d: "#2a2a36" },
  4: { c: "#5b8def", d: "#1f3358" },
  3: { c: "#2bc4b0", d: "#114740" },
  2: { c: "#6fcf5f", d: "#214a1c" },
  1: { c: "#b07ce0", d: "#3d2557" },
  0: { c: "#f25f6b", d: "#5a1c24" },
};

// Resolve the active power level into a color + progress percentage.
export function powerTier(type, power, grade) {
  if (type === "Artifact") {
    const g = Number(grade);
    const t = GRADE_LEVELS[g] || GRADE_LEVELS[5];
    return { ...t, pct: ((6 - g) / 6) * 100 };
  }
  const i = Math.max(0, POWER_LEVELS.findIndex((p) => p.key === power));
  const t = POWER_LEVELS[i];
  return { c: t.c, d: t.d, pct: ((i + 1) / POWER_LEVELS.length) * 100 };
}
