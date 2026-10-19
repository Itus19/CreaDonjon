import type { NoteTreeItem } from "@/src/core/schemas/blocks/noteTree";

/**
 * Logique pure du cahier (V3.1-42) : le sommaire, le partage entre « miennes »
 * et « partagées par d'autres », et la visibilité d'enregistrement d'une page.
 * Aucun accès réseau ni React : testable en millisecondes.
 */

/** Glyphes du sommaire (planche) : page, fiche épinglée, règle épinglée. */
export const GLYPHE_PAGE = "▤";
export const GLYPHE_FICHE = "◆";
export const GLYPHE_REGLE = "§";

/** Ce que la logique sait d'une page partagée ; `SharedNoteView` (serveur) s'y conforme. */
export interface NoteResume {
  entityId: string;
  title: string;
  authorId: string | null;
  authorName: string | null;
  /** Partagée à la table (vrai) ou repassée en privée par son autrice (faux). */
  shared: boolean;
}

export type GenreLigne = "page" | "page_partagee" | "fiche" | "regle";

export interface LigneSommaire {
  itemId: string;
  parentId: string | null;
  genre: GenreLigne;
  profondeur: number;
  libelle: string;
  /** Page à soi actuellement partagée à la table : porte la marque « partagée ». */
  partagee: boolean;
  /** Lien brisé : fiche ou règle disparue, ou page partagée introuvable. */
  cassee: boolean;
}

function enfants(items: readonly NoteTreeItem[], parentId: string | null): NoteTreeItem[] {
  return items.filter((i) => i.parentId === parentId).sort((a, b) => a.position - b.position);
}

const LIBELLE_SANS_TITRE = "(sans titre)";
const LIBELLE_LIEN_BRISE = "Lien brisé";

/**
 * Les lignes de « Mon cahier », parcourues en profondeur dans l'ordre des
 * positions. Les noms de fiche et de règle se résolvent côté client (jamais
 * dupliqués dans l'arbre) : l'appelant les fournit.
 */
export function construireSommaire(
  items: readonly NoteTreeItem[],
  contexte: {
    notes: readonly NoteResume[];
    nomFiche: (entityId: string) => string | null;
    nomRegle: (key: string) => string | null;
  }
): LigneSommaire[] {
  const lignes: LigneSommaire[] = [];
  const visiter = (parentId: string | null, profondeur: number) => {
    for (const item of enfants(items, parentId)) {
      const base = { itemId: item.id, parentId: item.parentId, profondeur };
      if (item.kind === "page") {
        lignes.push({ ...base, genre: "page", libelle: item.title.trim() || LIBELLE_SANS_TITRE, partagee: false, cassee: false });
      } else if (item.kind === "shared_page") {
        const note = contexte.notes.find((n) => n.entityId === item.targetId);
        lignes.push({
          ...base,
          genre: "page_partagee",
          libelle: note ? note.title.trim() || LIBELLE_SANS_TITRE : LIBELLE_LIEN_BRISE,
          partagee: note?.shared ?? false,
          cassee: !note,
        });
      } else if (item.kind === "pinned_entity") {
        const nom = contexte.nomFiche(item.targetId);
        lignes.push({ ...base, genre: "fiche", libelle: nom ?? LIBELLE_LIEN_BRISE, partagee: false, cassee: nom === null });
      } else {
        const nom = contexte.nomRegle(item.targetKey);
        lignes.push({ ...base, genre: "regle", libelle: nom ?? LIBELLE_LIEN_BRISE, partagee: false, cassee: nom === null });
      }
      visiter(item.id, profondeur + 1);
    }
  };
  visiter(null, 0);
  return lignes;
}

/** Les fiches et règles épinglées (les puces du téléphone du MJ). */
export function epinglees(lignes: readonly LigneSommaire[]): LigneSommaire[] {
  return lignes.filter((l) => l.genre === "fiche" || l.genre === "regle");
}

/** « Partagées à la table » : les pages des AUTRES, et seulement celles que leur autrice a laissées partagées. */
export function notesDesAutres<T extends NoteResume>(notes: readonly T[], userId: string): T[] {
  return notes.filter((n) => n.authorId !== userId && n.shared);
}

/** Les pages de soi, partagées ou repassées en privée (la liste serveur contient les deux). */
export function notesDeMoi<T extends NoteResume>(notes: readonly T[], userId: string): T[] {
  return notes.filter((n) => n.authorId === userId);
}

/**
 * La visibilité sous laquelle s'enregistre une page partagée de SOI. Valeurs
 * exactes : une autre partagerait une page privée, ou masquerait une page
 * partagée. `players` sans portée = « la table » ; `user` + son identifiant =
 * l'autrice seule.
 */
export function visibiliteEnregistrement(partagee: boolean, userId: string): { level: "players"; scopeId: null } | { level: "user"; scopeId: string } {
  return partagee ? { level: "players", scopeId: null } : { level: "user", scopeId: userId };
}

/** Vrai si la ligne ou l'un de ses descendants est une page partagée (supprimer la ligne l'orphelinerait). */
export function contientPageSharee(items: readonly NoteTreeItem[], itemId: string): boolean {
  const racine = items.find((i) => i.id === itemId);
  if (!racine) return false;
  if (racine.kind === "shared_page") return true;
  return enfants(items, itemId).some((enfant) => contientPageSharee(items, enfant.id));
}

/** La page à ouvrir d'office : la première de la racine (page ou page partagée), sinon rien. */
export function pageParDefaut(items: readonly NoteTreeItem[]): string | null {
  return enfants(items, null).find((i) => i.kind === "page" || i.kind === "shared_page")?.id ?? null;
}

/** L'en-tête d'une page d'une autre personne. */
export function enteteLectureSeule(nomAutrice: string | null): string {
  return `${nomAutrice ?? "Autrice inconnue"} · lecture seule`;
}
