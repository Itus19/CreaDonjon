import { describe, expect, it } from "vitest";
import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import { flouApercuPx, sommaireApercu, titreApercu } from "./publication";

function groupe(kind: string, noms: string[]): EntityTreeGroup {
  return { kind, items: noms.map((name, i) => ({ id: `${kind}${i}`, name, slug: name, displayOrder: i, version: 1, children: [] })) };
}

describe("titreApercu", () => {
  it("prend le message", () => expect(titreApercu("Bienvenue", "Ma campagne")).toBe("Bienvenue"));
  it("retombe sur le nom de la campagne si le message est vide ou blanc", () => {
    expect(titreApercu("", "Ma campagne")).toBe("Ma campagne");
    expect(titreApercu("   ", "Ma campagne")).toBe("Ma campagne");
  });
});

describe("sommaireApercu", () => {
  it("garde 3 groupes de 3 noms", () => {
    const arbre = [groupe("a", ["1", "2", "3", "4"]), groupe("b", ["5"]), groupe("c", ["6"]), groupe("d", ["7"])];
    expect(sommaireApercu(arbre)).toEqual([["1", "2", "3"], ["5"], ["6"]]);
  });
  it("saute un groupe vide", () => expect(sommaireApercu([groupe("a", []), groupe("b", ["x"])])).toEqual([["x"]]));
  it("accepte un sommaire vide", () => expect(sommaireApercu([])).toEqual([]));
});

describe("flouApercuPx", () => {
  it("réduit le flou", () => expect(flouApercuPx(40)).toBeCloseTo(14));
});
