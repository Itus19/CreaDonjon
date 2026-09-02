import { ABILITIES, type Ability, type Modifier } from "./sheet";

/**
 * Bonus de caracteristique accorde par un historique (V2-G7, PHB 2024
 * p.15) : parmi les trois caracteristiques que l'historique liste, soit
 * +2 sur l'une et +1 sur une autre (la troisieme ne recoit rien), soit +1
 * sur les trois. Stocke dans `character.choices["background.ability_bonus"]`
 * — une seule cle, jamais qualifiee par historique/niveau comme l'ASI
 * (`abilityScoreImprovement.ts`) : ce choix se fait une seule fois, a la
 * creation, jamais reconduit a la montee de niveau.
 */
export interface BackgroundAbilityBonusChoice {
  kind: "background_ability_bonus";
  increases: Partial<Record<Ability, number>>;
}

/** Narrows une valeur quelconque (`character.choices[...]`) vers un `BackgroundAbilityBonusChoice`, sans juger de sa validite metier — voir `isValidBackgroundAbilityBonusChoice`. */
export function parseBackgroundAbilityBonusChoice(value: unknown): BackgroundAbilityBonusChoice | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "background_ability_bonus") return null;
  if (!record.increases || typeof record.increases !== "object") return null;

  const increases: Partial<Record<Ability, number>> = {};
  for (const [key, amount] of Object.entries(record.increases as Record<string, unknown>)) {
    if (!ABILITIES.includes(key as Ability) || typeof amount !== "number") return null;
    increases[key as Ability] = amount;
  }
  return { kind: "background_ability_bonus", increases };
}

/**
 * +2 sur une des trois caracteristiques de l'historique et +1 sur une
 * autre (la troisieme reste intacte), ou +1 sur les trois — jamais une
 * caracteristique hors de la liste `allowedAbilities` (les trois que
 * l'historique choisi porte lui-meme). `allowedAbilities` vide (historique
 * sans donnee de caracteristiques, ex. un historique SRD 2014) refuse tout
 * choix par construction : aucune caracteristique ne peut jamais matcher.
 */
export function isValidBackgroundAbilityBonusChoice(
  choice: BackgroundAbilityBonusChoice,
  allowedAbilities: readonly Ability[]
): boolean {
  const entries = Object.entries(choice.increases) as [Ability, number][];
  if (entries.length !== 2 && entries.length !== 3) return false;
  for (const [ability] of entries) {
    if (!allowedAbilities.includes(ability)) return false;
  }
  if (entries.length === 3) return entries.every(([, amount]) => amount === 1);
  const amounts = entries.map(([, amount]) => amount).sort((a, b) => a - b);
  return amounts[0] === 1 && amounts[1] === 2;
}

/** Un modificateur additif couche 4 (celle de l'historique) par caracteristique touchee — meme forme que `asiModifiers` (couche 5, abilityScoreImprovement.ts), seule la couche differe. */
export function backgroundAbilityBonusModifiers(
  choice: BackgroundAbilityBonusChoice,
  source: string,
  label: string
): Modifier[] {
  return Object.entries(choice.increases).map(([ability, amount]) => ({
    target: `ability.${ability}`,
    op: "add",
    value: amount,
    layer: 4,
    source,
    label,
  }));
}
