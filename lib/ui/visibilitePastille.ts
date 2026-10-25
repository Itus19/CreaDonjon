/**
 * V3.1-64 — la pastille de visibilité au toucher : le cycle, le « plus
 * visible que » et le contenu de l'annonce. Pur, testé sans navigateur ; le
 * composant `VisibilityPill` ne fait que brancher. La visibilité réelle reste
 * filtrée côté serveur (CLAUDE.md, règle 5) : ceci ne décide que de ce que
 * l'on propose et de ce que l'on annonce.
 */

/** Public → Joueurs → MJ → Privé → Public. Campagne et utilisateur n'en font pas partie. */
export const CYCLE_VISIBILITE = ["public", "players", "gm", "private"] as const;

/**
 * Les niveaux du cycle pour ce lecteur : sans « Privé » quand il n'est pas
 * l'auteur du bloc (« son auteur seul » : la base refuserait).
 */
export function cycleVisibilite(sansPrive = false): readonly string[] {
  return sansPrive ? CYCLE_VISIBILITE.filter((n) => n !== "private") : CYCLE_VISIBILITE;
}

/** Le niveau suivant du cycle ; tout niveau hors cycle (campagne, utilisateur, Privé sauté) passe à Public. */
export function niveauSuivant(niveau: string, sansPrive = false): string {
  const cycle = cycleVisibilite(sansPrive);
  const i = cycle.indexOf(niveau);
  if (i === -1) return "public";
  return cycle[(i + 1) % cycle.length]!;
}

/** Plus le rang est haut, plus le bloc est vu de monde. Campagne = la table, utilisateur = une personne. */
const RANG_AUDIENCE: Record<string, number> = {
  public: 4,
  players: 3,
  campaign: 3,
  gm: 2,
  user: 1,
  private: 1,
};

/** `true` quand le changement ouvre le bloc à plus de monde qu'avant (d'où l'avertissement). */
export function devientPlusVisible(avant: string, apres: string): boolean {
  return (RANG_AUDIENCE[apres] ?? 0) > (RANG_AUDIENCE[avant] ?? 0);
}

export interface AnnonceVisibilite {
  objet: string;
  niveau: string;
  /** « Attention : il redevient visible. » */
  attention: boolean;
}

export function annonceVisibilite(
  objet: string,
  avant: string,
  apres: string,
): AnnonceVisibilite {
  return { objet, niveau: apres, attention: devientPlusVisible(avant, apres) };
}
