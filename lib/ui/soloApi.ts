import type { EncashedTurnResponse, NarrationTourResponse } from "@/lib/solo/types";
import { ErreurLancer } from "@/lib/ui/outilDes";
import { messageErreur, posterJet } from "@/lib/ui/outilDesApi";

/**
 * Appels réseau de l'écran solo qui partent d'un geste (V3.1-36), sortis des
 * composants : aucun effet de montage ici (cliquet du câblage, docs/CABLAGE.md §6).
 */

/**
 * « Lancer » dans l'outil de dés, pour la demande posée : le SERVEUR tire le dé et
 * encaisse (comme les boutons de la fiche), le client ne décrit que qui joue.
 * Échec : une `ErreurLancer` dont le message est affiché dans l'outil.
 *
 * V3.2-20 : `narrer: false` rend le dé sans attendre le modèle ; le récit se
 * demande ensuite à `raconterTour`.
 */
export async function encaisserDepuisFiche(corps: { entityId: string; campaignId: string; worldSlug: string; narrer?: boolean }): Promise<EncashedTurnResponse> {
  const res = await posterJet("/api/solo/tour/encaisser-fiche", corps);
  if (!res.ok) throw new ErreurLancer(await messageErreur(res, "Le jet n'a pas pu être encaissé."));
  return (await res.json()) as EncashedTurnResponse;
}

/**
 * V3.2-20 — le récit d'un jet déjà encaissé avec `narrer: false`. Ne jette
 * jamais : un échec réseau ou un refus rend une narration absente avec sa
 * raison, comme un tour que le modèle n'a pas raconté (V3.1-223).
 */
export async function raconterTour(eventId: string, corps: { entityId: string; campaignId: string; worldSlug: string }): Promise<NarrationTourResponse> {
  try {
    const res = await fetch(`/api/solo/tour/${eventId}/raconter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    if (!res.ok) {
      const corpsErreur = (await res.json().catch(() => null)) as { error?: string } | null;
      return { narration: null, time: null, sansNarration: "echec", sansNarrationDetail: corpsErreur?.error };
    }
    return (await res.json()) as NarrationTourResponse;
  } catch (erreur) {
    console.error("Récit du jet impossible", erreur);
    return { narration: null, time: null, sansNarration: "echec" };
  }
}
