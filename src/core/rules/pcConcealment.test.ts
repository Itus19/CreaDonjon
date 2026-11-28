import { describe, expect, it } from "vitest";
import { gesteDeDissimulation, objetNomme } from "./pcConcealment";

const sac = [
  { id: "pj-1", name: "Dague", concealed: false },
  { id: "pj-2", name: "Épée longue", concealed: false },
  { id: "pj-3", name: "Lettre scellée", concealed: true },
];
const cacher = (text: string, total = 14, verdict: "success" | "fail" = "success", actionId = "stealth") =>
  gesteDeDissimulation({ intent: { kind: "skill_check", actionId }, check: { total, verdict }, text, items: sac });

describe("V3.2-80 — le personnage cache un objet", () => {
  it("retrouve l'objet nommé, sans accents ni majuscules, le nom le plus long d'abord", () => {
    expect(objetNomme("je cache ma dague sous ma cape", sac)).toBe("pj-1");
    expect(objetNomme("je glisse l'epee longue sous la paille", sac)).toBe("pj-2");
    expect(objetNomme("je cache mon épée dans le foin", sac)).toBe("pj-2");
    expect(objetNomme("je me cache derrière le comptoir", sac)).toBeNull();
  });

  it("un jet de Discrétion réussi cache la dague : son total devient le DD pour la trouver (règle de l'action Se cacher, 2024)", () => {
    expect(cacher("je cache ma dague sous ma cape", 14)).toEqual({ itemId: "pj-1", concealed: true, concealDc: 14 });
    expect(cacher("je dissimule ma dague", 17, "success", "sleight_of_hand")).toEqual({ itemId: "pj-1", concealed: true, concealDc: 17 });
  });

  it("le DD reste dans les bornes du bloc d'inventaire", () => {
    expect(cacher("je cache ma dague", 34)).toMatchObject({ concealDc: 30 });
    expect(cacher("je cache ma dague", 3)).toMatchObject({ concealDc: 5 });
  });

  it("un jet raté ne cache rien ; se cacher soi-même non plus", () => {
    expect(cacher("je cache ma dague", 6, "fail")).toBeNull();
    expect(cacher("je me cache derrière le comptoir")).toBeNull();
  });

  it("sortir un objet caché le remet en vue, sans jet", () => {
    expect(gesteDeDissimulation({ intent: { kind: "free", actionId: null }, check: null, text: "je sors la lettre scellée", items: sac })).toEqual({ itemId: "pj-3", concealed: false });
    expect(gesteDeDissimulation({ intent: { kind: "free", actionId: null }, check: null, text: "je sors ma dague", items: sac })).toBeNull();
  });
});
