import { describe, expect, it } from "vitest";
import {
  cadrageSur,
  centreZone,
  marqueurElement,
  objetPastille,
  ordonnerCouches,
  rangerParCouches,
  texteInfoBulle,
  type CoucheCarte,
  type ElementCarte,
} from "./carte";

const c = (id: string, name: string, displayOrder: number): CoucheCarte => ({ id, name, displayOrder, visibilityLevel: "public" });
const e = (id: string, genre: "pin" | "region", layerId: string | null, nom = id): ElementCarte => ({
  id,
  genre,
  nom,
  layerId,
  visibilityLevel: "public",
  centre: { x: 0.5, y: 0.5 },
});

describe("ordonnerCouches", () => {
  it("suit l'ordre d'affichage puis le nom, de façon stable", () => {
    const r = ordonnerCouches([c("b", "Routes", 2), c("a", "Lieux", 1), c("z", "Routes", 2)]);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "z"]);
  });
});

describe("rangerParCouches", () => {
  const couches = [c("l2", "Secret", 2), c("l1", "Lieux", 1)];
  it("range par couche, punaises avant zones, sans perdre l'ordre reçu", () => {
    const g = rangerParCouches(couches, [e("r1", "region", "l1"), e("p2", "pin", "l1"), e("p1", "pin", "l1"), e("p3", "pin", "l2")]);
    expect(g.map((x) => x.couche?.id)).toEqual(["l1", "l2"]);
    expect(g[0]!.elements.map((x) => x.id)).toEqual(["p2", "p1", "r1"]);
  });
  it("garde une couche vide", () => {
    const g = rangerParCouches(couches, []);
    expect(g).toHaveLength(2);
    expect(g[0]!.elements).toEqual([]);
  });
  it("met en tête les éléments sans couche ou d'une couche inconnue", () => {
    const g = rangerParCouches(couches, [e("p1", "pin", null), e("p2", "pin", "inconnue"), e("p3", "pin", "l1")]);
    expect(g[0]!.couche).toBeNull();
    expect(g[0]!.elements.map((x) => x.id)).toEqual(["p1", "p2"]);
  });
  it("sans couche du tout (wiki public), une seule liste plate", () => {
    const g = rangerParCouches([], [e("p1", "pin", "x"), e("r1", "region", null)]);
    expect(g).toHaveLength(1);
    expect(g[0]!.couche).toBeNull();
  });
});

describe("marqueurElement", () => {
  it("point ambre pour une punaise", () => {
    expect(marqueurElement("pin", "public")).toEqual({ forme: "point", classe: "bg-accent" });
  });
  it("point orange pour une punaise du MJ", () => {
    expect(marqueurElement("pin", "gm")).toEqual({ forme: "point", classe: "bg-gm" });
  });
  it("carré vert pour une zone, quelle que soit sa visibilité", () => {
    expect(marqueurElement("region", "gm")).toEqual({ forme: "carre", classe: "bg-success" });
  });
});

describe("cadrageSur", () => {
  const image = { largeur: 4000, hauteur: 2000 };
  const fenetre = { largeur: 800, hauteur: 400 };
  it("toucher un nom centre la carte sur l'élément", () => {
    const centre = { x: 0.25, y: 0.75 };
    const vue = cadrageSur(centre, image, fenetre, 0.2);
    // Le point de l'image se retrouve au milieu de la fenêtre.
    expect(vue.x + centre.x * image.largeur * vue.scale).toBeCloseTo(fenetre.largeur / 2);
    expect(vue.y + centre.y * image.hauteur * vue.scale).toBeCloseTo(fenetre.hauteur / 2);
  });
  it("agrandit si on est trop loin", () => {
    expect(cadrageSur({ x: 0.5, y: 0.5 }, image, fenetre, 0.2).scale).toBeCloseTo(0.2 * 1.5);
  });
  it("ne dézoome jamais", () => {
    expect(cadrageSur({ x: 0.5, y: 0.5 }, image, fenetre, 2).scale).toBe(2);
  });
  it("ne dépasse pas le zoom maximal", () => {
    expect(cadrageSur({ x: 0.5, y: 0.5 }, image, fenetre, 50).scale).toBe(8);
  });
});

describe("centreZone", () => {
  it("prend le milieu du cadre", () => {
    expect(centreZone([{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.2 }, { x: 0.3, y: 0.6 }])).toEqual({ x: 0.3, y: 0.4 });
  });
});

describe("objetPastille", () => {
  const l = { punaise: "Punaise", zone: "Zone", couche: "Couche", suffixePunaise: "et seulement si sa couche l'est aussi" };
  it("une punaise le dit : visible seulement si sa couche l'est", () => {
    expect(objetPastille("pin", "Auberge", l)).toBe("Punaise Auberge (et seulement si sa couche l'est aussi)");
  });
  it("une zone ou une couche n'ajoute rien", () => {
    expect(objetPastille("region", "Forêt", l)).toBe("Zone Forêt");
    expect(objetPastille("layer", "Routes", l)).toBe("Couche Routes");
  });
});

describe("texteInfoBulle", () => {
  it("nom, couche, visibilité ; saute la couche absente", () => {
    expect(texteInfoBulle("Auberge", "Lieux", "Public")).toBe("Auberge · Lieux · Public");
    expect(texteInfoBulle("Auberge", null, "Public")).toBe("Auberge · Public");
  });
});

describe("elementsDepuis", () => {
  it("mêle punaises et zones, le centre d'une zone étant celui de son cadre", async () => {
    const { elementsDepuis } = await import("./carte");
    const r = elementsDepuis(
      [{ id: "p", x: 0.1, y: 0.2, label: "Auberge", layerId: "l", visibilityLevel: "gm" }],
      [{ id: "z", name: "Forêt", shape: [{ x: 0, y: 0 }, { x: 0.4, y: 0.2 }], layerId: null, visibilityLevel: "public" }],
    );
    expect(r.map((x) => [x.id, x.genre, x.nom])).toEqual([["p", "pin", "Auberge"], ["z", "region", "Forêt"]]);
    expect(r[0]!.centre).toEqual({ x: 0.1, y: 0.2 });
    expect(r[1]!.centre).toEqual({ x: 0.2, y: 0.1 });
  });
});
