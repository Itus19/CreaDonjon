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
  /** V3.1-170 (ADR 0077) : la zone posée sur le plan (mètres) ; le serveur en calcule les cibles. */
  area?: { point?: { x: number; y: number }; aim?: { x: number; y: number } };
  /** V3.1-166 : `ruleKey` est un sort ; l'emplacement dépensé et l'option de lancement d'une aptitude. */
  spell?: { slotLevel: number; castOption?: { ruleKey: string; optionId: string } };
}

export interface ReponseActivation {
  ok: true;
  targets: CibleResultat[];
  changes: string[];
  applied: { bearer: string; label: string }[];
  used: Record<string, number>;
  /** V3.1-166 : le budget du tour est dépassé ; un avertissement, jamais un blocage (ADR 0029). */
  overBudget?: boolean;
}

export async function activerRegle(entityId: string, demande: DemandeActivation, parDefaut: string): Promise<ReponseActivation> {
  return posterActionFiche<ReponseActivation>(entityId, "activate", demande, parDefaut);
}
