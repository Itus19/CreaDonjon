import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { DEFAULT_CALENDAR } from "@/src/core/calendar/defaultCalendar";

/**
 * V3.1-96 (ADR 0048) — le câblage de `getWorldTimeline`, dépôts remplacés par
 * un petit monde en mémoire : UNE requête pour les blocs Chronologie et
 * personnage, et le filtre par lecteur (bloc puis entrée) avant l'envoi.
 */

const year = (y: number) => ({ year: y, month: null, day: null, precision: "year" as const, end: null, label: null });
const blockCalls: { types: readonly string[] }[] = [];

vi.mock("@/src/server/repos/entities", () => ({
  listEntitiesForWorld: async () => [
    { id: "pj", name: "Aldric", slug: "aldric", entity_kind: "character" },
    { id: "pnj", name: "Mira", slug: "mira", entity_kind: "character" },
    { id: "wt", name: "Chronologie du monde", slug: "chrono", entity_kind: "world_timeline" },
  ],
  listEntitiesByKinds: async () => [],
  getEntityById: async () => null,
}));
vi.mock("@/src/server/services/worlds", () => ({ getCalendar: async () => DEFAULT_CALENDAR }));
vi.mock("@/src/server/services/visibility", () => ({
  buildViewerForWorld: async () => ({ kind: "user", userId: "joueuse", worldRole: "viewer", campaignRoles: {} }),
}));
vi.mock("@/src/server/repos/blocks", () => ({
  getBlockById: async () => null,
  listBlocksByTypeForEntities: async () => {
    throw new Error("getWorldTimeline ne doit pas lire les blocs type par type");
  },
  listBlocksByTypesForEntities: async (_s: unknown, _ids: string[], types: readonly string[]) => {
    blockCalls.push({ types });
    const row = (id: string, entityId: string, blockType: string, level: string, data: unknown) => ({
      id, entity_id: entityId, block_type: blockType, data, display: {}, display_order: 0, version: 1,
      visibility_level: level, visibility_scope_id: null, created_by: "mj", created_at: "", updated_at: "",
    });
    return [
      row("b1", "pj", "character", "public", { birth: year(1420), death: year(1478) }),
      row("b2", "pnj", "character", "gm", { birth: year(1450) }),
      row("b3", "wt", "timeline", "public", {
        __v: 1,
        entries: [
          { id: "guerre", date: year(1400), kind: "war", title: "La Grande Guerre", visibility: { level: "public", scopeId: null } },
          { id: "secret", date: year(1401), kind: "betrayal", title: "Le complot", visibility: { level: "gm", scopeId: null } },
        ],
      }),
    ];
  },
}));
vi.mock("@/src/server/services/blocks", () => ({ createBlock: vi.fn(), updateBlockContent: vi.fn() }));
vi.mock("@/src/server/services/entities", () => ({ createEntity: vi.fn() }));
vi.mock("@/src/server/services/permissions", () => ({ isWorldAdmin: vi.fn() }));
vi.mock("@/src/server/services/promotion", () => ({ promoteToEntity: vi.fn() }));

describe("getWorldTimeline (V3.1-96)", () => {
  it("une seule requête pour les blocs Chronologie et les naissances et morts du monde", async () => {
    const { getWorldTimeline } = await import("./timeline");
    blockCalls.length = 0;
    await getWorldTimeline({} as SupabaseClient<Database>, "monde", "joueuse");
    expect(blockCalls).toEqual([{ types: ["timeline", "character"] }]);
  });

  it("une joueuse ne reçoit aucune date qu'elle ne peut pas voir", async () => {
    const { getWorldTimeline } = await import("./timeline");
    const { entries } = await getWorldTimeline({} as SupabaseClient<Database>, "monde", "joueuse");
    const titles = entries.map((e) => e.entry.title);
    expect(titles).toEqual(["La Grande Guerre", "Naissance d'Aldric", "Mort d'Aldric"]);
    expect(JSON.stringify(entries)).not.toContain("Mira");
    expect(JSON.stringify(entries)).not.toContain("complot");
  });

  it("chaque entrée dit sa source et sa portée", async () => {
    const { getWorldTimeline } = await import("./timeline");
    const { entries } = await getWorldTimeline({} as SupabaseClient<Database>, "monde", "joueuse");
    expect(entries.map((e) => [e.entry.title, e.source.kind, e.scope])).toEqual([
      ["La Grande Guerre", "world", "major"],
      ["Naissance d'Aldric", "birth", "detail"],
      ["Mort d'Aldric", "death", "detail"],
    ]);
  });
});
