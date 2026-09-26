import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * V3-C3 — Même méthode que `sceneSketches.test.ts` : les accès base sont
 * simulés, ce qui se vérifie ici c'est le CÂBLAGE (quel bloc, quel statut,
 * quel motif de rejet), jamais `applyAiProposal`/`rejectAiProposal` eux-mêmes
 * (V1-F3, déjà couverts par `aiProposals.integration.test.ts`).
 */

let blocks: { id: string; block_type: string }[] = [];
const proposalsInserted: { kind: string; targetEntityId: string | null; status: string; sessionEventId: string | null; payload: unknown }[] = [];

vi.mock("@/src/server/repos/blocks", () => ({ listBlocksForEntity: async () => blocks }));
vi.mock("@/src/server/repos/aiProposals", () => ({
  insertAiProposal: async (
    _s: unknown,
    params: { kind: string; targetEntityId: string | null; status: string; sessionEventId?: string | null; payload: unknown }
  ) => {
    proposalsInserted.push({
      kind: params.kind,
      targetEntityId: params.targetEntityId,
      status: params.status,
      sessionEventId: params.sessionEventId ?? null,
      payload: params.payload,
    });
    return { id: `prop-${proposalsInserted.length}` };
  },
}));

const { proposeWorldNote } = await import("./soloWorldNotes");
const supabase = {} as SupabaseClient<Database>;
const base = { worldId: "w", campaignId: "c", sessionEventId: "ev-1", entityId: "e-1" };

beforeEach(() => {
  blocks = [];
  proposalsInserted.length = 0;
});

describe("proposeWorldNote", () => {
  it("cree une proposition pending ciblant le bloc text existant", async () => {
    blocks = [{ id: "block-1", block_type: "text" }];
    const outcome = await proposeWorldNote(supabase, { ...base, text: "Un fait a suggerer." });
    expect(outcome).toEqual({ ok: true, proposal: { id: "prop-1" } });
    expect(proposalsInserted).toEqual([
      { kind: "update_block", targetEntityId: "e-1", status: "pending", sessionEventId: "ev-1", payload: { blockId: "block-1", text: "Un fait a suggerer." } },
    ]);
  });

  it("ignore un bloc d'un autre type, n'en cree pas un nouveau", async () => {
    blocks = [{ id: "block-1", block_type: "statblock" }];
    const outcome = await proposeWorldNote(supabase, { ...base, text: "Un fait a suggerer." });
    expect(outcome).toEqual({ ok: false, reason: "no_text_block" });
  });

  it("aucun bloc text : rejette immediatement, sans jamais rester silencieux", async () => {
    const outcome = await proposeWorldNote(supabase, { ...base, text: "Un fait a suggerer." });
    expect(outcome).toEqual({ ok: false, reason: "no_text_block" });
    expect(proposalsInserted).toEqual([
      { kind: "update_block", targetEntityId: "e-1", status: "rejected", sessionEventId: "ev-1", payload: { text: "Un fait a suggerer." } },
    ]);
  });
});
