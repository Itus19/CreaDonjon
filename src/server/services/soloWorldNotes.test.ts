import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * V3-C3, V3.2-27 — Même méthode que `sceneSketches.test.ts` : les accès base
 * sont simulés, ce qui se vérifie ici c'est le CÂBLAGE (quel bloc, quel
 * statut, quel motif de rejet, la ligne du tour), jamais l'écriture du bloc
 * elle-même (`aiProposals.integration.test.ts`).
 */

let blocks: { id: string; block_type: string; display?: { label: string } }[] = [];
const blocsCrees: { label: string; visibilityLevel: string }[] = [];
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
vi.mock("@/src/server/services/blocks", () => ({
  createBlock: async (_s: unknown, params: { label: string; visibilityLevel: string }) => {
    blocsCrees.push({ label: params.label, visibilityLevel: params.visibilityLevel });
    const block = { id: `cree-${blocsCrees.length}`, block_type: "text", display: { label: params.label } };
    blocks = [...blocks, block];
    return { ok: true, block: { id: block.id } };
  },
}));
const segmentsParBloc: { blockId: string; text: string }[] = [];
vi.mock("@/src/server/services/aiProposals", () => ({
  appendNoteSegment: async (_s: unknown, params: { blockId: string; segmentId: string; text: string }) => {
    if (!ajoutReussi) return { ok: false, reason: "conflict" };
    segmentsParBloc.push({ blockId: params.blockId, text: params.text });
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
  segmentsParBloc.length = 0;
  blocsCrees.length = 0;
  ajoutReussi = true;
});

describe("proposeWorldNote — V3.2-54, chaque note dans son bloc", () => {
  const description = { id: "desc", block_type: "text", display: { label: "Description" } };
  const apparence = { id: "app", block_type: "text", display: { label: "Apparence" } };

  it("l'apparence va au bloc Apparence, même s'il n'est pas le premier", async () => {
    blocks = [description, apparence];
    await proposeWorldNote(supabase, { ...base, text: "Un tablier taché de vin.", aspect: "apparence" });
    expect(segmentsParBloc).toEqual([{ blockId: "app", text: "Un tablier taché de vin." }]);
  });

  it("sans bloc Apparence encore, la note d'apparence va au bloc général", async () => {
    blocks = [description];
    await proposeWorldNote(supabase, { ...base, text: "Un tablier taché de vin.", aspect: "apparence" });
    expect(segmentsParBloc).toEqual([{ blockId: "desc", text: "Un tablier taché de vin." }]);
  });

  it("un détail caché crée le bloc réservé au MJ plutôt que d'aller dans un bloc lisible", async () => {
    blocks = [apparence, description];
    await proposeWorldNote(supabase, { ...base, text: "Un serpent tatoué sous la manche.", aspect: "cache" });
    expect(blocsCrees).toEqual([{ label: "Ce qui ne se voit pas", visibilityLevel: "gm" }]);
    expect(segmentsParBloc).toEqual([{ blockId: "cree-1", text: "Un serpent tatoué sous la manche." }]);
  });

  it("une note de récit ne va jamais dans Apparence, même placé en tête", async () => {
    blocks = [apparence, description];
    await proposeWorldNote(supabase, { ...base, text: "Elle sert ici depuis vingt ans.", aspect: "recit" });
    expect(segmentsParBloc).toEqual([{ blockId: "desc", text: "Elle sert ici depuis vingt ans." }]);
  });
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
