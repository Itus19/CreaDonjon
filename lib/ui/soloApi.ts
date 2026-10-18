import type { EncashedTurnOutcome } from "@/lib/solo/types";
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
 */
export async function encaisserDepuisFiche(corps: { entityId: string; campaignId: string; worldSlug: string }): Promise<EncashedTurnOutcome> {
  const res = await posterJet("/api/solo/tour/encaisser-fiche", corps);
  if (!res.ok) throw new ErreurLancer(await messageErreur(res, "Le jet n'a pas pu être encaissé."));
  return (await res.json()) as EncashedTurnOutcome;
}
