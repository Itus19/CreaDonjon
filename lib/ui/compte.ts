import { repartirMondes, type MondeAccueil } from "@/lib/ui/accueil";

/**
 * La page Compte (V3.1-80) : ce que le serveur lui donne avec la page
 * (docs/CABLAGE.md, C1), et sa logique pure. Le numéro (`handleTag`) n'est
 * envoyé qu'ici : il n'apparaît qu'en Identité.
 */
export interface DonneesCompte {
  displayName: string;
  /** Le nom de connexion et son numéro (comptes « tag ») ; `null` pour un compte à email sans nom de connexion. */
  handle: { name: string; tag: string } | null;
  /** L'email réel ; `null` pour un compte sans email (adresse synthétique, jamais montrée). */
  email: string | null;
  /** Le lien d'invitation par lequel on a rejoint ; `null` si l'on n'a pas rejoint par un lien. */
  invite: { id: string; hasPassword: boolean } | null;
  locale: "fr" | "en";
  /** Les mondes dont on est propriétaire, supprimés avec le compte. */
  mondesPossedes: string[];
  contexte: { mene: number; joue: number; solo: number };
}

export function compteDuContexte(mondes: MondeAccueil[]): DonneesCompte["contexte"] {
  const { jeMene, jeJoue, enSolo } = repartirMondes(mondes);
  return { mene: jeMene.length, joue: jeJoue.length, solo: enSolo.length };
}

export type SectionCompte = "identite" | "connexion" | "invitation" | "apparence" | "langue" | "suppression";

/** Les sections dans l'ordre décidé ; « Mon lien d'invitation » seulement pour qui a rejoint par un lien. */
export function sectionsCompte(params: { aRejointParUnLien: boolean }): SectionCompte[] {
  const toutes: SectionCompte[] = ["identite", "connexion", "invitation", "apparence", "langue", "suppression"];
  return params.aRejointParUnLien ? toutes : toutes.filter((s) => s !== "invitation");
}
