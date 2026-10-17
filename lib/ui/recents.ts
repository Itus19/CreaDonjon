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

// ---- « Reprendre » : la dernière fiche ouverte, tous mondes confondus (V3.1-35) ----

/** Clé `localStorage` de la dernière visite, une seule pour tout le navigateur. */
export const CLE_DERNIERE_VISITE = "creadonjon:derniere-visite";

const zDerniereVisite = zElementRecent.extend({
  worldSlug: z.string().min(1),
  /** Date de la visite (ISO), pour « il y a 1 h ». */
  quand: z.string().datetime(),
});

export type DerniereVisite = z.infer<typeof zDerniereVisite>;

/** Même tolérance que `lireRecents` : absence ou valeur abîmée donnent `null`, donc pas de « Reprendre ». */
export function lireDerniereVisite(brut: string | null): DerniereVisite | null {
  if (brut === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(brut);
  } catch {
    // catch-attendu : valeur corrompue. Pas de « Reprendre » plutôt qu'une erreur.
    return null;
  }
  const resultat = zDerniereVisite.safeParse(json);
  return resultat.success ? resultat.data : null;
}
