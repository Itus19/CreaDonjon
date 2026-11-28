import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { KnowledgeFact } from "@/src/core/rules/npcKnowledge";

/**
 * V3.2-80 — La base est simulée : on vérifie qui apprend quoi, ce qui est
 * écrit, et la ligne que reçoit la narration. Le choix des facettes est
 * testé dans `facetReveal.test.ts`, le partage dans `npcKnowledge.test.ts`.
 */

let admin = true;
let presents: { entityId: string }[] = [];
let savoir: (KnowledgeFact & { subject?: string })[] = [];
const ecrits: KnowledgeFact[] = [];

const statblock = { entity_id: "", block_type: "statblock", data: {} };
const sacDuPj = {
  __v: 1,
  items: [
    { id: "pj-1", qty: 1, equipped: true, label: "Épée longue" },
    { id: "pj-2", qty: 1, equipped: true, concealed: true, conceal_dc: 14, label: "Lettre scellée" },
  ],
  containers: [],
  currency: { pp: 0, gp: 2, ep: 0, sp: 0, cp: 0 },
};

vi.mock("@/src/server/services/permissions", () => ({ isWorldAdmin: async () => admin }));
vi.mock("@/src/server/repos/sceneStates", () => ({ getSceneState: async () => ({ present: presents }) }));
vi.mock("@/src/core/rules/scenePresence", () => ({ presentsIci: (scene: { present: unknown[] }) => scene.present }));
vi.mock("@/src/server/repos/blocks", () => ({
  listBlocksByTypesForEntities: async (_s: unknown, ids: string[]) => [
    ...ids.filter((id) => id === "mabelle" || id === "bram").map((id) => ({ ...statblock, entity_id: id })),
    ...(ids.includes("pj")
      ? [
          { entity_id: "pj", block_type: "inventory", data: sacDuPj },
          { entity_id: "pj", block_type: "text", data: { __v: 1, segments: [{ id: "t1", blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v: "Un corbeau tatoué dans le cou." }], align: "left", concealed: { dc: 13 } }] } },
        ]
      : []),
  ],
}));
vi.mock("@/src/server/repos/npcKnowledge", () => ({
  listNpcKnowledge: async (_s: unknown, p: { knowerIds: string[] }) => savoir.filter((k) => p.knowerIds.includes(k.knowerId)),
  insertNpcKnowledge: async (_s: unknown, p: { facts: KnowledgeFact[] }) => {
    ecrits.push(...p.facts);
  },
}));
vi.mock("@/src/server/services/facetDiscoveries", () => ({
  nameInventoryItems: async (_s: unknown, p: { items: { id: string; label?: string; qty: number }[] }) => p.items.map((i) => ({ id: i.id, name: i.label ?? "objet", qty: i.qty })),
}));
vi.mock("@/src/server/services/characterActions", () => ({
  itemLabel: (i: { label?: string }) => i.label ?? "objet",
  resolveCharacterActionContext: async () => ({
    sheet: { abilities: { str: { score: 16, mod: 3 }, dex: { score: 12, mod: 1 }, con: { score: 14, mod: 2 }, int: { score: 10, mod: 0 }, wis: { score: 10, mod: 0 }, cha: { score: 8, mod: -1 } }, ac: { value: 16 }, hitPoints: { max: 12 } },
    ruleNameByKey: {},
  }),
}));

const { observePcAtSight, learnFromNpcCheckOnPc, shareNpcKnowledge, spreadRumour, knowledgeSecrets } = await import("./npcKnowledge");
const supabase = {} as SupabaseClient<Database>;
const base = { campaignId: "c", pcEntityId: "pj", callerId: "u", sourceEventId: "ev" };

beforeEach(() => {
  admin = true;
  presents = [{ entityId: "pj" }, { entityId: "mabelle" }, { entityId: "esquisse" }];
  savoir = [];
  ecrits.length = 0;
});

describe("ce que les PNJ savent du personnage — V3.2-80", () => {
  it("au premier regard, Mabelle voit l'épée portée, pas la lettre cachée ; une esquisse sans fiche ne retient rien", async () => {
    expect(await observePcAtSight(supabase, { ...base, world: { id: "w", slug: "m" }, locale: "fr", sessionEventId: "ev" })).toBe(1);
    expect(ecrits).toEqual([{ knowerId: "mabelle", facet: "item:pj-1", claim: "porte Épée longue", isTrue: true, source: "observation", toldById: null }]);
  });

  it("ce qu'elle a déjà vu ne s'écrit pas deux fois", async () => {
    savoir = [{ knowerId: "mabelle", facet: "item:pj-1", claim: "porte Épée longue", isTrue: true, source: "observation", toldById: null }];
    expect(await observePcAtSight(supabase, { ...base, world: { id: "w", slug: "m" }, locale: "fr", sessionEventId: "ev" })).toBe(0);
  });

  it("une Perception réussie de peu sur le personnage : sa Force, mais pas la lettre (DD 14) avec un total de 13", async () => {
    expect(await learnFromNpcCheckOnPc(supabase, { ...base, npcId: "mabelle", skill: "perception", total: 13, dc: 12 })).not.toContain("Lettre scellée (caché)");
    expect(await learnFromNpcCheckOnPc(supabase, { ...base, npcId: "bram", skill: "perception", total: 14, dc: 12 })).toEqual(["Force 16 (+3)", "Lettre scellée (caché)", "signe distinctif : Un corbeau tatoué dans le cou."]);
  });

  it("critère : Mabelle sait qu'il porte une épée, Bram non, tant qu'elle ne le lui a pas dit", async () => {
    savoir = [{ knowerId: "mabelle", facet: "item:pj-1", claim: "porte Épée longue", isTrue: true, source: "observation", toldById: null }];
    const npcs = [{ id: "mabelle", name: "Mabelle" }, { id: "bram", name: "Bram" }];
    expect(await knowledgeSecrets(supabase, { campaignId: "c", pcEntityId: "pj", pcName: "Aldric", npcs })).toEqual([{ name: "Mabelle", text: "ce qu'il ou elle sait de Aldric — sait : porte Épée longue." }]);
    expect(await shareNpcKnowledge(supabase, { ...base, worldId: "w", fromId: "mabelle", toId: "bram" })).toBe(1);
    expect(ecrits[0]).toMatchObject({ knowerId: "bram", facet: "item:pj-1", source: "told", toldById: "mabelle" });
  });

  it("critère : une rumeur fausse se distingue d'un fait vrai, côté MJ", async () => {
    expect(await spreadRumour(supabase, { ...base, worldId: "w", npcId: "bram", claim: "  il est recherché à Port-Brume " })).toBe(true);
    expect(ecrits[0]).toEqual({ knowerId: "bram", facet: null, claim: "il est recherché à Port-Brume", isTrue: false, source: "rumour", toldById: null });
    savoir = [...ecrits];
    const lignes = await knowledgeSecrets(supabase, { campaignId: "c", pcEntityId: "pj", pcName: "Aldric", npcs: [{ id: "bram", name: "Bram" }] });
    expect(lignes[0]!.text).toContain("croit à tort : « il est recherché à Port-Brume »");
    expect(await spreadRumour(supabase, { ...base, worldId: "w", npcId: "bram", claim: "il est recherché à Port-Brume" })).toBe(false);
  });

  it("réservé au MJ du monde ; un PNJ ne se parle pas à lui-même", async () => {
    admin = false;
    expect(await observePcAtSight(supabase, { ...base, world: { id: "w", slug: "m" }, locale: "fr", sessionEventId: "ev" })).toBe(0);
    expect(await spreadRumour(supabase, { ...base, worldId: "w", npcId: "bram", claim: "x" })).toBe(false);
    admin = true;
    expect(await shareNpcKnowledge(supabase, { ...base, worldId: "w", fromId: "bram", toId: "bram" })).toBe(0);
  });

  it("V3.2-81 — critère : le tatouage sous le bandage (DD 13) échappe à une Perception de 12, pas à une de 13", async () => {
    expect(await learnFromNpcCheckOnPc(supabase, { ...base, npcId: "mabelle", skill: "perception", total: 12, dc: 10 })).not.toContain("signe distinctif : Un corbeau tatoué dans le cou.");
    expect(await learnFromNpcCheckOnPc(supabase, { ...base, npcId: "bram", skill: "perception", total: 13, dc: 10 })).toContain("signe distinctif : Un corbeau tatoué dans le cou.");
  });
});
