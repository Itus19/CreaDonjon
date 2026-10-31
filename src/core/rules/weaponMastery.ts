import type { ResolvedEffect } from "./triggers";

/**
 * V3.1-148 — Les bottes des armes maîtrisées (SRD 5.2.1, « Weapon Mastery
 * Properties »), appliquées par le moteur. Une botte qui dure (Sape,
 * Vexation) pose une MARQUE dans les états de la cible : `botte:<genre>:<source>:<round>`,
 * la source étant le participant qui l'a posée. Les états d'un participant
 * passent par les changements signés (ADR 0041) : la même mécanique vaut au
 * nom d'un joueur.
 */

export type MasteryMarkerKind = "sap" | "vex";
export type Advantage = "normal" | "advantage" | "disadvantage";

export function masteryMarker(kind: MasteryMarkerKind, source: string, round: number): string {
  return `botte:${kind}:${source}:${round}`;
}

export function parseMasteryMarker(condition: string): { kind: MasteryMarkerKind; source: string; round: number } | null {
  const m = /^botte:(sap|vex):([^:]+):(\d+)$/.exec(condition);
  return m ? { kind: m[1] as MasteryMarkerKind, source: m[2]!, round: Number(m[3]) } : null;
}

/** Une arme maîtrisée : choisie dans une maîtrise d'armes (`<classe>.weapon_mastery`). */
export function isWeaponMastered(choices: Readonly<Record<string, unknown>>, weaponKey: string): boolean {
  return Object.entries(choices).some(([key, value]) => key.endsWith(".weapon_mastery") && Array.isArray(value) && value.includes(weaponKey));
}

export interface MasteryOutcome {
  effects: ResolvedEffect[];
  hints: string[];
  /** Renversement : la cible fait ce jet de sauvegarde ; échoué, elle est À terre. */
  toppleSave?: { ability: "con"; dc: number };
}

const AIDES: Record<string, string> = {
  push: "Poussée : vous pouvez repousser la cible de 3 m en ligne droite (taille G ou moins).",
  slow: "Ralentissement : la Vitesse de la cible baisse de 3 m jusqu'au début de votre prochain tour.",
  cleave: "Enchaînement : une attaque de plus contre une autre créature à 1,5 m de la cible, une fois par tour, sans votre modificateur aux dégâts.",
  nick: "Coup double : l'attaque de l'arme légère en plus se fait pendant l'action d'attaque, pas en action bonus.",
};

/** Ce que la botte de l'arme fait après un jet d'attaque. `mastery` : la clé de botte de l'arme, si elle est maîtrisée. */
export function masteryOnAttack(p: {
  mastery: string | null;
  verdict: "hit" | "miss";
  targetKey: string;
  sourceId: string;
  round: number;
  abilityMod: number;
  proficiencyBonus: number;
  damageType: string | null;
}): MasteryOutcome {
  const vide: MasteryOutcome = { effects: [], hints: [] };
  switch (p.mastery) {
    case "sap":
      return p.verdict === "hit"
        ? { effects: [{ action: "apply_condition", who: p.targetKey, key: masteryMarker("sap", p.sourceId, p.round) }], hints: ["Sape : la cible a le désavantage à son prochain jet d'attaque."] }
        : vide;
    case "vex":
      return p.verdict === "hit"
        ? { effects: [{ action: "apply_condition", who: p.targetKey, key: masteryMarker("vex", p.sourceId, p.round) }], hints: ["Vexation : avantage à votre prochain jet d'attaque contre cette cible."] }
        : vide;
    case "graze":
      return p.verdict === "miss" && p.abilityMod > 0
        ? {
            effects: [{ action: "deal_damage", who: p.targetKey, amount: p.abilityMod, ...(p.damageType ? { damage_type: p.damageType } : {}) }],
            hints: [`Écorchure : ${p.abilityMod} dégâts malgré le raté.`],
          }
        : vide;
    case "topple":
      return p.verdict === "hit" ? { effects: [], hints: [], toppleSave: { ability: "con", dc: 8 + p.abilityMod + p.proficiencyBonus } } : vide;
    case "push":
    case "slow":
    case "cleave":
      return p.verdict === "hit" ? { effects: [], hints: [AIDES[p.mastery]!] } : vide;
    case "nick":
      return { effects: [], hints: [AIDES.nick!] };
    default:
      return vide;
  }
}

/**
 * L'avantage du prochain jet d'attaque d'après les marques : l'attaquant sapé
 * a le désavantage ; la cible vexée PAR CET attaquant lui donne l'avantage.
 * Les deux s'annulent, avec le choix de la table aussi. La marque utilisée est consommée.
 */
export function advantageFromMarkers(p: { attackerSource: string; attackerConditions: readonly string[]; targetConditions: readonly string[]; chosen: Advantage }): {
  advantage: Advantage;
  removeFromAttacker: string[];
  removeFromTarget: string[];
  notes: string[];
} {
  const sape = p.attackerConditions.find((c) => parseMasteryMarker(c)?.kind === "sap");
  const vexe = p.targetConditions.find((c) => {
    const m = parseMasteryMarker(c);
    return m?.kind === "vex" && m.source === p.attackerSource;
  });
  const avantages = (p.chosen === "advantage" ? 1 : 0) + (vexe ? 1 : 0);
  const desavantages = (p.chosen === "disadvantage" ? 1 : 0) + (sape ? 1 : 0);
  const advantage: Advantage = avantages > 0 && desavantages > 0 ? "normal" : avantages > 0 ? "advantage" : desavantages > 0 ? "disadvantage" : "normal";
  return {
    advantage,
    removeFromAttacker: sape ? [sape] : [],
    removeFromTarget: vexe ? [vexe] : [],
    notes: [...(sape ? ["Sapé : désavantage à ce jet."] : []), ...(vexe ? ["Cible vexée : avantage à ce jet."] : [])],
  };
}

/** Au changement de tour : Sape expire au début du prochain tour de son auteur ; Vexation à la fin de son prochain tour. */
export function expiredMasteryMarkers(conditions: readonly string[], p: { startingSource: string | null; endingSource: string | null; round: number }): string[] {
  return conditions.filter((c) => {
    const m = parseMasteryMarker(c);
    if (!m) return false;
    if (m.kind === "sap") return m.source === p.startingSource;
    return m.source === p.endingSource && p.round > m.round;
  });
}

/** Le nom d'un état à l'écran : une marque de botte se lit « Sapé » ou « Vexé », un autre état reste tel quel. */
export function conditionLabel(condition: string): string {
  const m = parseMasteryMarker(condition);
  if (!m) return condition;
  return m.kind === "sap" ? "Sapé" : "Vexé";
}
