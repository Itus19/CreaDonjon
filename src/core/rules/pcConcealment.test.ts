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

  it("V3.2-81 — « je cache mon tatouage sous un bandage » : le paragraphe du tatouage est dissimulé, avec le total pour difficulté", () => {
    const signes = [
      { id: "s1", text: "Grand, les cheveux gris.", concealed: false },
      { id: "s2", text: "Un corbeau tatoué dans le cou.", concealed: false },
    ];
    expect(gesteDeDissimulation({ intent: { kind: "skill_check", actionId: "stealth" }, check: { total: 13, verdict: "success" }, text: "je cache mon tatouage sous un bandage", items: sac, signes })).toEqual({ markId: "s2", concealed: true, concealDc: 13 });
    const cache = signes.map((m) => (m.id === "s2" ? { ...m, concealed: true } : m));
    expect(gesteDeDissimulation({ intent: { kind: "free", actionId: null }, check: null, text: "j'enlève le bandage de mon tatouage", items: sac, signes: cache })).toEqual({ markId: "s2", concealed: false });
  });

  describe("V3.2-84 — plus de verbes pour cacher", () => {
    const signes = [
      { id: "s1", text: "Un corbeau tatoué dans le cou.", concealed: false },
      { id: "s2", text: "Une cicatrice barre sa joue gauche.", concealed: false },
    ];
    const geste = (text: string, actionId = "stealth", liste = signes) =>
      gesteDeDissimulation({ intent: { kind: "skill_check", actionId }, check: { total: 15, verdict: "success" }, text, items: sac, signes: liste });

    it("« je mets un bandage sur mon tatouage » dissimule le tatouage", () => {
      expect(geste("je mets un bandage sur mon tatouage")).toEqual({ markId: "s1", concealed: true, concealDc: 15 });
    });

    it("« je glisse la dague dans ma botte » cache la dague", () => {
      expect(geste("je glisse la dague dans ma botte", "sleight_of_hand")).toEqual({ itemId: "pj-1", concealed: true, concealDc: 15 });
    });

    it("« je rabats ma capuche sur ma cicatrice » dissimule la cicatrice", () => {
      expect(geste("je rabats ma capuche sur ma cicatrice")).toEqual({ markId: "s2", concealed: true, concealDc: 15 });
    });

    it("« je glisse une dague au marchand » ne cache rien : donner n'est pas cacher", () => {
      expect(geste("je glisse une dague au marchand", "sleight_of_hand")).toBeNull();
    });

    it("se faufiler avec un objet ne le cache pas", () => {
      expect(geste("je me faufile derrière le garde, la dague à la main")).toBeNull();
    });

    it("« j'ôte ma capuche » ou « je relève ma manche » remettent le signe en vue", () => {
      const caches = signes.map((m) => ({ ...m, concealed: true }));
      const libre = (text: string) => gesteDeDissimulation({ intent: { kind: "free", actionId: null }, check: null, text, items: sac, signes: caches });
      expect(libre("j'ôte ma capuche et montre ma cicatrice")).toEqual({ markId: "s2", concealed: false });
      expect(libre("je relève ma manche sur mon tatouage")).toEqual({ markId: "s1", concealed: false });
      expect(libre("je défais le bandage du tatouage")).toEqual({ markId: "s1", concealed: false });
    });
  });
});
