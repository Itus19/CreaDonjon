import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * V3.1-61 — chaque entrée du journal porte le type de sa fiche (`entityKind`),
 * si c'est un PJ (`pc`) et son numéro de révision, pour filtrer côté client.
 * Critère : « entityKind renvoyé sans requête supplémentaire par ligne » —
 * le type vient de la même lecture que le nom ; les PJ se lisent une fois.
 */
const appels = { pj: 0, entites: 0 };
vi.mock("@/src/server/repos/activityJournal", () => ({
  listEntityRevisionsForWorld: async () => [
    { entity_id: "e1", entity_name: "Sakaburin", entity_slug: "sakaburin", entity_kind: "character", revision_number: 14, change_source: "manual", changed_by: "u1", created_at: "2026-10-08T10:42:00Z" },
    { entity_id: "e2", entity_name: "Grotte", entity_slug: "grotte", entity_kind: "location", revision_number: 1, change_source: "manual", changed_by: "u1", created_at: "2026-10-08T09:00:00Z" },
    { entity_id: "e3", entity_name: "Vieux Tom", entity_slug: "vieux-tom", entity_kind: "character", revision_number: 2, change_source: "ai", changed_by: null, created_at: "2026-10-07T09:00:00Z" },
  ],
  listEntityRevisionsForEntities: async () => [],
  listSessionEventsForWorld: async () => [
    { id: "ev1", kind: "roll", actor: "player", actor_user_id: "u1", created_at: "2026-10-08T11:00:00Z", payload: {} },
    { id: "ev2", kind: "world_update", actor: "gm", actor_user_id: "u1", created_at: "2026-10-08T11:30:00Z", payload: { entity_id: "e1" } },
  ],
  getDisplayNamesForUsers: async () => new Map([["u1", "Inès"]]),
}));
vi.mock("@/src/server/repos/campaigns", () => ({
  listPcEntityIdsForWorld: async () => {
    appels.pj++;
    return ["e1"];
  },
}));
vi.mock("@/src/server/repos/entities", () => ({
  listEntitiesByIds: async (_s: unknown, ids: string[]) => {
    appels.entites++;
    return ids.map((id) => ({ id, slug: "sakaburin", name: "Sakaburin", entity_kind: "character" }));
  },
}));
vi.mock("@/src/server/repos/entityRevisions", () => ({ listRevisionSnapshotsInRange: async () => [] }));
vi.mock("@/src/server/repos/worlds", () => ({ getWorldDefaultRulesetId: async () => "r1" }));
vi.mock("@/src/server/repos/rules", () => ({ listRulesetEntryChipsByKeys: async () => [], listTranslationsForEntries: async () => [] }));
vi.mock("@/src/server/services/rules", () => ({ walkRulesetChain: async () => [], entryNameFrom: () => "" }));
vi.mock("@/src/server/services/entityHistory", () => ({ normalizeStoredSnapshot: (s: unknown) => s }));

const { getMergedJournalForWorld } = await import("./activityJournal");
const supabase = {} as SupabaseClient<Database>;

beforeEach(() => {
  appels.pj = 0;
  appels.entites = 0;
});

describe("getMergedJournalForWorld (V3.1-61)", () => {
  it("chaque entrée porte le type de sa fiche, si c'est un PJ, et son numéro de révision", async () => {
    const journal = await getMergedJournalForWorld(supabase, "w1");
    const saka = journal.find((e) => e.source === "wiki" && e.entityName === "Sakaburin");
    expect(saka).toMatchObject({ entityKind: "character", pc: true, revisionNumber: 14 });
    expect(journal.find((e) => e.entityName === "Grotte")).toMatchObject({ entityKind: "location", pc: false, revisionNumber: 1 });
    expect(journal.find((e) => e.entityName === "Vieux Tom")).toMatchObject({ entityKind: "character", pc: false });
    const jeu = journal.filter((e) => e.source === "jeu");
    expect(jeu.find((e) => e.entityName === null)).toMatchObject({ entityKind: null, pc: false, revisionNumber: null });
    expect(jeu.find((e) => e.entityName === "Sakaburin")).toMatchObject({ entityKind: "character", pc: true });
  });

  it("sans requête par ligne : les PJ se lisent une fois, les fiches des événements une fois", async () => {
    await getMergedJournalForWorld(supabase, "w1");
    expect(appels).toEqual({ pj: 1, entites: 1 });
  });
});
