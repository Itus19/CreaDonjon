import type { Rng } from "../dice/rng";
import type { TableEntry } from "../tables/types";

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

/**
 * Voisins ordonnes d'une option resolue sur son axe (V2-J9, retour
 * utilisateur) — la gamme de prix d'un Menu de taverne doit se DEPLACER
 * avec la richesse choisie plutot que rester fixee aux 3 memes tables
 * (une taverne modeste ne doit jamais proposer de plat de luxe, une
 * réputée jamais de plat miserable). `below`/`above` restent bornes aux
 * extremites de la liste d'options — une taverne déjà "réputée" n'a rien
 * au-dessus, son "cher" reste donc au meme niveau que son "moyen".
 * Fonction pure, l'axe fournit deja l'ordre (`options`, tel que declare
 * dans le registre) — aucun ordre alphabetique ou numerique devine.
 */
export function orderedNeighbors(axis: GeneratorVariantAxis, resolvedKey: string): { below: string; above: string } {
  const idx = axis.options.findIndex((o) => o.key === resolvedKey);
  if (idx === -1) return { below: resolvedKey, above: resolvedKey };
  const clamp = (i: number) => axis.options[Math.max(0, Math.min(axis.options.length - 1, i))].key;
  return { below: clamp(idx - 1), above: clamp(idx + 1) };
}

/**
 * Entrees eligibles pour un PLAFOND sur un axe ordonne (retour utilisateur —
 * "logique scenaristique de tirage" : un objet d'echoppe rare ne doit
 * jamais sortir d'un bourg modeste). Une entree sans `tier` reste toujours
 * eligible (table pas encore graduee) ; une entree dont le `tier` ne
 * correspond a aucune option connue de l'axe reste eligible aussi — mieux
 * vaut la montrer que la faire disparaitre silencieusement pour une faute
 * de frappe de contenu. Un `ceilingKey` inconnu de l'axe desactive tout
 * filtrage (retourne toutes les entrees) plutot que d'en exclure toutes.
 */
export function entriesUpToTier(axis: GeneratorVariantAxis, ceilingKey: string, entries: readonly TableEntry[]): TableEntry[] {
  const ceilingIdx = axis.options.findIndex((o) => o.key === ceilingKey);
  if (ceilingIdx === -1) return [...entries];
  return entries.filter((entry) => {
    if (entry.tier === undefined) return true;
    const idx = axis.options.findIndex((o) => o.key === entry.tier);
    return idx === -1 || idx <= ceilingIdx;
  });
}

/**
 * Entrees d'un palier EXACT (retour utilisateur — le Menu de Taverne veut
 * 3 points de prix distincts par categorie, pas "tout ce qui est a ce
 * niveau ou en dessous"). Une entree sans `tier` reste toujours eligible,
 * meme discipline que `entriesUpToTier`.
 */
export function entriesAtExactTier(tierKey: string, entries: readonly TableEntry[]): TableEntry[] {
  return entries.filter((entry) => entry.tier === undefined || entry.tier === tierKey);
}
