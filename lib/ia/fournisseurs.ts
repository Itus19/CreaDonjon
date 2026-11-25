/**
 * ADR 0108 — ce que l'écran sait des fournisseurs d'IA d'un compte. Jamais la
 * clé : seulement qu'il y en a une, et depuis quand (ADR 0103).
 * Partagé par la page Compte et l'écran du solo.
 */
export interface FournisseurIaVue {
  id: string;
  label: string;
  baseUrl: string;
  models: string[];
  aUneCle: boolean;
  posePar: string;
}

export interface ChoixIaVue {
  fournisseurId: string;
  model: string;
}

export interface FournisseursIaReponse {
  fournisseurs: FournisseurIaVue[];
  /** Le couple qui sert vraiment, choix enregistré ou repli (`choixEffectif`). */
  actif: ChoixIaVue | null;
  chiffrementDisponible: boolean;
}

/** La valeur d'une option de liste : `fournisseur::modèle`. Un identifiant de modèle ne contient jamais `::`. */
export function valeurChoix(choix: ChoixIaVue): string {
  return `${choix.fournisseurId}::${choix.model}`;
}

export function choixDepuisValeur(valeur: string): ChoixIaVue | null {
  const i = valeur.indexOf("::");
  if (i <= 0) return null;
  return { fournisseurId: valeur.slice(0, i), model: valeur.slice(i + 2) };
}

/** Les options du choix de modèle : « OpenRouter · openai/gpt-4o-mini », groupées par fournisseur. */
export function optionsChoix(fournisseurs: FournisseurIaVue[]): { value: string; label: string; groupe: string }[] {
  return fournisseurs.flatMap((f) => f.models.map((m) => ({ value: valeurChoix({ fournisseurId: f.id, model: m }), label: m, groupe: f.label })));
}
