/**
 * V3.1-110 (ADR 0044) — la restriction de cible d'un effet : Charme-personne
 * ne vise qu'un humanoïde, et pas un humanoïde immunisé à Charmé. Vérifiée
 * AVANT toute demande de sauvegarde (V3.1-111) : un refus ne lance aucun dé.
 *
 * Fonction pure. Le profil de la cible est lu par l'appelant : type de
 * créature du bloc de stats (ou « humanoid » pour un PJ, toutes les espèces
 * jouables l'étant), immunités d'état du bloc de stats.
 */
export interface TargetRestriction {
  creature_types?: string[];
  exclude_creature_types?: string[];
  immune_conditions_block?: string[];
}

export interface TargetProfile {
  /** `null` : type inconnu (saisie libre du MJ). */
  creatureType: string | null;
  conditionImmunities: string[];
}

export type TargetRefusal = "creature_type_not_allowed" | "creature_type_excluded" | "condition_immunity";

export type TargetCheck = { ok: true } | { ok: false; reason: TargetRefusal; detail: string };

/** « Humanoid (goblinoid) » → « humanoid » : le premier mot, en minuscules. Vide → `null`. */
export function creatureTypeOf(raw: string): string | null {
  const first = raw.trim().split(/[\s(]+/)[0]?.toLowerCase() ?? "";
  return first === "" ? null : first;
}

const norm = (value: string) => value.trim().toLowerCase();

/**
 * Un type inconnu n'est jamais refusé par une liste de types : on ne refuse
 * pas sans savoir, la table tranche. Une immunité connue, elle, refuse
 * toujours.
 */
export function isValidTarget(effect: { target?: TargetRestriction }, target: TargetProfile): TargetCheck {
  const restriction = effect.target;
  if (!restriction) return { ok: true };
  const type = target.creatureType === null ? null : norm(target.creatureType);

  if (type !== null && restriction.creature_types && restriction.creature_types.length > 0) {
    if (!restriction.creature_types.map(norm).includes(type)) return { ok: false, reason: "creature_type_not_allowed", detail: type };
  }
  if (type !== null && restriction.exclude_creature_types?.map(norm).includes(type)) {
    return { ok: false, reason: "creature_type_excluded", detail: type };
  }
  const immunities = target.conditionImmunities.map(norm);
  const blocked = restriction.immune_conditions_block?.map(norm).find((condition) => immunities.includes(condition));
  if (blocked) return { ok: false, reason: "condition_immunity", detail: blocked };
  return { ok: true };
}
