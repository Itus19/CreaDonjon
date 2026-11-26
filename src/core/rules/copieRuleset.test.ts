import { describe, expect, it } from "vitest";
import { lireReference, miseAJourCopie, type EmpreinteRegle } from "./copieRuleset";

const e = (entryKey: string, digest: string, label = entryKey): EmpreinteRegle => ({ entryKey, digest, label });

describe("mise à jour d'une copie de ruleset (AG-18, ADR 0106)", () => {
  it("rien à reprendre quand la source n'a pas bougé depuis la copie", () => {
    expect(miseAJourCopie({ boule: "a", soin: "b" }, [e("boule", "a"), e("soin", "b")])).toEqual([]);
  });

  it("une règle changée, ajoutée ou retirée dans la source, chacune une fois", () => {
    const regles = miseAJourCopie({ boule: "a", soin: "b", vieux: "c" }, [e("boule", "a2", "Boule de feu"), e("soin", "b"), e("neuf", "n", "Don neuf")]);
    expect(regles).toEqual([
      { entryKey: "boule", label: "Boule de feu", etat: "modifiee", digest: "a2" },
      { entryKey: "neuf", label: "Don neuf", etat: "nouvelle", digest: "n" },
      { entryKey: "vieux", label: "vieux", etat: "retiree", digest: null },
    ]);
  });

  it("trie par libellé, pour une liste stable d'une visite à l'autre", () => {
    const regles = miseAJourCopie({}, [e("z", "1", "Zèle"), e("a", "2", "Arc")]);
    expect(regles.map((r) => r.label)).toEqual(["Arc", "Zèle"]);
  });

  it("une référence illisible compte comme vide, jamais comme une erreur", () => {
    expect(lireReference(null)).toEqual({});
    expect(lireReference(["x"])).toEqual({});
    expect(lireReference({ boule: "a", mauvais: 3 })).toEqual({ boule: "a" });
  });
});
