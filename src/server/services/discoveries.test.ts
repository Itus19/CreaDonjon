import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { DetailLevel } from "@/src/core/rules/discovery";

/** V3-C4 — Même méthode que `sceneSketches.test.ts` : le dépôt est simulé, ce qui se vérifie ici c'est que le service n'écrit JAMAIS une régression. */

let existing: { id: string; campaignId: string; entityId: string; userId: string; detailLevel: DetailLevel; sourceEventId: string | null } | null;
const upserts: { id?: string; detailLevel: DetailLevel; sourceEventId: string | null }[] = [];

vi.mock("@/src/server/repos/entityDiscoveries", () => ({
  getDiscovery: async () => existing,
  upsertDiscovery: async (_s: unknown, params: { id?: string; detailLevel: DetailLevel; sourceEventId: string | null }) => {
    upserts.push(params);
  },
  listDiscoveriesForUser: async () => new Map(existing ? [[existing.entityId, existing.detailLevel]] : []),
}));

const { discoverEntity, listDiscoveredEntityIds } = await import("./discoveries");
const supabase = {} as SupabaseClient<Database>;
const base = { campaignId: "c", userId: "u", entityId: "e-1" };

beforeEach(() => {
  existing = null;
  upserts.length = 0;
});

describe("discoverEntity", () => {
  it("rien de decouvert : cree la ligne au niveau demande", async () => {
    await discoverEntity(supabase, { ...base, level: "known" });
    expect(upserts).toMatchObject([{ id: undefined, detailLevel: "known", sourceEventId: null }]);
  });

  it("deja au meme niveau : n'ecrit rien", async () => {
    existing = { id: "d-1", campaignId: "c", entityId: "e-1", userId: "u", detailLevel: "known", sourceEventId: null };
    await discoverEntity(supabase, { ...base, level: "known" });
    expect(upserts).toEqual([]);
  });

  it("avance d'un niveau : met a jour la ligne existante", async () => {
    existing = { id: "d-1", campaignId: "c", entityId: "e-1", userId: "u", detailLevel: "mentioned", sourceEventId: null };
    await discoverEntity(supabase, { ...base, level: "known" });
    expect(upserts).toMatchObject([{ id: "d-1", detailLevel: "known", sourceEventId: null }]);
  });

  it("ne redescend jamais : ignore un niveau plus faible", async () => {
    existing = { id: "d-1", campaignId: "c", entityId: "e-1", userId: "u", detailLevel: "detailed", sourceEventId: "ev-1" };
    await discoverEntity(supabase, { ...base, level: "mentioned" });
    expect(upserts).toEqual([]);
  });

  it("garde la source d'origine si la nouvelle promotion n'en fournit pas", async () => {
    existing = { id: "d-1", campaignId: "c", entityId: "e-1", userId: "u", detailLevel: "mentioned", sourceEventId: "ev-1" };
    await discoverEntity(supabase, { ...base, level: "known" });
    expect(upserts).toMatchObject([{ id: "d-1", detailLevel: "known", sourceEventId: "ev-1" }]);
  });
});

describe("listDiscoveredEntityIds", () => {
  it("rend les identifiants decouverts, sans leur niveau", async () => {
    existing = { id: "d-1", campaignId: "c", entityId: "e-1", userId: "u", detailLevel: "known", sourceEventId: null };
    const ids = await listDiscoveredEntityIds(supabase, "c", "u");
    expect(ids).toEqual(new Set(["e-1"]));
  });
});
