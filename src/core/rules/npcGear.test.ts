import { describe, expect, it } from "vitest";
import { ARCHETYPES_DE_DEPART } from "../worldgen/archetypes";
import { zInventoryBlockData } from "../schemas/blocks/inventory";
import { NPC_GEAR_BY_ARCHETYPE, npcGear, purseInCp } from "./npcGear";

const totalCp = (c: { pp: number; gp: number; ep: number; sp: number; cp: number }) => c.pp * 1000 + c.gp * 100 + c.ep * 50 + c.sp * 10 + c.cp;

describe("npcGear — l'équipement probable d'un PNJ, à graine fixe", () => {
  it("chaque archétype de départ a son équipement", () => {
    for (const a of ARCHETYPES_DE_DEPART) expect(NPC_GEAR_BY_ARCHETYPE[a.key], a.key).toBeDefined();
  });

  it("même PNJ, même graine, même richesse : même inventaire, et un bloc valide", () => {
    const a = npcGear({ archetype: "garde", seed: 11, wealth: "correcte" });
    expect(npcGear({ archetype: "garde", seed: 11, wealth: "correcte" })).toEqual(a);
    expect(zInventoryBlockData.parse(a)).toEqual(a);
  });

  it("un garde porte d'emblée sa lance et sa cotte, visibles ; sa bourse se compte à part", () => {
    for (let seed = 0; seed < 30; seed++) {
      const inv = npcGear({ archetype: "garde", seed, wealth: "correcte" });
      const lance = inv.items.find((i) => "ref" in i && i.ref.kind === "rule" && i.ref.key === "spear");
      expect(lance?.equipped).toBe(true);
      expect(lance?.concealed).toBeUndefined();
    }
  });

  it("une aubergiste garde parfois un couteau caché sous le tablier, jamais visible", () => {
    let vu = false;
    for (let seed = 0; seed < 60; seed++) {
      const inv = npcGear({ archetype: "personnel_de_lieu", seed, wealth: "modeste" });
      const couteau = inv.items.find((i) => "ref" in i && i.ref.kind === "rule" && i.ref.key === "dagger");
      if (couteau) {
        vu = true;
        expect(couteau.concealed).toBe(true);
        // L'effort pour le cacher : un DD secret, tiré une fois.
        expect(couteau.conceal_dc).toBeGreaterThanOrEqual(12);
        expect(couteau.conceal_dc).toBeLessThanOrEqual(17);
      }
    }
    expect(vu).toBe(true);
  });

  it("sans archétype connu : les affaires d'un roturier", () => {
    expect(npcGear({ seed: 3, wealth: "correcte" }).items.length).toBeGreaterThan(0);
  });
});

describe("purseInCp — la bourse selon le milieu et la richesse de la ville", () => {
  it("un noble d'une ville réputée a toujours plus qu'un journalier d'un bourg modeste", () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(purseInCp({ archetype: "noble", seed, wealth: "reputee" })).toBeGreaterThan(purseInCp({ archetype: "journalier", seed, wealth: "modeste" }));
    }
  });

  it("la bourse rendue dans l'inventaire vaut ce que dit purseInCp, en pièces courantes", () => {
    const params = { archetype: "marchand_etabli", seed: 9, wealth: "correcte" as const };
    expect(totalCp(npcGear(params).currency)).toBe(purseInCp(params));
  });

  it("un enfant n'a presque rien", () => {
    for (let seed = 0; seed < 30; seed++) expect(purseInCp({ archetype: "enfant", seed, wealth: "reputee" })).toBeLessThan(50);
  });
});
