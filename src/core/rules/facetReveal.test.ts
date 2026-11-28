import { describe, expect, it } from "vitest";
import { facetsRevealedByCheck } from "./facetReveal";

/** Mabelle : une dague cachée sous le tablier, un tablier porté, une bourse, deux actions. */
const gear = {
  items: [
    { id: "pnj-0", equipped: true },
    { id: "pnj-1", equipped: true, concealed: true, conceal_dc: 13 },
  ],
};
const sheet = { actions: 2, traits: 1 };
const mabelle = { sheet, gear };
const rien = new Set<string>();

describe("facetsRevealedByCheck — V3.2-50 (ADR 0118 §5)", () => {
  it("Perception réussie de peu : son couteau et sa Force, rien d'autre", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, total: 13, dc: 12, npc: mabelle, known: rien })).toEqual(["ability:str", "item:pnj-1"]);
  });

  it("Perception réussie largement : aussi l'armure et la tenue au combat", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, total: 17, dc: 12, npc: mabelle, known: rien })).toEqual(["ability:str", "item:pnj-1", "ac", "ability:dex"]);
  });

  it("Perception réussie de dix : ses façons de se battre", () => {
    const facets = facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, total: 22, dc: 12, npc: mabelle, known: rien });
    expect(facets).toContain("action:0");
    expect(facets).toContain("action:1");
  });

  it("Perspicacité : sa Sagesse et son Charisme, puis son Intelligence", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "insight" }, total: 12, dc: 12, npc: mabelle, known: rien })).toEqual(["ability:wis", "ability:cha"]);
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "insight" }, total: 17, dc: 12, npc: mabelle, known: rien })).toEqual(["ability:wis", "ability:cha", "ability:int"]);
  });

  it("Investigation : sa bourse et ce qu'il cache", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "investigation" }, total: 13, dc: 12, npc: mabelle, known: rien })).toEqual(["purse", "item:pnj-1"]);
  });

  it("Médecine : sa santé et sa Constitution", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "medicine" }, total: 12, dc: 12, npc: mabelle, known: rien })).toEqual(["hp", "ability:con"]);
  });

  it("un jet de caractéristique révèle la caractéristique jaugée", () => {
    expect(facetsRevealedByCheck({ check: { kind: "ability", key: "wis" }, total: 12, dc: 12, npc: mabelle, known: rien })).toEqual(["ability:wis", "ability:cha"]);
  });

  it("ce qui est déjà connu n'est pas révélé deux fois", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, total: 13, dc: 12, npc: mabelle, known: new Set(["ability:str"]) })).toEqual(["item:pnj-1"]);
  });

  it("une compétence sans lien avec l'observation ne révèle rien", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "persuasion" }, total: 20, dc: 12, npc: mabelle, known: rien })).toEqual([]);
  });

  it("sans fiche, aucune caractéristique ; sans inventaire, aucun objet ni bourse", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, total: 17, dc: 12, npc: { sheet: null, gear }, known: rien })).toEqual(["item:pnj-1"]);
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "investigation" }, total: 12, dc: 12, npc: { sheet, gear: null }, known: rien })).toEqual([]);
  });

  it("un objet bien caché résiste à un jet qui réussit pourtant le DD affiché", () => {
    const cache = { sheet, gear: { items: [{ id: "lettre", concealed: true, conceal_dc: 18 }] } };
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "investigation" }, total: 14, dc: 12, npc: cache, known: rien })).toEqual(["purse"]);
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "investigation" }, total: 18, dc: 12, npc: cache, known: rien })).toEqual(["purse", "item:lettre", "ability:int"]);
  });

  it("sans effort fixé, un objet caché demande 15", () => {
    const cache = { sheet, gear: { items: [{ id: "x", concealed: true }] } };
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, total: 14, dc: 10, npc: cache, known: rien })).toEqual(["ability:str"]);
  });

  it("un objet visible (déjà vu d'un coup d'œil) n'est pas un indice", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "investigation" }, total: 12, dc: 12, npc: mabelle, known: rien })).not.toContain("item:pnj-0");
  });

  it("V3.2-81 — un signe distinctif dissimulé se trouve comme un objet caché : seulement si le total atteint sa difficulté", () => {
    const tatouee = { ...mabelle, marks: [{ id: "s2", dc: 15 }] };
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "investigation" }, total: 14, dc: 10, npc: tatouee, known: rien })).not.toContain("mark:s2");
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "investigation" }, total: 15, dc: 10, npc: tatouee, known: rien })).toContain("mark:s2");
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, total: 15, dc: 10, npc: tatouee, known: rien })).toContain("mark:s2");
  });
});
