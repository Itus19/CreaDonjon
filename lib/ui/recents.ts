/**
 * Fiches « consultées récemment » (V3.1-30, ADR 0036 §4) : règles pures,
 * isolées des composants pour pouvoir les tester sans navigateur.
 *
 * La liste vit dans le navigateur (`localStorage`) et ne garde que des
 * adresses et des titres, jamais un contenu : la visibilité reste résolue par
 * le serveur à l'ouverture de la fiche.
 */
import { z } from "zod";

/** Nombre maximal de fiches gardées, par monde et par espace. */
export const MAX_RECENTS = 20;

/** Les quatre listes d'un monde : les adresses diffèrent selon l'espace (MJ ou joueur). */
export type EspaceRecents = "mj-monde" | "mj-regles" | "joueur-wiki" | "joueur-regles";

const zElementRecent = z.object({
  href: z.string().min(1),
  titre: z.string().min(1),
  /** Identifiant technique (`entity_kind` ou `entry_type`), traduit à l'affichage. */
  type: z.string().optional(),
});
const zListeRecents = z.array(zElementRecent);

export type ElementRecent = z.infer<typeof zElementRecent>;

/** Clé `localStorage` de la liste d'un monde pour un espace. */
export function cleRecents(worldSlug: string, espace: EspaceRecents): string {
  return `creadonjon:recents:${espace}:${worldSlug}`;
}

/** Place `element` en tête, sans doublon (même `href`), 20 au plus. Ne modifie pas `liste`. */
export function ajouterRecent(liste: ElementRecent[], element: ElementRecent): ElementRecent[] {
  return [element, ...liste.filter((e) => e.href !== element.href)].slice(0, MAX_RECENTS);
}

/**
 * Relit la valeur mémorisée. Tolérant : tout ce qui n'est pas une liste valide
 * (absence, JSON cassé, forme d'une version future) donne une liste vide, la
 * liste n'étant qu'un confort. Les champs inconnus sont écartés par Zod.
 */
export function lireRecents(brut: string | null): ElementRecent[] {
  if (brut === null) return [];
  let json: unknown;
  try {
    json = JSON.parse(brut);
  } catch {
    // catch-attendu : valeur corrompue. Repartir d'une liste vide est le comportement voulu, pas une erreur à remonter.
    return [];
  }
  const resultat = zListeRecents.safeParse(json);
  return resultat.success ? resultat.data.slice(0, MAX_RECENTS) : [];
}
