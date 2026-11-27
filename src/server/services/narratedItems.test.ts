import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/** V3.2-54 — Câblage seulement : quel bloc réécrit, quelle trace, quelle facette. Le choix de l'objet est testé dans `narratedItem.test.ts`. */

const MABELLE = "11111111-1111-4111-8111-111111111111";
let admin = true;
let blocs: unknown[] = [];
const ecritures: { data: { items: unknown[] }; expectedVersion: number }[] = [];
const propositions: { kind: string; status: string }[] = [];
const facettes: { facets: string[]; userId: string | null | undefined }[] = [];

vi.mock("@/src/server/services/permissions", () => ({ isWorldAdmin: async () => admin }));
vi.mock("@/src/server/repos/blocks", () => ({ listBlocksByTypesForEntities: async () => blocs }));
vi.mock("@/src/server/services/blocks", () => ({
  updateBlockContent: async (_s: unknown, p: { data: { items: unknown[] }; expectedVersion: number }) => {
    ecritures.push({ data: p.data, expectedVersion: p.expectedVersion });
    return { ok: true, block: {} };
  },
}));
vi.mock("@/src/server/repos/aiProposals", () => ({
  insertAiProposal: async (_s: unknown, p: { kind: string; status: string }) => {
    propositions.push({ kind: p.kind, status: p.status });
    return { id: "prop" };
  },
}));
vi.mock("@/src/server/services/facetDiscoveries", () => ({
  revealFacets: async (_s: unknown, p: { facets: string[]; userId?: string | null }) => {
    facettes.push({ facets: p.facets, userId: p.userId });
    return { revealed: p.facets };
  },
}));

const { addNarratedItem } = await import("./narratedItems");
const supabase = {} as SupabaseClient<Database>;
const base = { worldId: "w", campaignId: "c", sessionEventId: "ev", entityId: MABELLE, callerId: "u" };
const inventaire = {
  id: "inv",
  entity_id: MABELLE,
  block_type: "inventory",
  display: { label: "Équipement" },
  version: 3,
  visibility_level: "gm",
  visibility_scope_id: null,
  data: { __v: 1, items: [{ id: "pnj-0", qty: 1, equipped: true, label: "Tablier" }], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } },
};

beforeEach(() => {
  admin = true;
  blocs = [inventaire];
  ecritures.length = 0;
  propositions.length = 0;
  facettes.length = 0;
});

describe("addNarratedItem — V3.2-54", () => {
  it("une chope montrée par le récit entre dans l'inventaire, se voit, et laisse sa trace", async () => {
    expect(await addNarratedItem(supabase, { ...base, name: "une chope d'étain" })).toEqual({ ok: true, itemId: "recit-0" });
    expect(ecritures[0]!.expectedVersion).toBe(3);
    expect(ecritures[0]!.data.items).toHaveLength(2);
    expect(propositions).toEqual([{ kind: "update_block", status: "applied" }]);
    expect(facettes).toEqual([{ facets: ["item:recit-0"], userId: null }]);
  });

  it("une dague absente de la fiche ne s'invente pas", async () => {
    expect(await addNarratedItem(supabase, { ...base, name: "une dague" })).toEqual({ ok: false, reason: "refused" });
    expect(ecritures).toHaveLength(0);
  });

  it("un objet déjà là ne réécrit rien", async () => {
    expect(await addNarratedItem(supabase, { ...base, name: "tablier" })).toEqual({ ok: false, reason: "refused" });
    expect(ecritures).toHaveLength(0);
  });

  it("une esquisse sans fiche, ou un PNJ sans inventaire : rien", async () => {
    expect(await addNarratedItem(supabase, { ...base, entityId: "calc:aubergiste", name: "Chope" })).toEqual({ ok: false, reason: "no_inventory" });
    blocs = [];
    expect(await addNarratedItem(supabase, { ...base, name: "Chope" })).toEqual({ ok: false, reason: "no_inventory" });
  });

  it("réservé au MJ du monde", async () => {
    admin = false;
    expect(await addNarratedItem(supabase, { ...base, name: "Chope" })).toEqual({ ok: false, reason: "forbidden" });
  });
});
