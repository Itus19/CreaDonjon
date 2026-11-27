import { describe, expect, it } from "vitest";
import { facetsRevealedByCheck } from "./facetReveal";

/** Mabelle : une dague cachée sous le tablier, un tablier porté, une bourse, deux actions. */
const gear = {
  items: [
    { id: "pnj-0", equipped: true },
    { id: "pnj-1", equipped: true, concealed: true },
  ],
};
const sheet = { actions: 2, traits: 1 };
const mabelle = { sheet, gear };
const rien = new Set<string>();

describe("facetsRevealedByCheck — V3.2-50 (ADR 0118 §5)", () => {
  it("Perception réussie de peu : son couteau et sa Force, rien d'autre", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, margin: 1, npc: mabelle, known: rien })).toEqual(["ability:str", "item:pnj-1"]);
  });

  it("Perception réussie largement : aussi l'armure et la tenue au combat", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, margin: 5, npc: mabelle, known: rien })).toEqual(["ability:str", "item:pnj-1", "ac", "ability:dex"]);
  });

  it("Perception réussie de dix : ses façons de se battre", () => {
    const facets = facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, margin: 10, npc: mabelle, known: rien });
    expect(facets).toContain("action:0");
    expect(facets).toContain("action:1");
  });

  it("Perspicacité : sa Sagesse et son Charisme, puis son Intelligence", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "insight" }, margin: 0, npc: mabelle, known: rien })).toEqual(["ability:wis", "ability:cha"]);
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "insight" }, margin: 5, npc: mabelle, known: rien })).toEqual(["ability:wis", "ability:cha", "ability:int"]);
  });

  it("Investigation : sa bourse et ce qu'il cache", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "investigation" }, margin: 0, npc: mabelle, known: rien })).toEqual(["purse", "item:pnj-1"]);
  });

  it("Médecine : sa santé et sa Constitution", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "medicine" }, margin: 0, npc: mabelle, known: rien })).toEqual(["hp", "ability:con"]);
  });

  it("un jet de caractéristique révèle la caractéristique jaugée", () => {
    expect(facetsRevealedByCheck({ check: { kind: "ability", key: "wis" }, margin: 0, npc: mabelle, known: rien })).toEqual(["ability:wis", "ability:cha"]);
  });

  it("ce qui est déjà connu n'est pas révélé deux fois", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, margin: 1, npc: mabelle, known: new Set(["ability:str"]) })).toEqual(["item:pnj-1"]);
  });

  it("une compétence sans lien avec l'observation ne révèle rien", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "persuasion" }, margin: 8, npc: mabelle, known: rien })).toEqual([]);
  });

  it("sans fiche, aucune caractéristique ; sans inventaire, aucun objet ni bourse", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "perception" }, margin: 5, npc: { sheet: null, gear }, known: rien })).toEqual(["item:pnj-1"]);
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "investigation" }, margin: 0, npc: { sheet, gear: null }, known: rien })).toEqual([]);
  });

  it("un objet visible (déjà vu d'un coup d'œil) n'est pas un indice", () => {
    expect(facetsRevealedByCheck({ check: { kind: "skill", key: "investigation" }, margin: 0, npc: mabelle, known: rien })).not.toContain("item:pnj-0");
  });
});
