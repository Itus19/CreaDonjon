import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * V3-C3, V3.2-22 — Même méthode que `sceneSketches.test.ts` : les accès base
 * sont simulés, ce qui se vérifie ici c'est le CÂBLAGE (quel bloc, quel
 * statut, quel motif de rejet, la ligne du tour), jamais l'écriture du bloc
 * elle-même (`aiProposals.integration.test.ts`).
 */

let blocks: { id: string; block_type: string }[] = [];
const proposalsInserted: { id?: string; kind: string; targetEntityId: string | null; status: string; sessionEventId: string | null; payload: unknown; autoApplied?: boolean }[] = [];
const notes: unknown[] = [];
let ajoutReussi = true;
const segmentsAjoutes: { segmentId: string; text: string }[] = [];

vi.mock("@/src/server/repos/blocks", () => ({ listBlocksForEntity: async () => blocks }));
vi.mock("@/src/server/repos/aiProposals", () => ({
  insertAiProposal: async (
    _s: unknown,
    params: { id?: string; kind: string; targetEntityId: string | null; status: string; sessionEventId?: string | null; payload: unknown; autoApplied?: boolean }
  ) => {
    proposalsInserted.push({
      ...(params.id ? { id: params.id } : {}),
      kind: params.kind,
      targetEntityId: params.targetEntityId,
      status: params.status,
      sessionEventId: params.sessionEventId ?? null,
      payload: params.payload,
      ...(params.autoApplied !== undefined ? { autoApplied: params.autoApplied } : {}),
    });
    return { id: params.id ?? `prop-${proposalsInserted.length}` };
  },
}));
vi.mock("@/src/server/repos/sessions", () => ({
  nextEventSeq: async () => 7,
  insertSessionEvent: async (_s: unknown, params: { payload: unknown }) => {
    notes.push(params.payload);
    return { id: "ev-note" };
  },
}));
vi.mock("@/src/server/services/aiProposals", () => ({
  appendNoteSegment: async (_s: unknown, params: { segmentId: string; text: string }) => {
    if (!ajoutReussi) return { ok: false, reason: "conflict" };
    segmentsAjoutes.push({ segmentId: params.segmentId, text: params.text });
    return { ok: true };
  },
}));

const { proposeWorldNote } = await import("./soloWorldNotes");
const supabase = {} as SupabaseClient<Database>;
const base = { worldId: "w", campaignId: "c", sessionId: "s", sessionEventId: "ev-1", entityId: "e-1", callerId: "u" };

beforeEach(() => {
  blocks = [];
  proposalsInserted.length = 0;
  notes.length = 0;
  segmentsAjoutes.length = 0;
  ajoutReussi = true;
});

describe("proposeWorldNote", () => {
  it("ajoute la note d'office au bloc text existant : le paragraphe porte l'identifiant de la proposition, appliquée", async () => {
    blocks = [{ id: "block-1", block_type: "text" }];
    const outcome = await proposeWorldNote(supabase, { ...base, text: "Un fait a suggerer." });
    expect(outcome.ok).toBe(true);
    const [p] = proposalsInserted;
    expect(p).toMatchObject({ kind: "update_block", targetEntityId: "e-1", status: "applied", autoApplied: true, sessionEventId: "ev-1", payload: { blockId: "block-1", text: "Un fait a suggerer." } });
    expect(segmentsAjoutes).toEqual([{ segmentId: p!.id, text: "Un fait a suggerer." }]);
    expect(notes).toEqual([{ __v: 1, note: "Ajouté au wiki : « Un fait a suggerer. »", source: "world_note", proposal_id: p!.id }]);
  });

  it("l'ajout échoue (droit, conflit) : la note reste à relire, et la ligne du tour le dit", async () => {
    blocks = [{ id: "block-1", block_type: "text" }];
    ajoutReussi = false;
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    await proposeWorldNote(supabase, { ...base, text: "Un fait a suggerer." });
    erreur.mockRestore();
    expect(proposalsInserted[0]).toMatchObject({ status: "pending", autoApplied: false });
    expect(notes).toHaveLength(1);
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
