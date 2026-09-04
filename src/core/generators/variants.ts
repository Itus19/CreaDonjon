import type { Rng } from "../dice/rng";

/**
 * Axes de variante d'un outil de generateur (V2-J7, specs/outils-mj.md §3)
 * — un `<select>` par axe au-dessus des sections dans `GeneratorToolPanel`,
 * qui change QUELLE table un emplacement tire (ex. le type d'echoppe
 * choisi determine la table `objets-{type}`). La cle d'axe (`"type"`) sert
 * aussi de nom d'emplacement dans un gabarit de section — resolue par
 * `renderGeneratorTemplate` exactement comme un emplacement tire, aucune
 * nouvelle syntaxe.
 */
export interface GeneratorVariantOption {
  key: string;
  label: string;
}

export interface GeneratorVariantAxis {
  key: string;
  label: string;
  options: readonly GeneratorVariantOption[];
  /** Ajoute une option "Aléatoire" resolue cote serveur (jamais cote client, CLAUDE.md regle 7 — aucun Math.random()). */
  allowRandom?: boolean;
}

/** Valeur reservee envoyee par le client pour un axe quand le MJ laisse "Aléatoire" — jamais une vraie cle d'option. */
export const RANDOM_VARIANT_VALUE = "aleatoire";

/**
 * Resout la valeur choisie par le MJ pour un axe en une option CONCRETE de
 * cet axe. `RANDOM_VARIANT_VALUE` tire une option au hasard via `rng` ;
 * toute autre valeur passe telle quelle — meme une cle qui ne correspond a
 * aucune option listee, pour rester coherent avec `renderGeneratorTemplate`
 * (un gabarit/axe mal configure reste visible plutot que de disparaitre).
 */
export function resolveVariantValue(axis: GeneratorVariantAxis, chosen: string, rng: Rng): string {
  if (chosen !== RANDOM_VARIANT_VALUE || axis.options.length === 0) return chosen;
  return axis.options[rng.nextInt(axis.options.length)].key;
}
