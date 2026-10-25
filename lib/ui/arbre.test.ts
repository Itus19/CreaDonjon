import { describe, expect, it } from "vitest";
import type { FamilyTree, FamilyTreeEdge, FamilyTreeNode } from "@/src/core/genealogy/buildFamilyTree";
import type { GameDate } from "@/src/core/calendar/types";
import {
  GABARIT_ETROIT,
  GABARIT_LARGE,
  casesEnfant,
  coude,
  dimensions,
  estDefunt,
  gabaritPour,
  ligneDates,
  position,
  traits,
  vueAjustee,
  vueCentree,
  zoomerAutour,
} from "./arbre";

const noeud = (id: string, generation: number, order: number, extra: Partial<FamilyTreeNode> = {}): FamilyTreeNode => ({
  id,
  name: id,
  slug: id,
  entityKind: "character",
  generation,
  order,
  ...extra,
});
const lien = (id: string, kind: FamilyTreeEdge["kind"], fromId: string, toId: string, extra: Partial<FamilyTreeEdge> = {}): FamilyTreeEdge => ({
  id,
  kind,
  fromId,
  toId,
  label: "x",
  visibilityLevel: "public",
  ...extra,
});
const arbre = (nodes: FamilyTreeNode[], edges: FamilyTreeEdge[]): FamilyTree => ({
  nodes,
  edges,
  minGeneration: Math.min(...nodes.map((n) => n.generation)),
  maxGeneration: Math.max(...nodes.map((n) => n.generation)),
});

const g = GABARIT_LARGE; // 100 × 130, écarts 70 / 90, rayon 14
const date = (year: number): GameDate => ({ year, month: null, day: null, precision: "year", end: null, label: null });

describe("gabarit", () => {
  it("100 × 130 sur ordinateur, 66 × 88 sous 28 rem", () => {
    expect(gabaritPour(920)).toBe(GABARIT_LARGE);
    expect(gabaritPour(390)).toBe(GABARIT_ETROIT);
    expect(GABARIT_ETROIT.largeur).toBe(66);
    expect(GABARIT_ETROIT.hauteur).toBe(88);
    expect(gabaritPour(0)).toBe(GABARIT_LARGE);
  });
  it("place les cartes par colonne et par génération", () => {
    expect(position({ order: 2, generation: 1 }, 0, g)).toEqual({ x: 340, y: 220 });
    expect(position({ order: 0, generation: -1 }, -1, g)).toEqual({ x: 0, y: 0 });
  });
  it("mesure l'arbre", () => {
    expect(dimensions(arbre([noeud("a", 0, 0), noeud("b", 1, 1)], []), g)).toEqual({ largeur: 270, hauteur: 350 });
  });
});

describe("coude", () => {
  it("droit quand parent et enfant sont alignés", () => {
    expect(coude(50, 130, 50, 220, 175, 14)).toBe("M50 130 V220");
  });
  it("arrondit les deux coins, à droite", () => {
    expect(coude(0, 100, 100, 200, 150, 14)).toBe("M0 100 V136 Q0 150 14 150 H86 Q100 150 100 164 V200");
  });
  it("arrondit à gauche, et réduit le rayon quand la place manque", () => {
    expect(coude(100, 100, 90, 200, 150, 14)).toBe("M100 100 V145 Q100 150 95 150 H95 Q90 150 90 155 V200");
  });
});

describe("traits", () => {
  // p1 (col 0) et p2 (col 1) en couple, un enfant (col 0) au-dessous.
  const nodes = [noeud("p1", 0, 0), noeud("p2", 0, 1), noeud("e", 1, 0)];
  const edges = [lien("c", "partner", "p1", "p2"), lien("a", "parent-child", "p1", "e"), lien("b", "parent-child", "p2", "e")];
  const t = traits(arbre(nodes, edges), g);
  const parId = (id: string) => t.find((x) => x.edgeId === id);

  it("relie le couple à l'horizontale, à mi-hauteur des cartes", () => {
    expect(parId("c")?.d).toBe("M50 65 H220");
  });
  it("fait descendre les enfants du MILIEU du couple, par la même descente pour les deux parents", () => {
    expect(parId("a")?.d).toBe(parId("b")?.d);
    expect(parId("a")?.d.startsWith("M135 65 ")).toBe(true);
  });
  it("sans conjoint, l'enfant descend du bas de son parent", () => {
    const seul = traits(arbre([noeud("p", 0, 0), noeud("e", 1, 0)], [lien("a", "parent-child", "p", "e")]), g);
    expect(seul[0].d).toBe("M50 130 V220");
  });
  it("pose l'étiquette au milieu du trait", () => {
    expect(parId("c")?.milieu).toEqual({ x: 135, y: 65 });
    expect(parId("a")?.milieu).toEqual({ x: 92.5, y: 175 });
  });
  it("marque l'ex-partenaire (pointillé orange) et lui seul", () => {
    const avecEx = traits(arbre([noeud("a", 0, 0), noeud("b", 0, 1), noeud("c", 0, 2)], [lien("e1", "partner", "a", "b", { ex: true }), lien("e2", "partner", "b", "c")]), g);
    expect(avecEx.find((x) => x.edgeId === "e1")?.ex).toBe(true);
    expect(avecEx.find((x) => x.edgeId === "e2")?.ex).toBe(false);
  });
});

describe("casesEnfant", () => {
  const couple = [noeud("a", 0, 0), noeud("b", 0, 1)];
  it("une case sous un couple sans enfant, centrée, une génération plus bas", () => {
    const cases = casesEnfant(arbre(couple, [lien("c", "partner", "a", "b")]), g);
    expect(cases).toEqual([{ edgeId: "c", parentA: "a", parentB: "b", x: 85, y: 220 }]);
  });
  it("aucune case si l'un des deux a déjà un enfant", () => {
    const t = arbre([...couple, noeud("e", 1, 0)], [lien("c", "partner", "a", "b"), lien("p", "parent-child", "a", "e")]);
    expect(casesEnfant(t, g)).toEqual([]);
  });
  it("aucune case sous un ex-partenaire", () => {
    expect(casesEnfant(arbre(couple, [lien("c", "partner", "a", "b", { ex: true })]), g)).toEqual([]);
  });
});

describe("ligneDates", () => {
  const f = (d: GameDate) => `an ${d.year}`;
  it("vide quand il n'y a aucune date : le composant n'écrit rien", () => {
    expect(ligneDates({}, f, date(1500))).toBeNull();
  });
  it("naissance seule : l'âge se calcule à la date du jour du monde", () => {
    expect(ligneDates({ birth: date(1470) }, f, date(1500))).toEqual({ naissance: "an 1470", age: 30 });
  });
  it("sans date du jour, pas d'âge", () => {
    expect(ligneDates({ birth: date(1470) }, f, null)).toEqual({ naissance: "an 1470" });
  });
  it("un défunt : l'âge est celui de sa mort, pas d'aujourd'hui", () => {
    expect(ligneDates({ birth: date(1470), death: date(1520) }, f, date(1600))).toEqual({ naissance: "an 1470", mort: "an 1520", age: 50 });
  });
  it("défunt = mort renseignée", () => {
    expect(estDefunt({ death: date(1520) })).toBe(true);
    expect(estDefunt({})).toBe(false);
  });
});

describe("vue", () => {
  const limites = { min: 0.3, max: 2.5 };
  it("ajuste l'arbre à la fenêtre sans jamais dépasser 100 %", () => {
    const petit = vueAjustee({ largeur: 200, hauteur: 100 }, { largeur: 800, hauteur: 400 }, limites);
    expect(petit.scale).toBe(1);
    expect(petit.x).toBe(300);
    const grand = vueAjustee({ largeur: 1600, hauteur: 100 }, { largeur: 800, hauteur: 400 }, limites);
    expect(grand.scale).toBeCloseTo(800 / 1632);
  });
  it("centre un point du monde au milieu de la fenêtre", () => {
    const v = vueCentree({ x: 300, y: 200 }, { largeur: 400, hauteur: 300 }, 1);
    expect(v).toEqual({ scale: 1, x: -100, y: -50 });
    // Le point (300, 200) tombe bien au centre (200, 150) de la fenêtre.
    expect(300 * v.scale + v.x).toBe(200);
    expect(200 * v.scale + v.y).toBe(150);
  });
  it("zoomer autour d'un point le laisse en place, et reste dans les limites", () => {
    const v0 = { x: 10, y: 20, scale: 1 };
    const v1 = zoomerAutour(v0, 2, { x: 110, y: 120 }, limites);
    expect(v1.scale).toBe(2);
    expect(110 - v1.x).toBeCloseTo((110 - v0.x) * 2);
    expect(zoomerAutour(v0, 100, { x: 0, y: 0 }, limites).scale).toBe(2.5);
    expect(zoomerAutour(v0, 0.001, { x: 0, y: 0 }, limites).scale).toBe(0.3);
  });
});
