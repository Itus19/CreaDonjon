import { ABILITIES, type Ability, type Modifier } from "./sheet";

/**
 * Amelioration de caracteristique (ASI, V2-G1 — montee de niveau
 * accompagnee) : +2 sur une caracteristique, ou +1 sur deux, plafond 20
 * (le plafond se verifie contre le score effectif au moment du choix, pas
 * ici — cette fonction ne connait que la forme du choix, jamais l'etat
 * du personnage). Stocke dans `character.choices["<classe>.l<niveau>.asi"]`,
 * la cle generique existante (`src/core/schemas/blocks/character.ts`) —
 * aucun champ de schema dedie.
 */
export interface AsiChoice {
  kind: "asi";
  increases: Partial<Record<Ability, number>>;
}

/** Narrows une valeur quelconque (`character.choices[cle]`) vers un `AsiChoice`, sans juger de sa validite metier — voir `isValidAsiChoice`. */
export function parseAsiChoice(value: unknown): AsiChoice | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "asi") return null;
  if (!record.increases || typeof record.increases !== "object") return null;

  const increases: Partial<Record<Ability, number>> = {};
  for (const [key, amount] of Object.entries(record.increases as Record<string, unknown>)) {
    if (!ABILITIES.includes(key as Ability) || typeof amount !== "number") return null;
    increases[key as Ability] = amount;
  }
  return { kind: "asi", increases };
}

/** +2 sur une caracteristique, ou +1 sur deux — jamais autre chose (regle officielle 5e, identique SRD 2014/2024). */
export function isValidAsiChoice(choice: AsiChoice): boolean {
  const entries = Object.entries(choice.increases);
  if (entries.length < 1 || entries.length > 2) return false;

  let total = 0;
  for (const [, amount] of entries) {
    if (amount !== 1 && amount !== 2) return false;
    total += amount;
  }
  return total === 2;
}

/** Un modificateur additif couche 5 par caracteristique touchee — meme forme que `mapSpeciesModifiers` (couche 2, srdMapping.ts), seule la couche differe. */
export function asiModifiers(choice: AsiChoice, source: string, label: string): Modifier[] {
  return Object.entries(choice.increases).map(([ability, amount]) => ({
    target: `ability.${ability}`,
    op: "add",
    value: amount,
    layer: 5,
    source,
    label,
  }));
}
