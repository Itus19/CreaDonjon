/**
 * Vocabulaire de base de la fiche : caracteristiques et competences
 * (V3.1-120). Module feuille : il n'importe rien. Sorti de `sheet.ts`, qui
 * le reexporte, pour que `encumbrance.ts` le lise sans former de cycle
 * avec `sheet.ts`.
 */

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITIES: readonly Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

/** V2-M11 (Lot M) : exporte pour construire les libelles de jet ("Test de Force", "Sauvegarde de Sagesse") sans dupliquer cette table ailleurs — meme convention que les `sources` de `sheet.ts`, qui l'utilisent deja. */
export const ABILITY_LABELS: Record<Ability, string> = {
  str: "Force",
  dex: "Dextérité",
  con: "Constitution",
  int: "Intelligence",
  wis: "Sagesse",
  cha: "Charisme",
};

export const SKILL_ABILITIES = {
  acrobatics: "dex",
  animal_handling: "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  sleight_of_hand: "dex",
  stealth: "dex",
  survival: "wis",
} as const satisfies Record<string, Ability>;
export type Skill = keyof typeof SKILL_ABILITIES;
export const SKILLS = Object.keys(SKILL_ABILITIES) as readonly Skill[];
