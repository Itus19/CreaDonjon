import type { MouvementRecu, Point } from "@/lib/ui/planCombat";

/**
 * V3.1-170 : l'appel du plan du combat. Il part d'un geste (le lâcher d'un
 * jeton), jamais d'un chargement après affichage, et jamais pendant le glissé :
 * un déplacement = une requête (docs/QUOTAS.md). Un refus lève une
 * `ErreurPlan` dont le message (le champ `error` de la route) est affiché tel quel.
 */

export class ErreurPlan extends Error {}

export interface ReponseDeplacement {
  participantId: string;
  position: Point | null;
  movement: MouvementRecu | null;
}

/** Pose un jeton (`position`) ou le retire du plan (`null`). */
export async function deplacerJeton(
  campaignId: string,
  combatId: string,
  participantId: string,
  position: Point | null,
  parDefaut: string
): Promise<ReponseDeplacement> {
  const res = await fetch(`/api/campaigns/${campaignId}/combats/${combatId}/position`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantId, position }),
  });
  const corps: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = corps && typeof corps === "object" && typeof (corps as { error?: unknown }).error === "string" ? (corps as { error: string }).error : parDefaut;
    throw new ErreurPlan(message);
  }
  return corps as ReponseDeplacement;
}
