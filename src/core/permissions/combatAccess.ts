/**
 * V3.1-101 (ADR 0040) — Qui peut toucher a un combat par ses routes ?
 *
 * Seul le MJ de la campagne : l'outil Initiative est le sien, et les
 * participants portent des secrets (PV, CA des adversaires). Les joueurs
 * auront leur propre vue filtree (V3.1-102).
 *
 * L'ordre compte : un appelant qui n'est pas MJ est refuse AVANT qu'on lui
 * dise si un combat ou un participant existe — sinon la difference entre
 * « refuse » et « introuvable » trahirait ce qu'il n'a pas le droit de voir.
 * Ensuite, l'adresse doit etre coherente : le combat appartient bien a la
 * campagne de l'adresse, le participant a ce combat.
 */
export type CombatAccess = "ok" | "forbidden" | "not_found";

export function decideCombatAccess(params: {
  campaignId: string;
  /** La campagne est-elle visible de l'appelant (RLS) ? */
  campaignFound: boolean;
  callerIsWorldAdmin: boolean;
  /** Absent : l'adresse ne vise aucun combat. `null` : vise mais introuvable. */
  combat?: { id: string; campaignId: string } | null;
  /** Meme convention que `combat`. */
  participant?: { combatId: string } | null;
}): CombatAccess {
  if (!params.campaignFound) return "not_found";
  if (!params.callerIsWorldAdmin) return "forbidden";
  if (params.combat !== undefined) {
    if (params.combat === null || params.combat.campaignId !== params.campaignId) return "not_found";
  }
  if (params.participant !== undefined) {
    if (params.combat === undefined || params.combat === null) return "not_found";
    if (params.participant === null || params.participant.combatId !== params.combat.id) return "not_found";
  }
  return "ok";
}
