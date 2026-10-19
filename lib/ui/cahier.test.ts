import { describe, expect, it } from "vitest";
import type { NoteTreeItem } from "@/src/core/schemas/blocks/noteTree";
import {
  construireSommaire,
  contientPageSharee,
  enteteLectureSeule,
  epinglees,
  notesDesAutres,
  notesDeMoi,
  pageParDefaut,
  visibiliteEnregistrement,
  type NoteResume,
} from "./cahier";

const MOI = "user-moi";
const AUTRE = "user-autre";

function page(id: string, title: string, parentId: string | null = null, position = 1000): NoteTreeItem {
  return { id, parentId, position, kind: "page", title, content: [] };
}

function note(entityId: string, authorId: string | null, shared: boolean, title = "Titre"): NoteResume {
  return { entityId, title, authorId, authorName: authorId === MOI ? "MJ" : "Fine", shared };
}

const sansNom = () => null;

describe("visibiliteEnregistrement", () => {
  // Une valeur fausse partagerait une page privée ou masquerait une page partagée : on fige les deux cas.
  it("une page partagée s'enregistre visible de la table, sans portée", () => {
    expect(visibiliteEnregistrement(true, MOI)).toEqual({ level: "players", scopeId: null });
  });

  it("une page repassée en privée s'enregistre visible de son autrice seule", () => {
    expect(visibiliteEnregistrement(false, MOI)).toEqual({ level: "user", scopeId: MOI });
  });
});

describe("notesDesAutres / notesDeMoi", () => {
  const notes = [note("a", AUTRE, true), note("b", AUTRE, false), note("c", MOI, true), note("d", MOI, false), note("e", null, true)];

  it("ne garde des autres que les pages partagées à la table", () => {
    expect(notesDesAutres(notes, MOI).map((n) => n.entityId)).toEqual(["a", "e"]);
  });

  it("garde de soi les pages partagées comme repassées en privée", () => {
    expect(notesDeMoi(notes, MOI).map((n) => n.entityId)).toEqual(["c", "d"]);
  });

  it("n'inclut jamais une page de soi parmi celles des autres", () => {
    expect(notesDesAutres(notes, MOI).some((n) => n.authorId === MOI)).toBe(false);
  });
});

describe("construireSommaire", () => {
  it("parcourt l'arbre en profondeur, dans l'ordre des positions", () => {
    const items = [page("p2", "Intrigues", null, 2000), page("p1", "Séance 12", null, 1000), page("p3", "Culte", "p2", 1000)];
    const lignes = construireSommaire(items, { notes: [], nomFiche: sansNom, nomRegle: sansNom });
    expect(lignes.map((l) => [l.libelle, l.profondeur])).toEqual([
      ["Séance 12", 0],
      ["Intrigues", 0],
      ["Culte", 1],
    ]);
  });

  it("nomme une page sans titre", () => {
    const lignes = construireSommaire([page("p1", "")], { notes: [], nomFiche: sansNom, nomRegle: sansNom });
    expect(lignes[0].libelle).toBe("(sans titre)");
  });

  it("résout une fiche et une règle épinglées, et marque le lien brisé", () => {
    const items: NoteTreeItem[] = [
      { id: "f1", parentId: null, position: 1000, kind: "pinned_entity", targetId: "e1" },
      { id: "f2", parentId: null, position: 2000, kind: "pinned_entity", targetId: "disparue" },
      { id: "r1", parentId: null, position: 3000, kind: "pinned_rule", targetKey: "agrippe" },
    ];
    const lignes = construireSommaire(items, {
      notes: [],
      nomFiche: (id) => (id === "e1" ? "Bram" : null),
      nomRegle: (key) => (key === "agrippe" ? "Agrippé" : null),
    });
    expect(lignes.map((l) => [l.genre, l.libelle, l.cassee])).toEqual([
      ["fiche", "Bram", false],
      ["fiche", "Lien brisé", true],
      ["regle", "Agrippé", false],
    ]);
  });

  it("une page partagée à soi garde sa place, marquée partagée, avec son vrai titre", () => {
    const items: NoteTreeItem[] = [page("p1", "Avant"), { id: "s1", parentId: null, position: 2000, kind: "shared_page", targetId: "ent-1" }];
    const lignes = construireSommaire(items, { notes: [note("ent-1", MOI, true, "Lettre de Bram")], nomFiche: sansNom, nomRegle: sansNom });
    expect(lignes[1]).toMatchObject({ genre: "page_partagee", libelle: "Lettre de Bram", partagee: true, cassee: false });
    expect(lignes[0].partagee).toBe(false);
  });

  it("une page repassée en privée reste à sa place, sans la marque partagée", () => {
    const items: NoteTreeItem[] = [{ id: "s1", parentId: null, position: 1000, kind: "shared_page", targetId: "ent-1" }];
    const lignes = construireSommaire(items, { notes: [note("ent-1", MOI, false, "Lettre")], nomFiche: sansNom, nomRegle: sansNom });
    expect(lignes[0]).toMatchObject({ genre: "page_partagee", partagee: false, cassee: false });
  });

  it("une page partagée dont la vue manque est marquée brisée", () => {
    const items: NoteTreeItem[] = [{ id: "s1", parentId: null, position: 1000, kind: "shared_page", targetId: "ent-1" }];
    const lignes = construireSommaire(items, { notes: [], nomFiche: sansNom, nomRegle: sansNom });
    expect(lignes[0]).toMatchObject({ genre: "page_partagee", cassee: true, partagee: false });
  });
});

describe("epinglees", () => {
  it("ne garde que les fiches et les règles", () => {
    const items: NoteTreeItem[] = [
      page("p1", "Page"),
      { id: "f1", parentId: null, position: 2000, kind: "pinned_entity", targetId: "e1" },
      { id: "r1", parentId: null, position: 3000, kind: "pinned_rule", targetKey: "k" },
    ];
    const lignes = construireSommaire(items, { notes: [], nomFiche: () => "Bram", nomRegle: () => "Règle" });
    expect(epinglees(lignes).map((l) => l.itemId)).toEqual(["f1", "r1"]);
  });
});

describe("contientPageSharee", () => {
  const items: NoteTreeItem[] = [
    page("p1", "Racine"),
    page("p2", "Fille", "p1"),
    { id: "s1", parentId: "p2", position: 1000, kind: "shared_page", targetId: "ent-1" },
    page("p3", "Autre"),
  ];

  it("repère une page partagée parmi les descendants", () => {
    expect(contientPageSharee(items, "p1")).toBe(true);
    expect(contientPageSharee(items, "p2")).toBe(true);
  });

  it("compte la ligne elle-même", () => {
    expect(contientPageSharee(items, "s1")).toBe(true);
  });

  it("répond non pour une branche sans page partagée", () => {
    expect(contientPageSharee(items, "p3")).toBe(false);
  });
});

describe("pageParDefaut", () => {
  it("prend la première page de la racine, page partagée comprise", () => {
    const items: NoteTreeItem[] = [
      { id: "f1", parentId: null, position: 500, kind: "pinned_entity", targetId: "e1" },
      { id: "s1", parentId: null, position: 1000, kind: "shared_page", targetId: "ent-1" },
      page("p1", "Page", null, 2000),
    ];
    expect(pageParDefaut(items)).toBe("s1");
  });

  it("répond null sans aucune page", () => {
    expect(pageParDefaut([])).toBeNull();
  });
});

describe("enteteLectureSeule", () => {
  it("dit l'autrice puis « lecture seule »", () => {
    expect(enteteLectureSeule("Fine")).toBe("Fine · lecture seule");
  });

  it("n'invente pas de nom quand l'autrice a quitté la campagne", () => {
    expect(enteteLectureSeule(null)).toBe("Autrice inconnue · lecture seule");
  });
});
