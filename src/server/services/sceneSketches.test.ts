import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { emptyScene, addSketch, type SceneState } from "@/src/core/rules/scene";

/**
 * V3-C2 — Même méthode que `sceneGeneration.test.ts` (V3-C1) : le vrai
 * moteur de scène (`src/core/rules/scene.ts`) tourne réellement, seuls les
 * accès base et le tirage du générateur sont remplacés par un petit monde en
 * mémoire — ce qui se vérifie ici, c'est le CÂBLAGE (qui promeut, qui
 * journalise quoi, quand), jamais le moteur de tables lui-même (V3-C1, déjà
 * couvert ailleurs).
 */

let scene: SceneState | null;
const putCalls: SceneState[] = [];
const inserted: { kind: string; actor: string; payload: Record<string, unknown> }[] = [];
let sketchAppearances: { locationId: string }[] = [];
let generateResult: { sections: { key: string; label: string; text: string; slots: [] }[] } | { error: string };
let promoted: { ok: true; entity: { id: string; slug: string } } | { ok: false; reason: "forbidden" };
const promoteCalls: { name: string; entityKind: string; blocks: { label: string; text: string }[] }[] = [];

vi.mock("@/src/server/repos/sceneStates", () => ({
  getSceneState: async () => scene,
  putSceneState: async (_s: unknown, params: { state: SceneState }) => {
    putCalls.push(params.state);
    scene = params.state;
  },
}));
vi.mock("@/src/server/repos/sessions", () => ({
  nextEventSeq: async () => inserted.length + 1,
  insertSessionEvent: async (_s: unknown, params: { kind: string; actor: string; payload: Record<string, unknown> }) => {
    inserted.push(params);
    return { id: `ev-${inserted.length}` };
  },
  listSketchAppearancesByName: async () => sketchAppearances,
}));
vi.mock("@/src/server/services/sceneGeneration", () => ({ generateForScene: async () => generateResult }));
vi.mock("@/src/server/services/promotion", () => ({
  promoteToEntity: async (_s: unknown, params: { name: string; entityKind: string; blocks: { label: string; text: string }[] }) => {
    promoteCalls.push(params);
    return promoted;
  },
}));

const { drawSketchForScene, promoteSketch, recordSketchSpeechAndMaybeAnchor, anchorSketchesNamedInText } = await import("./sceneSketches");
const supabase = {} as SupabaseClient<Database>;
const base = { campaignId: "c", worldId: "w", sessionId: "s", callerId: "u" };

beforeEach(() => {
  scene = emptyScene("ancre-rouillee");
  putCalls.length = 0;
  inserted.length = 0;
  sketchAppearances = [];
  promoteCalls.length = 0;
  generateResult = {
    sections: [
      { key: "pnj-nom", label: "Nom", text: "Grelin", slots: [] },
      { key: "pnj-apparence", label: "Apparence", text: "une cicatrice au menton", slots: [] },
    ],
  };
  promoted = { ok: true, entity: { id: "entity-grelin", slug: "grelin" } };
});

describe("drawSketchForScene", () => {
  it("tire un nom et un trait, jamais inventes par l'appelant", async () => {
    const result = await drawSketchForScene(supabase, base);
    if (!result.ok || result.anchored) throw new Error("tirage attendu, sans ancrage");
    expect(result.sketch.name).toBe("Grelin");
    expect(result.sketch.trait).toBe("une cicatrice au menton");
    expect(result.sketch.locationId).toBe("ancre-rouillee");
    expect(scene!.sketches).toHaveLength(1);
  });

  it("journalise un world_update source 'sketch', avec le lieu", async () => {
    await drawSketchForScene(supabase, base);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].kind).toBe("world_update");
    expect(inserted[0].payload.source).toBe("sketch");
    expect(inserted[0].payload.name).toBe("Grelin");
    expect(inserted[0].payload.location_id).toBe("ancre-rouillee");
  });

  it("le tirage echoue (aucun outil MJ) : aucune esquisse, rien journalise", async () => {
    generateResult = { error: "no_generators" };
    const result = await drawSketchForScene(supabase, base);
    expect(result).toEqual({ ok: false, reason: "no_generators" });
    expect(inserted).toHaveLength(0);
  });

  it("un nom deja vu dans un AUTRE lieu ancre immediatement, sans esquisse", async () => {
    sketchAppearances = [{ locationId: "les-quais" }];
    const result = await drawSketchForScene(supabase, base);
    if (!result.ok || !result.anchored) throw new Error("ancrage immediat attendu");
    expect(result.entity.id).toBe("entity-grelin");
    expect(scene!.sketches).toHaveLength(0);
    expect(scene!.present.map((p) => p.entityId)).toEqual(["entity-grelin"]);
    expect(inserted[0].payload.source).toBe("anchor");
  });

  it("un nom deja vu dans le MEME lieu ne declenche pas l'ancrage precoce", async () => {
    sketchAppearances = [{ locationId: "ancre-rouillee" }];
    const result = await drawSketchForScene(supabase, base);
    if (!result.ok || result.anchored) throw new Error("simple tirage attendu");
    expect(scene!.sketches).toHaveLength(1);
  });
});

describe("promoteSketch", () => {
  it("cree une entite, retire l'esquisse, l'ajoute aux presents reels", async () => {
    scene = addSketch(scene!, { id: "sk-1", name: "Grelin", trait: "cicatrice", zone: "near", disposition: "mefiant", timesSpoken: 2, locationId: "ancre-rouillee" });
    const result = await promoteSketch(supabase, { ...base, sketchId: "sk-1" });
    if (!result.ok) throw new Error("promotion attendue");
    expect(promoteCalls[0]).toMatchObject({ name: "Grelin", entityKind: "character", blocks: [{ label: "Description", text: "cicatrice" }] });
    expect(scene!.sketches).toHaveLength(0);
    expect(scene!.present).toEqual([{ entityId: "entity-grelin", zone: "near", disposition: "mefiant" }]);
  });

  it("esquisse introuvable : ne cree rien", async () => {
    const result = await promoteSketch(supabase, { ...base, sketchId: "inconnue" });
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(promoteCalls).toHaveLength(0);
  });
});

describe("recordSketchSpeechAndMaybeAnchor — s'ancre au-dela de trois repliques", () => {
  it("compte sans ancrer avant le seuil", async () => {
    scene = addSketch(scene!, { id: "sk-1", name: "Grelin", trait: "cicatrice", zone: "near", timesSpoken: 1, locationId: "ancre-rouillee" });
    await recordSketchSpeechAndMaybeAnchor(supabase, { ...base, sketchId: "sk-1" });
    expect(scene!.sketches[0].timesSpoken).toBe(2);
    expect(promoteCalls).toHaveLength(0);
  });

  it("ancre a la replique qui depasse le seuil", async () => {
    scene = addSketch(scene!, { id: "sk-1", name: "Grelin", trait: "cicatrice", zone: "near", timesSpoken: 3, locationId: "ancre-rouillee" });
    await recordSketchSpeechAndMaybeAnchor(supabase, { ...base, sketchId: "sk-1" });
    expect(promoteCalls).toHaveLength(1);
  });

  it("esquisse deja disparue : ne fait rien, ne leve pas", async () => {
    await expect(recordSketchSpeechAndMaybeAnchor(supabase, { ...base, sketchId: "fantome" })).resolves.toBeUndefined();
    expect(promoteCalls).toHaveLength(0);
  });
});

describe("anchorSketchesNamedInText — nomme explicitement", () => {
  it("ancre l'esquisse dont le nom est repris, mot entier", async () => {
    scene = addSketch(scene!, { id: "sk-1", name: "Grelin", trait: "cicatrice", zone: "near", timesSpoken: 0, locationId: "ancre-rouillee" });
    await anchorSketchesNamedInText(supabase, { ...base, text: "je demande son nom à Grelin" });
    expect(promoteCalls).toHaveLength(1);
  });

  it("un texte qui ne le nomme pas n'ancre rien", async () => {
    scene = addSketch(scene!, { id: "sk-1", name: "Grelin", trait: "cicatrice", zone: "near", timesSpoken: 0, locationId: "ancre-rouillee" });
    await anchorSketchesNamedInText(supabase, { ...base, text: "je regarde autour de moi" });
    expect(promoteCalls).toHaveLength(0);
  });
});
