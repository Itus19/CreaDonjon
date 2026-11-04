import { posterActionFiche } from "@/lib/ui/ficheDesApi";
import type { CibleResultat } from "@/lib/ui/activationFiche";

/**
 * V3.1-131 : l'appel du bouton « Utiliser » d'une capacité de la fiche. Il part
 * d'un geste (le toucher du bouton), jamais d'un chargement après affichage
 * (docs/CABLAGE.md §6). Le serveur vérifie, lance les dés et applique ; un refus
 * lève une `ErreurLancer` dont le message (le champ `error` de la réponse) est
 * affiché tel quel.
 */

export interface DemandeActivation {
  campaignId: string;
  /** La clé de la fiche de règle qui porte l'activation. */
  ruleKey: string;
  activationId: string;
  variantId: string | null;
  /** Vide pour une activation qui vise celui qui la joue. */
  targetParticipantIds: string[];
}

export interface ReponseActivation {
  ok: true;
  targets: CibleResultat[];
  changes: string[];
  applied: { bearer: string; label: string }[];
  used: Record<string, number>;
}

export async function activerRegle(entityId: string, demande: DemandeActivation, parDefaut: string): Promise<ReponseActivation> {
  return posterActionFiche<ReponseActivation>(entityId, "activate", demande, parDefaut);
}
