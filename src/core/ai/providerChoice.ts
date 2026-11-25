/**
 * ADR 0108 — un compte déclare plusieurs fournisseurs d'IA, chacun avec un ou
 * plusieurs modèles ; un seul couple (fournisseur, modèle) sert à la fois.
 *
 * Le choix enregistré peut être devenu caduc : fournisseur supprimé (la ligne
 * de choix part avec lui), modèle retiré de la liste. Cette fonction pure dit
 * ce qui sert vraiment, avec la même règle pour l'écran et pour l'appel.
 */

export interface FournisseurPourChoix {
  id: string;
  models: string[];
  /** ISO 8601 : départage les fournisseurs quand aucun choix ne tient. */
  updatedAt: string;
}

export interface ChoixModele {
  providerId: string;
  model: string;
}

export function choixEffectif(fournisseurs: FournisseurPourChoix[], choix: ChoixModele | null): ChoixModele | null {
  if (choix) {
    const f = fournisseurs.find((x) => x.id === choix.providerId);
    if (f && f.models.length > 0) return { providerId: f.id, model: f.models.includes(choix.model) ? choix.model : f.models[0]! };
  }
  const recent = [...fournisseurs].filter((f) => f.models.length > 0).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return recent ? { providerId: recent.id, model: recent.models[0]! } : null;
}
