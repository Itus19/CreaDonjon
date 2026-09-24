import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { BlockRow } from "@/src/server/repos/blocks";

/**
 * V3-C1 — Le pont, avec le VRAI moteur de generateurs et de tables : seuls
 * les acces a la base sont remplaces par un petit monde en memoire (une
 * taverne dans une capitale, un generateur de nom, deux tables). Ce qu'on
 * verifie est ce que le ticket demande — les axes viennent du lieu, le
 * tirage est rejouable depuis sa graine, et le journal porte la table, le
 * de et le resultat — pas le moteur de tables, deja couvert ailleurs.
 */

function block(id: string, entityId: string, blockType: string, data: unknown, order = 0): BlockRow {
  return {
    id,
    entity_id: entityId,
    block_type: blockType,
    display: {},
    data: data as BlockRow["data"],
    display_order: order,
    version: 1,
    visibility_level: "gm",
    visibility_scope_id: null,
    created_by: null,
    created_at: "",
    updated_at: "",
  };
}

const table = (key: string, names: string[]) => ({
  __v: 1,
  key,
  die: `d${names.length}`,
  entries: names.map((text, i) => ({ range: { min: i + 1, max: i + 1 }, weight: 1, text })),
  unique_draws: false,
});

const REPUTEE_NAMES = ["Le Lion d'Or", "L'Étoile d'Argent", "La Couronne", "Le Grand Cerf"];

const BLOCKS: BlockRow[] = [
  block("info-taverne", "taverne", "infobox", { __v: 1, entries: [{ label: "Richesse", value: "Réputée" }] }),
  block("info-ville", "ville", "infobox", { __v: 1, entries: [{ label: "Zone", value: "Capitale" }] }),
  block("gen-nom", "gen", "generator", { __v: 1, key: "taverne-nom", slots: [{ key: "nom", table: "noms-{wealth}" }], template: "{nom}, taverne {wealth}" }),
  block("t-modeste", "gen", "random_table", table("noms-modeste", ["Le Rat Mouillé", "La Chope Fêlée", "Le Seau Percé", "La Paille"])),
  block("t-reputee", "gen", "random_table", table("noms-reputee", REPUTEE_NAMES)),
];

let scene: { locationId: string } | null;
let nextSeed = 0;
const inserted: { kind: string; actor: string; payload: unknown }[] = [];

vi.mock("@/src/server/repos/sceneStates", () => ({ getSceneState: async () => scene }));
vi.mock("@/src/server/repos/entities", () => ({ findEntityByKind: async () => ({ id: "gen" }) }));
vi.mock("@/src/server/repos/relations", () => ({
  listPartOfRelationsForWorld: async () => [{ source_entity_id: "taverne", target_entity_id: "ville" }],
}));
vi.mock("@/src/server/repos/blocks", () => ({
  listBlocksForEntity: async (_s: unknown, entityId: string) => BLOCKS.filter((b) => b.entity_id === entityId),
  listBlocksByTypeForEntities: async (_s: unknown, ids: string[], type: string) =>
    BLOCKS.filter((b) => ids.includes(b.entity_id) && b.block_type === type),
  getBlockById: async (_s: unknown, id: string) => BLOCKS.find((b) => b.id === id) ?? null,
}));
vi.mock("@/src/server/repos/sessions", () => ({
  nextEventSeq: async () => inserted.length + 1,
  insertSessionEvent: async (_s: unknown, params: { kind: string; actor: string; payload: unknown }) => {
    inserted.push({ kind: params.kind, actor: params.actor, payload: params.payload });
    return { id: `ev-${inserted.length}` };
  },
}));
vi.mock("@/src/server/services/sessions", () => ({ getOrOpenSessionForCampaign: async () => "session" }));
vi.mock("@/src/server/services/rng", () => ({ serverRng: { nextInt: () => nextSeed } }));

const { generateForScene } = await import("./sceneGeneration");
const supabase = {} as SupabaseClient<Database>;
const params = { campaignId: "c", worldId: "w", toolKey: "taverne", callerId: "u" };

beforeEach(() => {
  scene = { locationId: "taverne" };
  nextSeed = 12345;
  inserted.length = 0;
});

describe("generateForScene", () => {
  it("tire avec la richesse de la taverne et la zone de sa ville", async () => {
    const result = await generateForScene(supabase, params);
    if ("error" in result) throw new Error(result.error);

    expect(result.variant.wealth).toEqual({ key: "reputee", label: "Réputée", source: "location" });
    expect(result.variant.zone).toEqual({ key: "capitale", label: "Capitale", source: "parent" });
    const [section] = result.sections;
    expect(section.slots[0].table).toBe("noms-reputee");
    expect(REPUTEE_NAMES).toContain(section.slots[0].text);
    expect(section.text).toBe(`${section.slots[0].text}, taverne Réputée`);
  });

  it("ignore un choix de richesse venu de l'appelant", async () => {
    const result = await generateForScene(supabase, { ...params, choices: { wealth: "modeste" } });
    if ("error" in result) throw new Error(result.error);
    expect(result.sections[0].slots[0].table).toBe("noms-reputee");
  });

  it("journalise un world_update avec la graine, la table, le de et le resultat", async () => {
    const result = await generateForScene(supabase, params);
    if ("error" in result) throw new Error(result.error);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].kind).toBe("world_update");
    expect(inserted[0].actor).toBe("system");
    const payload = inserted[0].payload as { seed: number; source: string; sections: { slots: { table: string; die: string; rolled: number; text: string }[] }[] };
    expect(payload.source).toBe("generator");
    expect(payload.seed).toBe(12345);
    const slot = payload.sections[0].slots[0];
    expect(slot.table).toBe("noms-reputee");
    expect(slot.die).toBe("d4");
    expect(slot.rolled).toBeGreaterThanOrEqual(1);
    expect(slot.rolled).toBeLessThanOrEqual(4);
    expect(slot.text).toBe(result.sections[0].slots[0].text);
  });

  it("est rejouable : meme graine, memes tirages", async () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const seed of seeds) {
      nextSeed = seed;
      const a = await generateForScene(supabase, params);
      const b = await generateForScene(supabase, params);
      if ("error" in a || "error" in b) throw new Error("tirage echoue");
      expect(b.sections).toEqual(a.sections);
      expect(b.variant).toEqual(a.variant);
    }
  });

  it("tire les axes absents du lieu, et le dit", async () => {
    scene = { locationId: "nulle-part" };
    const result = await generateForScene(supabase, params);
    if ("error" in result) throw new Error(result.error);
    expect(result.variant.wealth.source).toBe("random");
    expect(result.variant.zone.source).toBe("random");
  });

  it("refuse sans scene, et un outil inconnu, sans rien journaliser", async () => {
    expect(await generateForScene(supabase, { ...params, toolKey: "donjon" })).toEqual({ error: "unknown_tool" });
    scene = null;
    expect(await generateForScene(supabase, params)).toEqual({ error: "no_scene" });
    expect(inserted).toHaveLength(0);
  });
});
