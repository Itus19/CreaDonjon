import { describe, expect, it } from "vitest";
import { soloNarrationSchema, soloNarrationToolSchema } from "./soloNarrationProposal";

describe("soloNarrationSchema", () => {
  it("accepte une narration seule", () => {
    const result = soloNarrationSchema(["npc-1"]).safeParse({ narration: "Bram sert une bière." });
    expect(result.success).toBe(true);
  });

  it("accepte une reaction d'un PNJ present", () => {
    const result = soloNarrationSchema(["npc-1", "npc-2"]).safeParse({
      narration: "Bram fronce les sourcils.",
      npc_reaction: { npc_id: "npc-2", text: "Il grommelle." },
    });
    expect(result.success).toBe(true);
  });

  it("rejette un identifiant de PNJ invente — le garde-fou anti-hallucination", () => {
    const result = soloNarrationSchema(["npc-1"]).safeParse({
      narration: "Un inconnu reagit.",
      npc_reaction: { npc_id: "invente-par-le-modele", text: "..." },
    });
    expect(result.success).toBe(false);
  });

  it("rejette une narration vide", () => {
    expect(soloNarrationSchema(["npc-1"]).safeParse({ narration: "" }).success).toBe(false);
  });

  it("aucun PNJ present : npc_reaction n'existe meme pas dans le schema, jamais un enum vide", () => {
    const schema = soloNarrationSchema([]);
    expect(schema.safeParse({ narration: "Le vent souffle." }).success).toBe(true);
    expect(schema.safeParse({ narration: "Le vent souffle.", npc_reaction: { npc_id: "x", text: "y" } }).success).toBe(false);
  });

  it("V3-C2 — accepte une demande de personnage incident, un role seulement", () => {
    const result = soloNarrationSchema([]).safeParse({ narration: "Quelqu'un approche.", new_character: { role: "le tavernier" } });
    expect(result.success).toBe(true);
  });

  it("V3-C2 — rejette un role vide", () => {
    const result = soloNarrationSchema([]).safeParse({ narration: "Quelqu'un approche.", new_character: { role: "" } });
    expect(result.success).toBe(false);
  });
});

describe("soloNarrationToolSchema", () => {
  it("liste les ids reels dans l'enum, jamais une chaine libre", () => {
    const schema = soloNarrationToolSchema(["npc-1", "npc-2"]);
    const props = schema.properties as { npc_reaction?: { properties: { npc_id: { enum: readonly string[] } } } };
    expect(props.npc_reaction?.properties.npc_id.enum).toEqual(["npc-1", "npc-2"]);
  });

  it("omet npc_reaction quand personne n'est present", () => {
    const schema = soloNarrationToolSchema([]);
    expect("npc_reaction" in schema.properties).toBe(false);
  });

  it("V3-C2 — new_character reste offert meme sans aucun PNJ present", () => {
    const schema = soloNarrationToolSchema([]);
    expect("new_character" in schema.properties).toBe(true);
  });
});
