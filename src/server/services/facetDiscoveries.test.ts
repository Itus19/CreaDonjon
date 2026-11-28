import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/** V3.2-87 — À une table, la vue d'un PNJ vient de la base (`npc_player_view`), déjà filtrée ; les blocs ne sont pas lus. */

let rpc: () => Promise<unknown> = async () => null;
let blocsLus = 0;

vi.mock("server-only", () => ({}));
vi.mock("@/src/server/repos/entityFacetDiscoveries", () => ({
  rpcNpcPlayerView: () => rpc(),
  listFacetDiscoveries: async () => new Map(),
  insertFacetDiscoveries: async () => undefined,
}));
vi.mock("@/src/server/repos/blocks", () => ({
  listBlocksByTypesForEntities: async () => {
    blocsLus++;
    return [];
  },
}));
vi.mock("@/src/server/services/referenceChips", () => ({ resolveBlockReferences: async () => [] }));
vi.mock("@/src/server/repos/worlds", () => ({ getWorldDefaultRulesetId: async () => null }));

const { readNpcDisplayView } = await import("./facetDiscoveries");
const supabase = {} as SupabaseClient<Database>;
const base = { campaignId: "c", entityId: "mabelle", userId: "u", world: { id: "w", slug: "m" }, locale: "fr" as const, atTable: true };

beforeEach(() => {
  blocsLus = 0;
});

describe("readNpcDisplayView à table — V3.2-87", () => {
  it("la CA découverte par la table, et rien d'autre de la fiche", async () => {
    rpc = async () => ({ sheet: { abilities: {}, ac: 11, actions: [], traits: [] }, gear: null });
    const vue = await readNpcDisplayView(supabase, base);
    expect(vue).toMatchObject({ ac: 11, abilities: {}, actions: [], items: [], hasSheet: true, hasGear: false });
    expect(vue).not.toHaveProperty("hp");
    expect(blocsLus).toBe(0);
  });

  it("hors de la partie, la base rend null : aucune vue", async () => {
    rpc = async () => null;
    expect(await readNpcDisplayView(supabase, base)).toBeNull();
  });

  it("une erreur de la base (migration pas encore appliquée) ne casse pas la page", async () => {
    rpc = async () => {
      throw new Error("function npc_player_view does not exist");
    };
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await readNpcDisplayView(supabase, base)).toBeNull();
    expect(erreurs).toHaveBeenCalled();
    erreurs.mockRestore();
  });
});
