import { describe, expect, it } from "vitest";
import type { JournalEntry } from "@/src/server/services/activityJournal";
import {
  FILTRES_VIDES,
  compterParElement,
  compterParPartie,
  compterParQui,
  correspond,
  elementDe,
  filtrer,
  groupesChronologiques,
  groupesParFiche,
  listerParties,
  listerPersonnes,
  nombreFiltresActifs,
  type FiltresJournal,
  type LibellesElements,
} from "./journalHistorique";

const LIBELLES: LibellesElements = {
  pj: "Fiches de personnage",
  pnj: "PNJ",
  lieu: "Lieux",
  faction: "Factions",
  objet: "Objets",
  page: "Pages",
  jeu: "Jeu",
};

function entree(partiel: Partial<JournalEntry>): JournalEntry {
  return {
    source: "wiki",
    label: "Révision",
    accountName: "Inès",
    createdAt: "2026-10-08T10:42:00.000Z",
    entitySlug: "sakaburin",
    entityName: "Sakaburin",
    entityKind: "character",
    pc: true,
    revisionNumber: 14,
    blockLabel: "Inventaire",
    blockDetail: null,
    ...partiel,
  };
}

const ENTREES: JournalEntry[] = [
  entree({ createdAt: "2026-10-08T13:00:00.000Z" }),
  entree({ createdAt: "2026-10-08T12:00:00.000Z", entitySlug: "bran", entityName: "Bran", pc: false, blockLabel: "Notes" }),
  entree({ createdAt: "2026-10-07T13:00:00.000Z", accountName: "Marc", blockDetail: "+ Épée longue\n- Torche" }),
  entree({ createdAt: "2026-10-07T12:00:00.000Z", accountName: "Marc", entitySlug: "port", entityName: "Port-Sel", entityKind: "location", pc: false, blockLabel: "Description" }),
  entree({ createdAt: "2026-10-06T13:00:00.000Z", accountName: "IA / système", source: "jeu", entitySlug: null, entityName: null, entityKind: null, pc: false, revisionNumber: null, blockLabel: null, label: "Jet de dés" }),
  entree({ createdAt: "2026-10-06T12:00:00.000Z", accountName: "IA / système", source: "jeu", entitySlug: "bran", entityName: "Bran", pc: false, revisionNumber: null, blockLabel: null, label: "Narration" }),
];

const filtres = (partiel: Partial<FiltresJournal>): FiltresJournal => ({ ...FILTRES_VIDES, ...partiel });

describe("elementDe", () => {
  it("classe chaque entrée dans son élément", () => {
    expect(elementDe(entree({}))).toBe("pj");
    expect(elementDe(entree({ pc: false }))).toBe("pnj");
    expect(elementDe(entree({ entityKind: "creature", pc: false }))).toBe("pnj");
    expect(elementDe(entree({ entityKind: "location", pc: false }))).toBe("lieu");
    expect(elementDe(entree({ entityKind: "faction", pc: false }))).toBe("faction");
    expect(elementDe(entree({ entityKind: "item", pc: false }))).toBe("objet");
    expect(elementDe(entree({ entityKind: "quest", pc: false }))).toBe("page");
    expect(elementDe(entree({ entityKind: "other", pc: false }))).toBe("page");
  });

  it("range un événement de jeu sans fiche dans Jeu, mais avec fiche dans l'élément de la fiche", () => {
    expect(elementDe(ENTREES[4])).toBe("jeu");
    expect(elementDe(ENTREES[5])).toBe("pnj");
  });
});

describe("correspond / filtrer", () => {
  it("cherche sans tenir compte de la casse ni des accents, dans tous les champs", () => {
    expect(filtrer(ENTREES, filtres({ q: "INES" }), LIBELLES)).toHaveLength(2);
    expect(filtrer(ENTREES, filtres({ q: "epee" }), LIBELLES)).toHaveLength(1);
    expect(filtrer(ENTREES, filtres({ q: "description" }), LIBELLES)).toHaveLength(1);
    expect(filtrer(ENTREES, filtres({ q: "port-sel" }), LIBELLES)).toHaveLength(1);
    expect(filtrer(ENTREES, filtres({ q: "lieux" }), LIBELLES)).toHaveLength(1);
  });

  it("combine les facettes par ET, et les valeurs d'une facette par OU", () => {
    expect(filtrer(ENTREES, filtres({ qui: ["Inès", "Marc"] }), LIBELLES)).toHaveLength(4);
    expect(filtrer(ENTREES, filtres({ qui: ["Marc"], elements: ["lieu"] }), LIBELLES)).toHaveLength(1);
    expect(filtrer(ENTREES, filtres({ parties: ["Notes"] }), LIBELLES)).toHaveLength(1);
    expect(filtrer(ENTREES, filtres({ fiche: "bran" }), LIBELLES)).toHaveLength(2);
  });

  it("« Inès » + « Fiches de personnage » ne garde que ses modifications de fiches de PJ", () => {
    const f = filtres({ qui: ["Inès"], elements: ["pj"] });
    const res = filtrer(ENTREES, f, LIBELLES);
    expect(res).toHaveLength(1);
    expect(res[0].entitySlug).toBe("sakaburin");
    expect(res[0].accountName).toBe("Inès");
  });

  it("ignore une facette sur demande", () => {
    const f = filtres({ qui: ["Inès"], elements: ["pj"] });
    expect(correspond(ENTREES[2], f, LIBELLES)).toBe(false);
    expect(correspond(ENTREES[2], f, LIBELLES, "qui")).toBe(true);
    expect(correspond(ENTREES[1], f, LIBELLES, "element")).toBe(true);
  });
});

describe("comptes des puces", () => {
  const f = filtres({ qui: ["Inès"], elements: ["pj"] });

  it("le compte des puces Qui suit tous les filtres sauf Qui", () => {
    const comptes = compterParQui(ENTREES, f, LIBELLES);
    expect(comptes.get("Inès")).toBe(1);
    expect(comptes.get("Marc")).toBe(1);
    expect(comptes.get("IA / système")).toBe(0);
  });

  it("le compte des puces Élément suit tous les filtres sauf Élément", () => {
    const comptes = compterParElement(ENTREES, f, LIBELLES);
    expect(comptes.pj).toBe(1);
    expect(comptes.pnj).toBe(1);
    expect(comptes.lieu).toBe(0);
    expect(comptes.jeu).toBe(0);
  });

  it("le compte des parties suit tous les filtres sauf Partie modifiée", () => {
    const comptes = compterParPartie(ENTREES, f, LIBELLES);
    expect(comptes.get("Inventaire")).toBe(1);
    expect(comptes.get("Notes")).toBe(0);
  });
});

describe("listes de puces", () => {
  it("liste les personnes (plus actives d'abord) et les parties modifiées (alphabétique)", () => {
    expect(listerPersonnes(ENTREES)).toEqual(["Inès", "Marc", "IA / système"]);
    expect(listerParties(ENTREES)).toEqual(["Description", "Inventaire", "Notes"]);
  });

  it("compte les filtres actifs", () => {
    expect(nombreFiltresActifs(FILTRES_VIDES)).toBe(0);
    expect(nombreFiltresActifs(filtres({ q: " ", qui: ["Inès"], elements: ["pj", "pnj"], fiche: "bran" }))).toBe(4);
  });
});

describe("groupesParFiche", () => {
  it("fait une carte par fiche, triée par dernière modification, « sans fiche » comprise", () => {
    const cartes = groupesParFiche(ENTREES);
    expect(cartes.map((c) => c.slug)).toEqual(["sakaburin", "bran", "port", null]);
    expect(cartes[0].entrees).toHaveLength(2);
    expect(cartes[1].entrees).toHaveLength(2);
    expect(cartes[3].nom).toBeNull();
  });
});

describe("groupesChronologiques", () => {
  it("plus récent : groupé par jour, du plus récent au plus ancien", () => {
    const groupes = groupesChronologiques(ENTREES, "recent");
    expect(groupes.every((g) => g.genre === "jour")).toBe(true);
    expect(groupes.map((g) => g.entrees.length)).toEqual([2, 2, 2]);
    expect(groupes[0].entrees[0].createdAt > groupes[0].entrees[1].createdAt).toBe(true);
    expect(groupes[0].cle > groupes[1].cle).toBe(true);
  });

  it("plus ancien : jours et lignes à l'envers", () => {
    const groupes = groupesChronologiques(ENTREES, "ancien");
    expect(groupes[0].cle < groupes[1].cle).toBe(true);
    expect(groupes[0].entrees[0].createdAt < groupes[0].entrees[1].createdAt).toBe(true);
  });

  it("par personne : un groupe par auteur, par ordre alphabétique", () => {
    const groupes = groupesChronologiques(ENTREES, "personne");
    expect(groupes.map((g) => g.cle)).toEqual(["IA / système", "Inès", "Marc"]);
    expect(groupes.every((g) => g.genre === "personne")).toBe(true);
  });

  it("par fiche : un groupe par fiche, « sans fiche » en dernier", () => {
    const groupes = groupesChronologiques(ENTREES, "fiche");
    expect(groupes.map((g) => g.cle)).toEqual(["bran", "port", "sakaburin", ""]);
    expect(groupes.every((g) => g.genre === "fiche")).toBe(true);
  });
});

describe("parties modifiées d'une révision qui en touche plusieurs", () => {
  // Le serveur joint les parties d'une même révision par « , » (`computeBlockLabels`).
  const multiples = [entree({ blockLabel: "Personnage, Inventaire" }), entree({ blockLabel: "Inventaire" }), entree({ blockLabel: "Personnage, Inventaire, Incantation" })];
  it("chaque partie est une case à part, jamais une combinaison", () => {
    expect(listerParties(multiples)).toEqual(["Incantation", "Inventaire", "Personnage"]);
  });
  it("une révision compte dans chacune de ses parties", () => {
    const comptes = compterParPartie(multiples, FILTRES_VIDES, LIBELLES);
    expect(comptes.get("Inventaire")).toBe(3);
    expect(comptes.get("Personnage")).toBe(2);
    expect(comptes.get("Incantation")).toBe(1);
  });
  it("filtrer sur « Incantation » garde la révision qui la touche parmi d'autres parties", () => {
    expect(filtrer(multiples, filtres({ parties: ["Incantation"] }), LIBELLES)).toHaveLength(1);
  });
});
