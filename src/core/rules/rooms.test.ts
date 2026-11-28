import { describe, expect, it } from "vitest";
import { emptyScene } from "./scene";
import { ajouterPiece, deciderPiece, idDePiece, pieceDeCaptivite, pieceDoitEtreAncree, trouverPiece, validerNouvellePiece } from "./rooms";

const rooms = [
  { id: "cuisine", name: "La cuisine", description: "Basse et enfumée." },
  { id: "cave", name: "Cave", description: "" },
];

describe("trouverPiece — une pièce se reconnaît à son nom, articles et accents ignorés", () => {
  it("avec ou sans article, en capitales ou sans accent", () => {
    expect(trouverPiece("la cuisine", rooms)?.id).toBe("cuisine");
    expect(trouverPiece("CUISINE", rooms)?.id).toBe("cuisine");
    expect(trouverPiece("la cave", rooms)?.id).toBe("cave");
  });
  it("un autre nom : aucune", () => {
    expect(trouverPiece("le grenier", rooms)).toBeNull();
  });
});

describe("validerNouvellePiece — le moteur contrôle une pièce inventée par l'IA", () => {
  const ctx = { rooms, locationName: "Le Fanal", neighbourNames: ["La forge"] };
  it("accepte un nom court et neuf", () => {
    expect(validerNouvellePiece({ name: "Le grenier", description: "Poussiéreux." }, ctx)).toEqual({ ok: true });
  });
  it("refuse un nom vide, trop long, ou avec des chiffres ou des balises", () => {
    expect(validerNouvellePiece({ name: "  ", description: "" }, ctx).ok).toBe(false);
    expect(validerNouvellePiece({ name: "x".repeat(81), description: "" }, ctx).ok).toBe(false);
    expect(validerNouvellePiece({ name: "Salle 12", description: "" }, ctx).ok).toBe(false);
    expect(validerNouvellePiece({ name: "<b>Cave</b>", description: "" }, ctx).ok).toBe(false);
  });
  it("refuse une pièce qui porte le nom du lieu ou d'un lieu voisin : c'est un déplacement, pas une pièce", () => {
    expect(validerNouvellePiece({ name: "le fanal", description: "" }, ctx)).toEqual({ ok: false, reason: "nom_d_un_lieu" });
    expect(validerNouvellePiece({ name: "La Forge", description: "" }, ctx)).toEqual({ ok: false, reason: "nom_d_un_lieu" });
  });
  it("refuse une description trop longue", () => {
    expect(validerNouvellePiece({ name: "Grenier", description: "x".repeat(601) }, ctx).ok).toBe(false);
  });
});

describe("idDePiece", () => {
  it("dérivé du nom, sans article ni accent, unique", () => {
    expect(idDePiece("La Cuisine d'été", [])).toBe("cuisine-d-ete");
    expect(idDePiece("La cuisine", ["cuisine"])).toBe("cuisine-2");
  });
});

describe("ajouterPiece", () => {
  it("ajoute à la fin, sans toucher aux autres", () => {
    const out = ajouterPiece({ __v: 1, rooms }, { name: "Grenier", description: "Sous le toit." });
    expect(out.rooms).toHaveLength(3);
    expect(out.rooms[2]).toEqual({ id: "grenier", name: "Grenier", description: "Sous le toit." });
  });
});

describe("pieceDoitEtreAncree — quand une esquisse de pièce entre dans le wiki", () => {
  it("à la seconde visite", () => {
    expect(pieceDoitEtreAncree({ name: "Grenier", visits: 1 }, "je monte")).toBe(false);
    expect(pieceDoitEtreAncree({ name: "Grenier", visits: 2 }, "je monte")).toBe(true);
  });
  it("dès que le joueur la nomme", () => {
    expect(pieceDoitEtreAncree({ name: "Le grenier", visits: 1 }, "je fouille le grenier")).toBe(true);
  });
});


describe("deciderPiece — le moteur tranche ce que la narration propose", () => {
  const base = emptyScene("fanal");
  const ctx = { wikiRooms: rooms, locationName: "Le Fanal", neighbourNames: ["La forge"], playerAction: "je la suis" };

  it("une pièce du wiki : on y entre, ancrée, rien à écrire", () => {
    const out = deciderPiece(base, { enter: { name: "la cuisine" }, leave: false }, ctx);
    expect(out.scene.room).toEqual({ locationId: "fanal", name: "La cuisine", description: "Basse et enfumée.", anchored: true });
    expect(out.anchor).toBeNull();
    expect(out.changed).toBe(true);
  });

  it("une pièce nouvelle et valide : esquisse, première visite", () => {
    const out = deciderPiece(base, { enter: { name: "Le grenier", description: "Sous le toit." }, leave: false }, ctx);
    expect(out.scene.room).toEqual({ locationId: "fanal", name: "Le grenier", description: "Sous le toit.", anchored: false });
    expect(out.scene.roomSketches).toEqual([{ locationId: "fanal", name: "Le grenier", description: "Sous le toit.", visits: 1 }]);
    expect(out.anchor).toBeNull();
  });

  it("seconde visite d'une esquisse : elle doit entrer dans le wiki", () => {
    const une = deciderPiece(base, { enter: { name: "Le grenier", description: "Sous le toit." }, leave: false }, ctx).scene;
    const sortie = deciderPiece(une, { enter: undefined, leave: true }, ctx).scene;
    expect(sortie.room).toBeNull();
    const deux = deciderPiece(sortie, { enter: { name: "grenier" }, leave: false }, ctx);
    expect(deux.anchor).toEqual({ name: "Le grenier", description: "Sous le toit." });
    expect(deux.scene.roomSketches?.[0]?.visits).toBe(2);
  });

  it("le joueur nomme l'esquisse où il se trouve : elle entre dans le wiki sans changer de pièce", () => {
    const une = deciderPiece(base, { enter: { name: "Le grenier", description: "Sous le toit." }, leave: false }, ctx).scene;
    const out = deciderPiece(une, { enter: undefined, leave: false }, { ...ctx, playerAction: "je fouille le grenier" });
    expect(out.anchor).toEqual({ name: "Le grenier", description: "Sous le toit." });
    expect(out.changed).toBe(false);
  });

  it("une pièce refusée par le contrôle : la scène ne bouge pas", () => {
    const out = deciderPiece(base, { enter: { name: "La forge" }, leave: false }, ctx);
    expect(out.scene).toBe(base);
    expect(out.changed).toBe(false);
    expect(out.refus).toBe("nom_d_un_lieu");
  });

  it("déjà dans la pièce : rien ne change", () => {
    const dans = deciderPiece(base, { enter: { name: "la cuisine" }, leave: false }, ctx).scene;
    expect(deciderPiece(dans, { enter: { name: "Cuisine" }, leave: false }, ctx).changed).toBe(false);
  });
});

describe("pieceDeCaptivite (ADR 0123) — le personnage capturé est enfermé", () => {
  const base = { ...emptyScene("poste"), present: [{ entityId: "garde", zone: "near" as const }, { entityId: "pj", zone: "near" as const }, { entityId: "badaud", zone: "far" as const }] };

  it("une cellule du wiki, s'il y en a une ; le personnage y est seul, le garde reste dehors", () => {
    const out = pieceDeCaptivite(base, { wikiRooms: [{ id: "c", name: "Le cachot", description: "Humide." }], pjId: "pj", lieuDeGarde: true });
    expect(out.room).toEqual({ locationId: "poste", name: "Le cachot", description: "Humide.", anchored: true });
    expect(out.present.map((p) => [p.entityId, p.room])).toEqual([["garde", null], ["pj", "Le cachot"], ["badaud", null]]);
  });

  it("sinon une cellule esquissée au poste du garde, ou une pièce fermée à clé ailleurs", () => {
    expect(pieceDeCaptivite(base, { wikiRooms: rooms, pjId: "pj", lieuDeGarde: true }).room?.name).toBe("Une cellule");
    const ailleurs = pieceDeCaptivite(base, { wikiRooms: [], pjId: "pj", lieuDeGarde: false });
    expect(ailleurs.room).toMatchObject({ name: "Une pièce fermée à clé", anchored: false });
    expect(ailleurs.roomSketches).toHaveLength(1);
  });
});
