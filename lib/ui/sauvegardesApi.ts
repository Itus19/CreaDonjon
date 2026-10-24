import type { AnswerSaveRequestInput } from "@/lib/saveRequests/schemas";

/**
 * V3.1-112 — répondre à une sauvegarde demandée (`POST …/save-requests/[id]/answer`).
 * Le seul appel des écrans de sauvegarde : la liste arrive avec la page, puis
 * par le temps réel (`SauvegardesProvider`).
 */

export interface ReponseSauvegarde {
  passed: boolean;
  natural: number | null;
  total: number;
  changes: string[];
  hints: string[];
}

export type ResultatReponse = { ok: true; reponse: ReponseSauvegarde } | { ok: false; erreur: string };

export async function repondreSauvegarde(
  campaignId: string,
  requestId: string,
  input: AnswerSaveRequestInput,
  erreurReseau: string
): Promise<ResultatReponse> {
  try {
    const res = await fetch(`/api/campaigns/${campaignId}/save-requests/${requestId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const corps: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const erreur = corps && typeof corps === "object" && "error" in corps && typeof corps.error === "string" ? corps.error : erreurReseau;
      return { ok: false, erreur };
    }
    return { ok: true, reponse: corps as ReponseSauvegarde };
  } catch (erreur: unknown) {
    console.error("Réponse à la sauvegarde non envoyée", erreur);
    return { ok: false, erreur: erreurReseau };
  }
}
