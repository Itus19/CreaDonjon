import { sortByInitiative } from "./combat";

/**
 * V3.1-102 (ADR 0040) — l'initiative vue par les joueurs.
 *
 * Les lignes viennent déjà filtrées de la base (`public.combat_player_view`) :
 * PV pour les alliés seulement, un état de blessure pour les adversaires,
 * jamais de CA. Ici, seulement l'ordre de passage et le tour en cours,
 * calculés par le MÊME tri que l'écran du MJ (`sortByInitiative`) : sans
 * cela, `turn_index` pourrait désigner un autre participant chez les joueurs.
 */
export type CombatSide = "ally" | "enemy";

/** Indemne (PV ≥ max), Blessé (> ½), En sang (> 0), Hors de combat (0). */
export type WoundState = "unhurt" | "hurt" | "bloodied" | "down";

export interface PlayerCombatRow {
  id: string;
  label: string;
  initiative: number | null;
  displayOrder: number;
  side: CombatSide;
  /** La fiche d'un allié (lien vers sa page) ; toujours `null` pour un adversaire. */
  entityId: string | null;
  conditions: string[];
  /** Allié seulement. */
  hp: { current: number | null; max: number | null; temp: number } | null;
  /** Adversaire seulement ; `null` si le MJ n'a pas saisi ses PV. */
  wound: WoundState | null;
}

export interface PlayerCombatParticipant extends PlayerCombatRow {
  /** Rang dans l'ordre de passage, à partir de 1. */
  order: number;
  isCurrent: boolean;
}

export function orderPlayerCombatView(
  rows: readonly PlayerCombatRow[],
  combat: { status: string; turnIndex: number }
): PlayerCombatParticipant[] {
  return sortByInitiative(rows).map((row, index) => ({
    ...row,
    order: index + 1,
    isCurrent: combat.status === "running" && index === combat.turnIndex,
  }));
}
