// Métadonnées des cantons, indexées par numéro OFS (BFS) — même id que data/cantons.geojson.
// Population : ordre de grandeur (OFS, ~2023), utilisée pour l'équilibrage du jeu.
export const CANTONS = {
  1: { abbr: "ZH", name: "Zurich", capital: "Zurich", pop: 1_600_000, lang: "de" },
  2: { abbr: "BE", name: "Berne", capital: "Berne", pop: 1_060_000, lang: "de/fr" },
  3: { abbr: "LU", name: "Lucerne", capital: "Lucerne", pop: 424_000, lang: "de" },
  4: { abbr: "UR", name: "Uri", capital: "Altdorf", pop: 38_000, lang: "de" },
  5: { abbr: "SZ", name: "Schwyz", capital: "Schwyz", pop: 165_000, lang: "de" },
  6: { abbr: "OW", name: "Obwald", capital: "Sarnen", pop: 39_000, lang: "de" },
  7: { abbr: "NW", name: "Nidwald", capital: "Stans", pop: 44_000, lang: "de" },
  8: { abbr: "GL", name: "Glaris", capital: "Glaris", pop: 41_000, lang: "de" },
  9: { abbr: "ZG", name: "Zoug", capital: "Zoug", pop: 131_000, lang: "de" },
  10: { abbr: "FR", name: "Fribourg", capital: "Fribourg", pop: 335_000, lang: "fr/de" },
  11: { abbr: "SO", name: "Soleure", capital: "Soleure", pop: 282_000, lang: "de" },
  12: { abbr: "BS", name: "Bâle-Ville", capital: "Bâle", pop: 196_000, lang: "de" },
  13: { abbr: "BL", name: "Bâle-Campagne", capital: "Liestal", pop: 294_000, lang: "de" },
  14: { abbr: "SH", name: "Schaffhouse", capital: "Schaffhouse", pop: 84_000, lang: "de" },
  15: { abbr: "AR", name: "Appenzell Rh.-Ext.", capital: "Herisau", pop: 56_000, lang: "de" },
  16: { abbr: "AI", name: "Appenzell Rh.-Int.", capital: "Appenzell", pop: 16_500, lang: "de" },
  17: { abbr: "SG", name: "Saint-Gall", capital: "Saint-Gall", pop: 520_000, lang: "de" },
  18: { abbr: "GR", name: "Grisons", capital: "Coire", pop: 203_000, lang: "de/rm/it" },
  19: { abbr: "AG", name: "Argovie", capital: "Aarau", pop: 711_000, lang: "de" },
  20: { abbr: "TG", name: "Thurgovie", capital: "Frauenfeld", pop: 290_000, lang: "de" },
  21: { abbr: "TI", name: "Tessin", capital: "Bellinzone", pop: 356_000, lang: "it" },
  22: { abbr: "VD", name: "Vaud", capital: "Lausanne", pop: 832_000, lang: "fr" },
  23: { abbr: "VS", name: "Valais", capital: "Sion", pop: 357_000, lang: "fr/de" },
  24: { abbr: "NE", name: "Neuchâtel", capital: "Neuchâtel", pop: 177_000, lang: "fr" },
  25: { abbr: "GE", name: "Genève", capital: "Genève", pop: 515_000, lang: "fr" },
  26: { abbr: "JU", name: "Jura", capital: "Delémont", pop: 74_000, lang: "fr" },
};

// Plus le canton est peuplé, plus il y a d'interventions… mais plus le budget est élevé.
export function difficulty(pop) {
  if (pop > 700_000) return { label: "Difficile", stars: 3 };
  if (pop > 250_000) return { label: "Moyen", stars: 2 };
  return { label: "Facile", stars: 1 };
}

export function startingBudget(pop) {
  return Math.round((150_000 + pop * 0.25) / 10_000) * 10_000;
}
