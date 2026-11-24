import { describe, expect, it } from "vitest";
import { ordresDepuisListe, plusRecente, trierLivre } from "./ordreLivre";

const e = (id: string, displayOrder: number, writtenAt: string | null) => ({ id, displayOrder, writtenAt });

describe("l'ordre du Livre de sessions (AG-13)", () => {
  it("suit l'ordre rangé à la main, du plus haut au plus bas", () => {
    const rangees = trierLivre([e("a", 1000, "2026-11-01"), e("b", 3000, "2026-10-01"), e("c", 2000, null)]);
    expect(rangees.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("à égalité, le brouillon puis la plus récente d'abord", () => {
    const rangees = trierLivre([e("a", 0, "2026-10-01"), e("b", 0, "2026-11-01"), e("c", 0, null)]);
    expect(rangees.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("ne modifie pas la liste reçue", () => {
    const liste = [e("a", 1000, null), e("b", 2000, null)];
    trierLivre(liste);
    expect(liste.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("donne à chaque fiche un rang qui reproduit l'ordre déposé", () => {
    expect(ordresDepuisListe(["x", "y", "z"])).toEqual([
      { id: "x", displayOrder: 3000 },
      { id: "y", displayOrder: 2000 },
      { id: "z", displayOrder: 1000 },
    ]);
  });

  it("la plus récente reste la dernière rendue, quel que soit le rangement", () => {
    expect(plusRecente([e("a", 3000, "2026-10-01"), e("b", 1000, "2026-11-01"), e("c", 2000, null)])?.id).toBe("b");
    expect(plusRecente([e("c", 2000, null)])).toBeNull();
  });
});
