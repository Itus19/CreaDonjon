import { abilityModifier } from "./combat";
import { ABILITIES } from "./sheet";
import type { StatBlockBlockData } from "../schemas/rule-blocks/blocks";
import type { TriggerActorState, TriggerZone } from "./triggers";

/**
 * V3-A2 (câblage du combat) — l'acteur, vu par une condition, quand ce
 * n'est PAS un personnage.
 *
 * Le moteur de déclencheurs était taillé pour un personnage : il exigeait
 * une `DerivedSheet`, qu'un monstre n'a pas. C'est ce qui empêchait de
 * faire partir un `turn_start` sur le tour d'un gobelin, et donc de câbler
 * le combat.
 *
 * Plutôt que de dériver une fiche complète pour un monstre — un chantier
 * pour un besoin qui n'existe pas —, cette fonction compose l'acteur depuis
 * son bloc `stat_block`, qui porte déjà tout ce qu'une condition peut lire.
 *
 * Module PUR : le bloc et l'état vivant du participant sont fournis par
 * l'appelant, rien n'est lu en base ici.
 */

export interface ParticipantVitals {
  /** Valeurs du participant EN COMBAT, qui priment sur celles du bloc : un monstre blessé n'a plus ses PV de fiche. */
  ac?: number | null;
  hpCurrent?: number | null;
  hpMax?: number | null;
  tempHp?: number | null;
  conditions?: readonly string[];
  zone?: TriggerZone;
}

/**
 * Le bonus de sauvegarde d'un monstre est son modificateur de
 * caractéristique, SAUF pour les sauvegardes où il est maîtrisé — que le
 * SRD liste explicitement dans `saving_throws`, bonus total compris. On
 * n'additionne donc jamais la maîtrise soi-même : la source donne déjà le
 * résultat, et le recalculer le doublerait sur les monstres légendaires.
 */
export function buildMonsterActorState(
  statBlock: StatBlockBlockData | undefined,
  vitals: ParticipantVitals = {},
): TriggerActorState {
  const numbers: Record<string, number> = {};

  if (statBlock) {
    numbers["ac"] = statBlock.armor_class;
    numbers["hp.max"] = statBlock.hit_points;
    numbers["proficiency"] = statBlock.proficiency_bonus;
    const maitrises = new Map((statBlock.saving_throws ?? []).map((s) => [s.ability.toLowerCase(), s.bonus]));
    for (const ability of ABILITIES) {
      const mod = abilityModifier(statBlock.abilities[ability]);
      numbers[`ability.${ability}`] = mod;
      numbers[`save.${ability}`] = maitrises.get(ability) ?? mod;
    }
  }

  // L'état vivant prime : un participant blessé, ou dont le MJ a corrigé la
  // CA à la main, ne doit pas être jugé sur sa fiche d'origine.
  if (vitals.ac !== null && vitals.ac !== undefined) numbers["ac"] = vitals.ac;
  if (vitals.hpMax !== null && vitals.hpMax !== undefined) numbers["hp.max"] = vitals.hpMax;
  if (vitals.hpCurrent !== null && vitals.hpCurrent !== undefined) numbers["hp.current"] = vitals.hpCurrent;
  if (vitals.tempHp !== null && vitals.tempHp !== undefined) numbers["hp.temp"] = vitals.tempHp;

  return {
    conditions: vitals.conditions ?? [],
    // Un monstre n'a pas d'aptitudes au sens des dons : ses traits vivent
    // dans son bloc `traits`, sans clé d'entrée interrogeable. `has_feature`
    // est donc toujours faux pour lui — une limite réelle, pas un oubli.
    features: [],
    numbers,
    zone: vitals.zone ?? "engaged",
  };
}
