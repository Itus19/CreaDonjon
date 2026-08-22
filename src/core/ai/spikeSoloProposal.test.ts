import { describe, expect, it } from "vitest";
import { SPIKE_NPCS, zSpikeTurnProposal } from "./spikeSoloProposal";

describe("zSpikeTurnProposal", () => {
  it("accepte une narration seule", () => {
    const result = zSpikeTurnProposal.safeParse({ narration: "Bram sert une biere." });
    expect(result.success).toBe(true);
  });

  it("accepte une reaction de PNJ dont l'id est reel", () => {
    const result = zSpikeTurnProposal.safeParse({
      narration: "Grelin fronce les sourcils.",
      npc_reaction: { npc_id: SPIKE_NPCS[0].id, text: "Il grommelle." },
    });
    expect(result.success).toBe(true);
  });

  it("rejette un identifiant de PNJ invente — le garde-fou anti-hallucination", () => {
    const result = zSpikeTurnProposal.safeParse({
      narration: "Un inconnu reagit.",
      npc_reaction: { npc_id: "invente-par-le-modele", text: "..." },
    });
    expect(result.success).toBe(false);
  });

  it("rejette une narration vide", () => {
    const result = zSpikeTurnProposal.safeParse({ narration: "" });
    expect(result.success).toBe(false);
  });
});
