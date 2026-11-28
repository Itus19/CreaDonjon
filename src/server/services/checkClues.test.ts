import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * V3.2-50 — La base est simulée ; on vérifie le câblage : quel PNJ, quelles
 * facettes écrites (pour qui, liées à quel tour), quelle phrase pour la
 * narration. Le choix des facettes lui-même est testé dans `facetReveal.test.ts`.
 */

let admin = true;
let presents: { entityId: string }[] = [];
let connues = new Set<string>();
const ecrites: { entityId: string; facets: string[]; userId: string | null | undefined; sourceEventId: string | null | undefined }[] = [];

const statblock = {
  __v: 1,
  size: "medium",
  creature_type: "humanoïde",
  alignment: "neutre",
  ac: { value: 11 },
  hp: { value: 9, hit_dice: "2d8" },
  speed: "9 m",
  abilities: { str: 14, dex: 12, con: 11, int: 10, wis: 13, cha: 10 },
  traits: [],
  actions: [{ name: "Gourdin", text: "Corps à corps : +4." }],
  reactions: [],
  legendary_actions: [],
};
const inventaire = {
  __v: 1,
  items: [
    { id: "pnj-0", qty: 1, equipped: true, label: "Tablier" },
    { id: "pnj-1", qty: 1, equipped: true, concealed: true, conceal_dc: 13, label: "Couteau" },
  ],
  containers: [],
  currency: { pp: 0, gp: 0, ep: 0, sp: 3, cp: 4 },
};

vi.mock("@/src/server/services/permissions", () => ({ isWorldAdmin: async () => admin }));
vi.mock("@/src/server/repos/sceneStates", () => ({ getSceneState: async () => ({ present: presents }) }));
vi.mock("@/src/core/rules/scenePresence", () => ({ presentsIci: (scene: { present: unknown[] }) => scene.present }));
vi.mock("@/src/server/repos/blocks", () => ({
  listBlocksByTypesForEntities: async () => [
    { entity_id: "mabelle", block_type: "statblock", data: statblock },
    { entity_id: "mabelle", block_type: "inventory", data: inventaire },
    { entity_id: "mabelle", block_type: "text", data: { __v: 1, segments: [{ id: "s2", blockType: "paragraph", visibility: { level: "gm", scopeId: null }, content: [{ t: "text", v: "Un serpent tatoué sur l'avant-bras." }], align: "left", concealed: { dc: 15 } }] } },
  ],
}));
vi.mock("@/src/server/repos/entityFacetDiscoveries", () => ({ listFacetDiscoveries: async () => new Map([["mabelle", connues]]) }));
vi.mock("@/src/server/repos/entities", () => ({ listEntitiesByIds: async () => [{ id: "mabelle", name: "Mabelle" }] }));
vi.mock("@/src/server/services/facetDiscoveries", () => ({
  revealFacets: async (_s: unknown, p: { entityId: string; facets: string[]; userId?: string | null; sourceEventId?: string | null }) => {
    ecrites.push({ entityId: p.entityId, facets: p.facets, userId: p.userId, sourceEventId: p.sourceEventId });
    return { revealed: p.facets.filter((f) => !connues.has(f)) };
  },
  nameInventoryItems: async (_s: unknown, p: { items: { id: string; label?: string; qty: number }[] }) => p.items.map((i) => ({ id: i.id, name: i.label ?? "objet", qty: i.qty })),
}));

const { revealCluesFromCheck } = await import("./checkClues");
const supabase = {} as SupabaseClient<Database>;
const base = { campaignId: "c", world: { id: "w", slug: "monde" }, locale: "fr" as const, actorEntityId: "pj", callerId: "u", eventId: "ev-7" };
const perception = (total: number, target: string | null = "entity:mabelle", verdict: "success" | "fail" = "success") => ({
  intent: { kind: "skill_check", action_id: "perception", target_id: target },
  check: { total, dc: 12, verdict },
});

beforeEach(() => {
  admin = true;
  presents = [];
  connues = new Set();
  ecrites.length = 0;
});

describe("revealCluesFromCheck — V3.2-50", () => {
  it("Perception réussie sur Mabelle : son couteau et sa Force, écrits pour qui a lancé, liés au tour", async () => {
    const out = await revealCluesFromCheck(supabase, { ...base, detail: perception(13) });
    expect(ecrites).toEqual([{ entityId: "mabelle", facets: ["ability:str", "item:pnj-1"], userId: "u", sourceEventId: "ev-7" }]);
    expect(out).toEqual({ facts: ["Indices découverts sur Mabelle : Force 14 (+2), Couteau (caché)."], revealed: 2 });
  });

  it("un jet raté ne révèle rien, et se dit comme une fouille vide", async () => {
    const rate = await revealCluesFromCheck(supabase, { ...base, detail: perception(8, "entity:mabelle", "fail") });
    expect(ecrites).toHaveLength(0);
    connues = new Set(["ability:str", "item:pnj-1"]);
    const vide = await revealCluesFromCheck(supabase, { ...base, detail: perception(13) });
    expect(rate).toEqual(vide);
    expect(rate.facts[0]).toContain("Rien trouvé sur Mabelle");
  });

  it("sans cible, le seul PNJ de la pièce est visé ; à plusieurs, personne", async () => {
    presents = [{ entityId: "pj" }, { entityId: "mabelle" }];
    expect((await revealCluesFromCheck(supabase, { ...base, detail: perception(13, null) })).revealed).toBe(2);
    ecrites.length = 0;
    presents = [{ entityId: "mabelle" }, { entityId: "ourse" }];
    expect((await revealCluesFromCheck(supabase, { ...base, detail: perception(13, null) })).revealed).toBe(0);
  });

  it("Investigation : la bourse en pièces courantes", async () => {
    const out = await revealCluesFromCheck(supabase, { ...base, detail: { ...perception(13), intent: { kind: "skill_check", action_id: "investigation", target_id: "entity:mabelle" } } });
    expect(out.facts[0]).toContain("bourse : ");
  });

  it("un couteau mieux caché que le jet ne se trouve pas, même jet réussi", async () => {
    const out = await revealCluesFromCheck(supabase, { ...base, detail: { intent: { kind: "skill_check", action_id: "investigation", target_id: "entity:mabelle" }, check: { total: 12, dc: 10, verdict: "success" } } });
    expect(ecrites[0]!.facets).toEqual(["purse"]);
    expect(out.facts[0]).not.toContain("Couteau");
  });

  it("une action libre ou une attaque n'est pas un jet d'observation", async () => {
    expect((await revealCluesFromCheck(supabase, { ...base, detail: { intent: { kind: "free" }, check: null } })).revealed).toBe(0);
  });

  it("réservé au MJ du monde, seul à lire la fiche", async () => {
    admin = false;
    expect((await revealCluesFromCheck(supabase, { ...base, detail: perception(13) })).revealed).toBe(0);
  });

  it("V3.2-81 — une fouille qui atteint la difficulté d'un signe dissimulé le révèle, avec son texte", async () => {
    const fouille = (total: number) => ({ intent: { kind: "skill_check", action_id: "investigation", target_id: "entity:mabelle" }, check: { total, dc: 10, verdict: "success" as const } });
    await revealCluesFromCheck(supabase, { ...base, detail: fouille(14) });
    expect(ecrites[0]!.facets).not.toContain("mark:s2");
    ecrites.length = 0;
    const out = await revealCluesFromCheck(supabase, { ...base, detail: fouille(15) });
    expect(ecrites[0]!.facets).toContain("mark:s2");
    expect(out.facts[0]).toContain("signe distinctif : Un serpent tatoué sur l'avant-bras.");
  });
});
