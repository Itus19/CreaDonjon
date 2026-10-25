import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";

/**
 * V3.1-72 — les vignettes du Réseau montrent le portrait de chaque fiche.
 * Critère : « les portraits arrivent en une seule requête » — une lecture du
 * dépôt pour tout le graphe, jamais une par fiche (pas de N+1).
 */
const appels = { portraits: 0, ids: [] as string[][] };
vi.mock("@/src/server/repos/relations", () => ({
  listAllRelationsForWorld: async () => [
    { id: "r1", source_entity_id: "a", target_entity_id: "b", relation_type: "member_of", visibility_level: "public", visibility_scope_id: null, created_by: "u1" },
    { id: "r2", source_entity_id: "a", target_entity_id: "c", relation_type: "lives_in", visibility_level: "public", visibility_scope_id: null, created_by: "u1" },
  ],
}));
vi.mock("@/src/server/repos/entities", () => ({
  listEntitiesForWorld: async () => [
    { id: "a", name: "Sildar", slug: "sildar", entity_kind: "character", is_public: true },
    { id: "b", name: "Alliance", slug: "alliance", entity_kind: "faction", is_public: true },
    { id: "c", name: "Phandaline", slug: "phandaline", entity_kind: "location", is_public: true },
  ],
}));
vi.mock("@/src/server/repos/entityPortraits", () => ({
  listEntityIdsWithPortrait: async (_s: unknown, ids: string[]) => {
    appels.portraits++;
    appels.ids.push(ids);
    return new Set(["a"]);
  },
}));
vi.mock("@/src/server/services/entities", () => ({ listPlayerVisibleEntityIds: async () => new Set<string>() }));

const { getRelationsGraphData } = await import("./relationsGraph");

describe("getRelationsGraphData — portraits (V3.1-72)", () => {
  it("lit les portraits de tout le graphe en un seul appel au dépôt", async () => {
    const viewer: Viewer = { kind: "anonymous" };
    const data = await getRelationsGraphData({} as SupabaseClient<Database>, { worldId: "w", viewer });
    expect(appels.portraits).toBe(1);
    expect(appels.ids[0].sort()).toEqual(["a", "b", "c"]);
    expect(data.entities.map((e) => [e.id, e.hasPortrait])).toEqual([
      ["a", true],
      ["b", false],
      ["c", false],
    ]);
  });
});
