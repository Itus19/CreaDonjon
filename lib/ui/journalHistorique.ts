import type { JournalEntry } from "@/src/server/services/activityJournal";

/**
 * Logique pure du journal historique (V3.1-61) : éléments, filtres, comptes
 * des puces et regroupements. Tout se fait côté client sur les entrées déjà
 * reçues (pas de requête par filtre). Aucune dépendance à React.
 */

/** Nom que le serveur donne à un auteur absent (événement de jeu, IA) ; c'est lui qui porte le glyphe ✦. */
export const PERSONNE_IA = "IA / système";

/** Initiale de l'avatar : ✦ pour « IA / système ». */
export function initialeDe(nom: string): string {
  return nom === PERSONNE_IA ? "✦" : (nom.trim()[0] ?? "?").toUpperCase();
}

/** Les sept « éléments » du filtre : ce que le MJ a modifié, à gros grain. */
export const ELEMENTS_JOURNAL = ["pj", "pnj", "lieu", "faction", "objet", "page", "jeu"] as const;
export type ElementJournal = (typeof ELEMENTS_JOURNAL)[number];

export type LibellesElements = Record<ElementJournal, string>;

export interface FiltresJournal {
  q: string;
  /** Noms de personnes retenus (OU). */
  qui: string[];
  elements: ElementJournal[];
  /** `entitySlug` d'une seule fiche (« ne montrer que cette fiche »). */
  fiche: string | null;
  /** Noms de « partie modifiée » retenus (OU). */
  parties: string[];
}

export const FILTRES_VIDES: FiltresJournal = { q: "", qui: [], elements: [], fiche: null, parties: [] };

export type TriJournal = "recent" | "ancien" | "personne" | "fiche";

/** Facette qu'on ignore pour compter les puces de cette même facette. */
export type FacetteIgnoree = "qui" | "element" | "partie";

/** L'élément d'une entrée : un événement de jeu AVEC fiche compte dans l'élément de sa fiche. */
export function elementDe(entree: JournalEntry): ElementJournal {
  switch (entree.entityKind) {
    case null:
      return "jeu";
    case "character":
      return entree.pc ? "pj" : "pnj";
    case "creature":
      return "pnj";
    case "location":
      return "lieu";
    case "faction":
      return "faction";
    case "item":
      return "objet";
    default:
      return "page";
  }
}

/** Minuscules sans accents, pour la recherche. */
/** Les parties modifiées d'une entrée : le serveur joint celles d'une même révision par « , ». */
export function partiesDe(entree: JournalEntry): string[] {
  return entree.blockLabel === null ? [] : entree.blockLabel.split(", ").filter((p) => p.trim() !== "");
}

export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function correspondALaRecherche(entree: JournalEntry, q: string, libelles: LibellesElements): boolean {
  const requete = normaliser(q);
  if (requete === "") return true;
  const champs = [entree.accountName, entree.entityName, entree.blockLabel, entree.blockDetail, entree.label, libelles[elementDe(entree)]];
  return champs.some((champ) => champ !== null && normaliser(champ).includes(requete));
}

/** Vrai si l'entrée passe tous les filtres, sauf la facette `ignorer` (pour compter les puces). */
export function correspond(entree: JournalEntry, filtres: FiltresJournal, libelles: LibellesElements, ignorer?: FacetteIgnoree): boolean {
  if (!correspondALaRecherche(entree, filtres.q, libelles)) return false;
  if (filtres.fiche !== null && entree.entitySlug !== filtres.fiche) return false;
  if (ignorer !== "qui" && filtres.qui.length > 0 && !filtres.qui.includes(entree.accountName)) return false;
  if (ignorer !== "element" && filtres.elements.length > 0 && !filtres.elements.includes(elementDe(entree))) return false;
  if (ignorer !== "partie" && filtres.parties.length > 0 && !partiesDe(entree).some((p) => filtres.parties.includes(p))) return false;
  return true;
}

export function filtrer<T extends JournalEntry>(entrees: T[], filtres: FiltresJournal, libelles: LibellesElements): T[] {
  return entrees.filter((e) => correspond(e, filtres, libelles));
}

/** Compte des puces « Qui » : tous les filtres sauf Qui. */
export function compterParQui(entrees: JournalEntry[], filtres: FiltresJournal, libelles: LibellesElements): Map<string, number> {
  const comptes = new Map<string, number>();
  for (const personne of listerPersonnes(entrees)) comptes.set(personne, 0);
  for (const e of entrees) {
    if (correspond(e, filtres, libelles, "qui")) comptes.set(e.accountName, (comptes.get(e.accountName) ?? 0) + 1);
  }
  return comptes;
}

/** Compte des puces « Élément » : tous les filtres sauf Élément. */
export function compterParElement(entrees: JournalEntry[], filtres: FiltresJournal, libelles: LibellesElements): Record<ElementJournal, number> {
  const comptes: Record<ElementJournal, number> = { pj: 0, pnj: 0, lieu: 0, faction: 0, objet: 0, page: 0, jeu: 0 };
  for (const e of entrees) {
    if (correspond(e, filtres, libelles, "element")) comptes[elementDe(e)] += 1;
  }
  return comptes;
}

/** Compte des cases « Partie modifiée » : tous les filtres sauf Partie modifiée. */
export function compterParPartie(entrees: JournalEntry[], filtres: FiltresJournal, libelles: LibellesElements): Map<string, number> {
  const comptes = new Map<string, number>();
  for (const partie of listerParties(entrees)) comptes.set(partie, 0);
  for (const e of entrees) {
    if (!correspond(e, filtres, libelles, "partie")) continue;
    for (const partie of partiesDe(e)) comptes.set(partie, (comptes.get(partie) ?? 0) + 1);
  }
  return comptes;
}

/** Les personnes du journal, les plus actives d'abord (à égalité, par première apparition). */
export function listerPersonnes(entrees: JournalEntry[]): string[] {
  const comptes = new Map<string, number>();
  for (const e of entrees) comptes.set(e.accountName, (comptes.get(e.accountName) ?? 0) + 1);
  return [...comptes.keys()].sort((a, b) => (comptes.get(b) ?? 0) - (comptes.get(a) ?? 0));
}

/** Les parties modifiées présentes dans le journal, par ordre alphabétique. */
export function listerParties(entrees: JournalEntry[]): string[] {
  const parties = new Set<string>();
  for (const e of entrees) for (const partie of partiesDe(e)) parties.add(partie);
  return [...parties].sort((a, b) => a.localeCompare(b, "fr"));
}

export function nombreFiltresActifs(filtres: FiltresJournal): number {
  return (
    (filtres.q.trim() !== "" ? 1 : 0) +
    filtres.qui.length +
    filtres.elements.length +
    filtres.parties.length +
    (filtres.fiche !== null ? 1 : 0)
  );
}

const plusRecentDAbord = (a: JournalEntry, b: JournalEntry) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

export interface CarteFiche<T extends JournalEntry> {
  /** `null` : la carte « Sans fiche (jeu) ». */
  slug: string | null;
  nom: string | null;
  entityKind: string | null;
  pc: boolean;
  /** Plus récent d'abord. */
  entrees: T[];
}

/** « Par fiche » : une carte par fiche, triées par dernière modification ; les événements sans fiche ensemble. */
export function groupesParFiche<T extends JournalEntry>(entrees: T[]): CarteFiche<T>[] {
  const cartes = new Map<string, CarteFiche<T>>();
  for (const e of [...entrees].sort(plusRecentDAbord)) {
    const cle = e.entitySlug ?? "";
    let carte = cartes.get(cle);
    if (!carte) {
      carte = { slug: e.entitySlug, nom: e.entityName, entityKind: e.entityKind, pc: e.pc, entrees: [] };
      cartes.set(cle, carte);
    }
    carte.entrees.push(e);
  }
  // Les cartes sont créées dans l'ordre de la dernière modification : le tri est déjà fait.
  return [...cartes.values()];
}

export interface GroupeChrono<T extends JournalEntry> {
  genre: "jour" | "personne" | "fiche";
  /** Jour local `AAAA-MM-JJ`, nom de la personne ou `entitySlug` (`""` sans fiche). */
  cle: string;
  entrees: T[];
}

/** Jour local d'un instant ISO, `AAAA-MM-JJ`. */
export function cleDuJour(iso: string): string {
  const d = new Date(iso);
  const deux = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

function regrouper<T extends JournalEntry>(entrees: T[], genre: GroupeChrono<T>["genre"], cleDe: (e: T) => string): GroupeChrono<T>[] {
  const groupes = new Map<string, GroupeChrono<T>>();
  for (const e of entrees) {
    const cle = cleDe(e);
    let groupe = groupes.get(cle);
    if (!groupe) {
      groupe = { genre, cle, entrees: [] };
      groupes.set(cle, groupe);
    }
    groupe.entrees.push(e);
  }
  return [...groupes.values()];
}

/** « Chronologique » : la liste groupée selon le tri. Chaque groupe garde ses lignes du plus récent au plus ancien, sauf « plus ancien ». */
export function groupesChronologiques<T extends JournalEntry>(entrees: T[], tri: TriJournal): GroupeChrono<T>[] {
  const recents = [...entrees].sort(plusRecentDAbord);
  switch (tri) {
    case "recent":
      return regrouper(recents, "jour", (e) => cleDuJour(e.createdAt));
    case "ancien":
      return regrouper([...recents].reverse(), "jour", (e) => cleDuJour(e.createdAt));
    case "personne":
      return regrouper(recents, "personne", (e) => e.accountName).sort((a, b) => a.cle.localeCompare(b.cle, "fr"));
    case "fiche":
      return regrouper(recents, "fiche", (e) => e.entitySlug ?? "").sort((a, b) => {
        if (a.cle === "") return b.cle === "" ? 0 : 1;
        if (b.cle === "") return -1;
        return (a.entrees[0].entityName ?? a.cle).localeCompare(b.entrees[0].entityName ?? b.cle, "fr");
      });
  }
}
