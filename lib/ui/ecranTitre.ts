import { jetonDepuisLien } from "@/lib/campaignInvites/lienInvitation";

/**
 * Écran-titre (V3.1-85) : logique pure, testable sans navigateur.
 * Un seul panneau est ouvert à la fois ; « menu » est l'état de départ.
 */
export type PanneauTitre = "menu" | "connexion" | "creation" | "oubli" | "invitation";

/** Le chemin où mène un lien d'invitation collé, ou `null` si le texte ne contient aucun jeton. */
export function cheminInvitation(texte: string): string | null {
  const jeton = jetonDepuisLien(texte);
  return jeton === null ? null : `/rejoindre/${jeton}`;
}
