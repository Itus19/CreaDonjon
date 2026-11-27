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
    { id: "pnj-1", qty: 1, equipped: true, concealed: true, label: "Couteau" },
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

  it("un jet raté ne révèle rien", async () => {
    expect(await revealCluesFromCheck(supabase, { ...base, detail: perception(8, "entity:mabelle", "fail") })).toEqual({ facts: [], revealed: 0 });
    expect(ecrites).toHaveLength(0);
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

  it("ce qui est déjà connu ne se redit pas", async () => {
    connues = new Set(["ability:str", "item:pnj-1"]);
    expect(await revealCluesFromCheck(supabase, { ...base, detail: perception(13) })).toEqual({ facts: [], revealed: 0 });
  });

  it("une action libre ou une attaque n'est pas un jet d'observation", async () => {
    expect((await revealCluesFromCheck(supabase, { ...base, detail: { intent: { kind: "free" }, check: null } })).revealed).toBe(0);
  });

  it("réservé au MJ du monde, seul à lire la fiche", async () => {
    admin = false;
    expect((await revealCluesFromCheck(supabase, { ...base, detail: perception(13) })).revealed).toBe(0);
  });
});
