import { ABILITIES, type Ability, type Modifier } from "./sheet";
import type { ChoiceSource } from "./choices";

/**
 * Amelioration de caracteristique (ASI, V2-G1 — montee de niveau
 * accompagnee) : +2 sur une caracteristique, ou +1 sur deux, plafond du ruleset
 * (`asiExceedsCap` le verifie contre les scores d'avant le choix ; les autres
 * fonctions ne connaissent que la forme du choix, jamais l'etat du personnage). Stocke dans `character.choices["<classe>.l<niveau>.asi"]`,
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

/**
 * Ce choix ferait-il dépasser le plafond de caractéristique du ruleset
 * (`ability_score_cap`, V3.1-115) ? `scoresBefore` : les scores AVANT ce choix.
 * Le plafond vient du ruleset, jamais d'une constante.
 */
export function asiExceedsCap(choice: AsiChoice, scoresBefore: Record<Ability, number>, cap: number): boolean {
  return Object.entries(choice.increases).some(([ability, amount]) => scoresBefore[ability as Ability] + (amount ?? 0) > cap);
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

/**
 * V3.1-118 — En 2024, un niveau d'amélioration accorde un DON général ; le
 * don « Amélioration de caractéristique » est l'un d'eux, et son +2 / +1+1
 * reste stocké sous `"<classe>.l<niveau>.asi"`. Le don choisi l'est sous
 * `"<classe>.l<niveau>.feat"` (la source `"<classe>.l<niveau>"`, son choix `feat`).
 */
export const ASI_FEAT_KEY = "ability-score-improvement";

/** Les fiches de choix des niveaux d'amélioration : une par classe et par niveau, rangée sous la classe, comptée au niveau de cette classe. */
export function asiFeatSources(asiGrantedLevels: Readonly<Record<string, readonly number[]>>, classLabels: Readonly<Record<string, string>>): ChoiceSource[] {
  return Object.entries(asiGrantedLevels).flatMap(([classKey, levels]) =>
    levels.map((level) => ({
      key: `${classKey}.l${level}`,
      label: `${classLabels[classKey] ?? classKey}, niveau ${level}`,
      layer: 5 as const,
      origin: "class" as const,
      classKey,
      grants: [
        {
          id: "feat",
          label: { fr: "Don de niveau", en: "Level feat" },
          at_level: level,
          from: { kind: "feat" as const, category: "general" },
        },
      ],
    }))
  );
}

function featKeyOf(asiChoiceKey: string): string {
  return asiChoiceKey.replace(/\.asi$/, ".feat");
}

/** Le +2 / +1+1 d'un niveau compte-t-il ? Oui si le don choisi est l'amélioration, ou si aucun don n'est choisi (personnage d'avant V3.1-118). */
export function asiApplies(choices: Readonly<Record<string, unknown>>, asiChoiceKey: string): boolean {
  const feat = choices[featKeyOf(asiChoiceKey)];
  if (!Array.isArray(feat) || feat.length === 0) return true;
  return feat[0] === ASI_FEAT_KEY;
}

/**
 * Un personnage d'avant V3.1-118 a un `.asi` sans `.feat` : il a choisi
 * l'amélioration. On le dit au moteur des choix, sans réécrire la base. Rend
 * l'objet tel quel s'il n'y a rien à ajouter.
 */
export function withImplicitAsiFeat<T extends Readonly<Record<string, unknown>>>(choices: T): T {
  const ajouts: Record<string, string[]> = {};
  for (const key of Object.keys(choices)) {
    if (!/\.l\d+\.asi$/.test(key)) continue;
    const featKey = featKeyOf(key);
    if (choices[featKey] === undefined) ajouts[featKey] = [ASI_FEAT_KEY];
  }
  return Object.keys(ajouts).length === 0 ? choices : { ...choices, ...ajouts };
}
