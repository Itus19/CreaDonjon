import { describe, expect, it } from "vitest";
import { NPC_CHECK_ACTIONS, modificateurJetPnj, resoudreJetPnj } from "./npcRolls";

/** Une roturière costaude : Force 14, rien d'autre. Un garde qui a l'œil : Perception +4, sauvegarde de Constitution +3. */
const mabelle = { abilities: { str: 14, dex: 10, con: 12, int: 10, wis: 11, cha: 10 } };
const garde = { ...mabelle, skills: { "Skill: Perception": 4 }, saving_throws: { con: 3 } };
const des = (...faces: number[]) => ({ nextInt: () => (faces.shift() ?? 1) - 1 });

describe("V3.2-52 — les jets de caractéristique et de compétence des PNJ", () => {
  it("soulever un tonneau : un jet d'Athlétisme, avec la Force de la fiche", () => {
    expect(NPC_CHECK_ACTIONS.soulever).toMatchObject({ kind: "skill", key: "athletics" });
    expect(modificateurJetPnj(mabelle, NPC_CHECK_ACTIONS.soulever)).toBe(2);
  });

  it("une compétence que la fiche maîtrise prend son bonus du SRD, déjà total", () => {
    expect(modificateurJetPnj(garde, NPC_CHECK_ACTIONS.reperer)).toBe(4);
    expect(modificateurJetPnj({ ...mabelle, skills: { Perception: 5 } }, NPC_CHECK_ACTIONS.reperer)).toBe(5);
    expect(modificateurJetPnj({ ...mabelle, skills: { Discrétion: 6 } }, NPC_CHECK_ACTIONS.se_cacher)).toBe(6);
  });

  it("une sauvegarde : son bonus s'il est sur la fiche, sinon la caractéristique", () => {
    expect(modificateurJetPnj(garde, NPC_CHECK_ACTIONS.resister_poison)).toBe(3);
    expect(modificateurJetPnj(mabelle, NPC_CHECK_ACTIONS.resister_poison)).toBe(1);
    expect(modificateurJetPnj(mabelle, NPC_CHECK_ACTIONS.resister_esprit)).toBe(0);
  });

  it("le dé du serveur, le modificateur, le DD : réussite si le total l'atteint", () => {
    expect(resoudreJetPnj(2, 15, des(13))).toEqual({ naturel: 13, total: 15, reussi: true });
    expect(resoudreJetPnj(2, 15, des(12))).toEqual({ naturel: 12, total: 14, reussi: false });
  });

  it("règles 2024 : un 20 naturel ne réussit pas d'office un test, un 1 n'échoue pas d'office", () => {
    expect(resoudreJetPnj(0, 25, des(20)).reussi).toBe(false);
    expect(resoudreJetPnj(9, 10, des(1)).reussi).toBe(true);
  });

  it("chaque action de la liste fermée vise une compétence ou une sauvegarde connue", () => {
    for (const action of Object.values(NPC_CHECK_ACTIONS)) {
      expect(["skill", "save"]).toContain(action.kind);
      expect(action.label.length).toBeGreaterThan(0);
    }
  });
});
