import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/** V3.2-83 — La base est simulée : « Annuler ce tour » retire aussi les indices et le savoir des PNJ nés du tour, et remet un signe caché. */

const suppressions: { table: string; eventIds: readonly string[] }[] = [];
const remis: unknown[][] = [];
const journal = [
  { id: "a0", seq: 1, kind: "narration", actor: "ai", payload: {}, created_at: "2026-11-28T08:00:00Z" },
  { id: "a1", seq: 2, kind: "player_action", actor: "player", payload: {}, created_at: "2026-11-28T09:00:00Z" },
  { id: "a2", seq: 3, kind: "rule_application", actor: "system", payload: { source: "pc_concealment", block_id: "b", segment_id: "s", before: null }, created_at: "2026-11-28T09:00:01Z" },
  { id: "a3", seq: 4, kind: "narration", actor: "ai", payload: {}, created_at: "2026-11-28T09:00:02Z" },
];

vi.mock("server-only", () => ({}));
vi.mock("@/src/server/repos/campaigns", () => ({ getCampaignById: async () => ({ id: "c", mode: "solo", gm_user_id: "u" }) }));
vi.mock("@/src/server/repos/sessions", () => ({
  getOpenSessionForCampaign: async () => ({ id: "sess" }),
  listSessionEvents: async () => journal,
  nextEventSeq: async () => 5,
  insertSessionEvent: async () => ({ id: "undo" }),
}));
vi.mock("@/src/server/repos/aiProposals", () => ({ listAiProposalsBySessionEventIds: async () => [], updateAiProposalStatus: async () => undefined }));
vi.mock("@/src/server/repos/entities", () => ({ softDeleteEntity: async () => ({ deleted: false }) }));
vi.mock("@/src/server/repos/entityDiscoveries", () => ({ deleteDiscoveriesBySourceEvents: async () => 0 }));
vi.mock("@/src/server/repos/entityFacetDiscoveries", () => ({
  deleteFacetDiscoveriesBySourceEvents: async (_s: unknown, p: { eventIds: readonly string[] }) => {
    suppressions.push({ table: "entity_facet_discoveries", eventIds: p.eventIds });
    return 2;
  },
}));
vi.mock("@/src/server/repos/npcKnowledge", () => ({
  deleteNpcKnowledgeBySourceEvents: async (_s: unknown, p: { eventIds: readonly string[] }) => {
    suppressions.push({ table: "npc_knowledge", eventIds: p.eventIds });
    return 1;
  },
}));
vi.mock("@/src/server/repos/activeEffects", () => ({ deleteFeatureEffectsCreatedSince: async () => 0 }));
vi.mock("@/src/server/repos/runtimeState", () => ({ deleteRuntimeState: async () => undefined, putRuntimeState: async () => undefined }));
vi.mock("@/src/server/repos/sceneStates", () => ({ putSceneState: async () => undefined }));
vi.mock("@/src/server/services/inventoryActions", () => ({ restoreInventory: async () => false }));
vi.mock("@/src/server/services/aiProposals", () => ({ removeAppliedNote: async () => ({ ok: true }) }));
vi.mock("@/src/server/services/combats", () => ({ deleteCombatById: async () => undefined }));
vi.mock("@/src/server/services/pcConcealment", () => ({
  restorePcConcealments: async (_s: unknown, p: { payloads: unknown[] }) => {
    remis.push(p.payloads);
    return 1;
  },
}));

const { undoLastSoloTurn } = await import("./turnUndo");
const supabase = {} as SupabaseClient<Database>;

beforeEach(() => {
  suppressions.length = 0;
  remis.length = 0;
});

describe("undoLastSoloTurn — V3.2-83", () => {
  it("les indices révélés et ce que les PNJ ont appris pendant le tour s'en vont ; le signe caché revient", async () => {
    const r = await undoLastSoloTurn(supabase, { campaignId: "c", callerId: "u" });
    expect(r).toMatchObject({ ok: true, reverted: { facets: 2, knowledge: 1, marks: 1 } });
    expect(suppressions).toEqual([
      { table: "entity_facet_discoveries", eventIds: ["a1", "a2", "a3"] },
      { table: "npc_knowledge", eventIds: ["a1", "a2", "a3"] },
    ]);
    expect(remis).toEqual([[journal[2]!.payload]]);
  });
});
