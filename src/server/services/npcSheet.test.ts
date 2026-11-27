import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { emptyScene, enterScene, type SceneState } from "@/src/core/rules/scene";

/**
 * V3.2-47 — le rattrapage des fiches allégées : seul le câblage se vérifie
 * ici (qui reçoit une fiche, avec quelle graine) ; la fiche elle-même est
 * couverte par `src/core/rules/npcSheet.test.ts`.
 */

let scene: SceneState | null;
let isAdmin = true;
let existingSheets: { entity_id: string; block_type: string; data?: unknown }[] = [];
const created: { entityId: string; blockType: string; visibilityLevel: string; data: { based_on?: unknown } }[] = [];

vi.mock("@/src/server/repos/sceneStates", () => ({ getSceneState: async () => scene }));
vi.mock("@/src/server/services/permissions", () => ({ isWorldAdmin: async () => isAdmin }));
vi.mock("@/src/server/repos/blocks", () => ({ listBlocksByTypesForEntities: async () => existingSheets }));
let knownFacets = new Map<string, Set<string>>();
const facetRows: { entityId: string; facet: string; userId: string | null }[] = [];
vi.mock("@/src/server/repos/entityFacetDiscoveries", () => ({
  listFacetDiscoveries: async () => knownFacets,
  insertFacetDiscoveries: async (_s: unknown, rows: typeof facetRows) => {
    facetRows.push(...rows);
  },
}));
vi.mock("@/src/server/services/blocks", () => ({
  createBlockWithData: async (_s: unknown, params: (typeof created)[number]) => {
    created.push(params);
    return { ok: true };
  },
}));
vi.mock("@/src/server/services/rules", () => ({
  getRuleEntryForWorld: async (_s: unknown, _w: string, key: string) =>
    key === "commoner"
      ? {
          blocks: [
            {
              blockType: "stat_block",
              data: {
                size: "Medium",
                creature_type: "Humanoid",
                armor_class: 10,
                hit_points: 4,
                hit_dice: "1d8",
                speed: { walk: "30 ft." },
                abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
              },
            },
          ],
        }
      : null,
}));

const { ensureNpcSheetsForPresents } = await import("./npcSheet");
const supabase = {} as SupabaseClient<Database>;
const params = { campaignId: "c1", worldId: "w1", actorEntityId: "pj", callerId: "u1" };

beforeEach(() => {
  scene = enterScene(enterScene(enterScene(emptyScene("fanal"), { entityId: "pj", zone: "near" }), { entityId: "mabelle", zone: "near" }), { entityId: "ourse", zone: "far" });
  isAdmin = true;
  existingSheets = [];
  created.length = 0;
  knownFacets = new Map();
  facetRows.length = 0;
});

describe("ensureNpcSheetsForPresents", () => {
  it("donne une fiche Roturier, réservée au MJ, à chaque présent qui n'en a pas — jamais au personnage joué", async () => {
    const { given } = await ensureNpcSheetsForPresents(supabase, params);
    expect(given).toEqual(["mabelle", "ourse"]);
    expect(created.map((c) => `${c.entityId}:${c.blockType}`)).toEqual(["mabelle:statblock", "mabelle:inventory", "ourse:statblock", "ourse:inventory"]);
    expect(created.every((c) => c.visibilityLevel === "gm")).toBe(true);
    expect(created[0].data.based_on).toEqual({ source: "srd-2024", key: "commoner" });
  });

  it("ne touche ni à une fiche de personnage, ni à ce qu'un PNJ a déjà ; complète ce qui manque", async () => {
    existingSheets = [
      { entity_id: "mabelle", block_type: "statblock" },
      { entity_id: "ourse", block_type: "character" },
    ];
    expect((await ensureNpcSheetsForPresents(supabase, params)).given).toEqual(["mabelle"]);
    expect(created.map((c) => `${c.entityId}:${c.blockType}`)).toEqual(["mabelle:inventory"]);
  });

  it("sans droit de MJ, ne fait rien", async () => {
    isAdmin = false;
    expect((await ensureNpcSheetsForPresents(supabase, params)).given).toEqual([]);
    expect(created).toEqual([]);
  });

  it("même fiche pour le même PNJ, d'un rattrapage à l'autre", async () => {
    await ensureNpcSheetsForPresents(supabase, params);
    const first = created[0].data;
    created.length = 0;
    await ensureNpcSheetsForPresents(supabase, params);
    expect(created[0].data).toEqual(first);
  });

  it("V3.2-48 — ce que portent sans le cacher les PNJ de la pièce se voit : découvert pour toute la table", async () => {
    await ensureNpcSheetsForPresents(supabase, params);
    // Un Roturier porte toujours ses vêtements, visibles (pnj-0).
    expect(facetRows).toContainEqual(expect.objectContaining({ entityId: "mabelle", facet: "item:pnj-0", userId: null }));
    expect(facetRows.every((r) => r.facet.startsWith("item:"))).toBe(true);
  });

  it("un objet caché ne se voit pas, et ce qui est déjà su ne se réécrit pas", async () => {
    existingSheets = [
      { entity_id: "mabelle", block_type: "statblock" },
      {
        entity_id: "mabelle",
        block_type: "inventory",
        data: {
          __v: 1,
          items: [
            { id: "a", qty: 1, equipped: true, label: "Tablier" },
            { id: "b", qty: 1, equipped: true, concealed: true, ref: { kind: "rule", key: "dagger" } },
          ],
          containers: [],
          currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 5 },
        },
      },
      { entity_id: "ourse", block_type: "character" },
    ];
    knownFacets = new Map([["mabelle", new Set(["item:a"])]]);
    await ensureNpcSheetsForPresents(supabase, params);
    expect(facetRows).toEqual([]);
  });
});
