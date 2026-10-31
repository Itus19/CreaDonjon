import type { TurnChange } from "./turn";
import { conditionLabel } from "./weaponMastery";
import type { WoundState } from "./combatPlayerView";

/**
 * V3.1-107 (ADR 0069) — Ce qu'un joueur lit d'un jet ciblé. Le moteur a lu la
 * CA et les PV de la cible par une lecture signée ; il ne les renvoie jamais :
 * le verdict sans la CA, l'effet sur un adversaire par son état de blessure
 * (mêmes seuils que la vue de V3.1-102), les PV d'un allié seulement.
 */

export function woundState(current: number, max: number): WoundState {
  if (current <= 0) return "down";
  if (current >= max) return "unhurt";
  if (current > max / 2) return "hurt";
  return "bloodied";
}

const ETAT_FR: Record<WoundState, string> = { unhurt: "indemne", hurt: "blessé", bloodied: "en sang", down: "à terre" };

export interface PlayerFacingActor {
  name: string;
  /** PJ ou allié : ses PV se lisent ; adversaire : son état de blessure seulement. */
  ally: boolean;
  hpMax: number;
}

export function describeChangeForPlayer(change: TurnChange, actorOf: (who: string) => PlayerFacingActor): string | null {
  switch (change.kind) {
    case "hp": {
      const a = actorOf(change.who);
      if (a.ally) return `${a.name} : ${change.from.current} → ${change.to.current} PV (${change.note})`;
      return `${a.name} est ${ETAT_FR[woundState(change.to.current, a.hpMax)]}.`;
    }
    case "condition":
      return `${actorOf(change.who).name} ${change.added ? "subit" : "n'a plus"} : ${conditionLabel(change.key)}`;
    case "zone":
      return `${actorOf(change.who).name} passe de ${change.from} à ${change.to}`;
    case "budget":
    case "resource":
    case "roll":
    case "hint":
    case "ignored":
      return null;
  }
}

export function attackFactForPlayer(p: {
  actor: string;
  target: string;
  label: string;
  total: number;
  verdict: "hit" | "miss" | null;
  critical: boolean;
  criticalFail: boolean;
}): string {
  const issue = p.verdict === null ? "la table tranche" : p.verdict === "hit" ? "touché" : "raté";
  const extra = p.critical ? " (critique)" : p.criticalFail ? " (échec critique)" : "";
  return `${p.actor} attaque ${p.target} (${p.label}) : ${p.total} — ${issue}${extra}.`;
}
