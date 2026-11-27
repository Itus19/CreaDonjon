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
const proposalsInserted: { kind: string; targetEntityId: string | null; status: string; autoApplied: boolean; sessionEventId: string | null }[] = [];

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
vi.mock("@/src/server/repos/aiProposals", () => ({
  insertAiProposal: async (
    _s: unknown,
    params: { kind: string; targetEntityId: string | null; status: string; autoApplied?: boolean; sessionEventId?: string | null }
  ) => {
    proposalsInserted.push({
      kind: params.kind,
      targetEntityId: params.targetEntityId,
      status: params.status,
      autoApplied: params.autoApplied ?? false,
      sessionEventId: params.sessionEventId ?? null,
    });
    return { id: `prop-${proposalsInserted.length}` };
  },
}));
vi.mock("@/src/server/services/discoveries", () => ({ discoverEntity: async () => {} }));
vi.mock("@/src/server/services/sceneGeneration", () => ({ generateForScene: async () => generateResult }));
vi.mock("@/src/server/services/promotion", () => ({
  promoteToEntity: async (_s: unknown, params: { name: string; entityKind: string; blocks: { label: string; text: string }[] }) => {
    promoteCalls.push(params);
    return promoted;
  },
}));

const trueNames: { entityId: string; trueName: string }[] = [];
const relationsInserted: { relationType: string; targetEntityId: string; metadata?: unknown }[] = [];
let isAdmin = true;
vi.mock("@/src/server/repos/entityTrueNames", () => ({
  upsertTrueName: async (_s: unknown, params: { entityId: string; secret: { trueName: string } }) => {
    trueNames.push({ entityId: params.entityId, trueName: params.secret.trueName });
  },
}));
vi.mock("@/src/server/repos/relations", () => ({
  insertRelation: async (_s: unknown, params: { relationType: string; targetEntityId: string; metadata?: unknown }) => {
    relationsInserted.push(params);
    return { ok: true };
  },
}));
vi.mock("@/src/server/services/permissions", () => ({ isWorldAdmin: async () => isAdmin }));
const npcSheets: { entityId: string; archetype?: string; seed: number }[] = [];
vi.mock("@/src/server/services/npcSheet", () => ({
  giveNpcSheet: async (_s: unknown, params: { entityId: string; archetype?: string; seed: number }) => {
    npcSheets.push({ entityId: params.entityId, ...(params.archetype !== undefined ? { archetype: params.archetype } : {}), seed: params.seed });
    return { ok: true, templateKey: "commoner", fallback: params.archetype === undefined };
  },
  giveNpcGear: async (_s: unknown, params: { entityId: string; wealth: string }) => {
    npcGears.push({ entityId: params.entityId, wealth: params.wealth });
    return { ok: true };
  },
  DEFAULT_NPC_WEALTH: "correcte",
}));
const npcGears: { entityId: string; wealth: string }[] = [];

const { drawSketchForScene, promoteSketch, recordSketchSpeechAndMaybeAnchor, anchorSketchesNamedInText } = await import("./sceneSketches");
const supabase = {} as SupabaseClient<Database>;
const base = { campaignId: "c", worldId: "w", sessionId: "s", callerId: "u" };

beforeEach(() => {
  scene = emptyScene("ancre-rouillee");
  putCalls.length = 0;
  inserted.length = 0;
  sketchAppearances = [];
  promoteCalls.length = 0;
  proposalsInserted.length = 0;
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

  it("V3-C3 — une simple esquisse ne cree AUCUNE proposition : aucune entite a referencer encore", async () => {
    await drawSketchForScene(supabase, base);
    expect(proposalsInserted).toHaveLength(0);
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
    expect(proposalsInserted).toEqual([
      { kind: "create_entity", targetEntityId: "entity-grelin", status: "applied", autoApplied: true, sessionEventId: "ev-1" },
    ]);
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
    expect(proposalsInserted).toEqual([
      { kind: "create_entity", targetEntityId: "entity-grelin", status: "applied", autoApplied: true, sessionEventId: "ev-1" },
    ]);
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

describe("ancrer une personne calculée (V3.2-45)", () => {
  async function aubergeAvecVie() {
    const { poserLaVie } = await import("@/src/core/rules/sceneLife");
    const settlement = { __v: 1 as const, seed: 3, population: 8000, zone: "ville" as const, wealth: "correcte" as const, biome: "temperate_deciduous_forest" as const, peoples: [], trades: [] };
    scene = poserLaVie({ ...emptyScene("chaudron"), time: { day: 4, hour: 14, minute: 0 } }, { placeType: "inn", settlement, workers: [] });
    return scene.sketches.find((s) => s.name.startsWith("aubergiste"))!;
  }

  beforeEach(() => {
    trueNames.length = 0;
    relationsInserted.length = 0;
    isAdmin = true;
    promoted = { ok: true, entity: { id: "e-aubergiste", slug: "1" } };
    generateResult = { sections: [{ key: "pnj-nom", label: "Nom", text: "Mabelle Roux", slots: [] }] };
  });

  it("la fiche garde le libellé, le vrai nom tiré part en secret, et un lien works_at garde sa graine", async () => {
    const aubergiste = await aubergeAvecVie();
    await promoteSketch(supabase, { ...base, sketchId: aubergiste.id });
    expect(promoteCalls.at(-1)?.name).toBe(aubergiste.name);
    expect(trueNames).toEqual([{ entityId: "e-aubergiste", trueName: "Mabelle Roux" }]);
    expect(relationsInserted).toMatchObject([{ relationType: "works_at", targetEntityId: "chaudron", metadata: { seed: Number(aubergiste.id.slice(5)) } }]);
    expect(scene?.life?.workers).toContainEqual({ entityId: "e-aubergiste", seed: Number(aubergiste.id.slice(5)) });
  });

  it("V3.2-47 — la personne ancrée reçoit sa fiche allégée, d'après son archétype et sa graine", async () => {
    const aubergiste = await aubergeAvecVie();
    await promoteSketch(supabase, { ...base, sketchId: aubergiste.id });
    const fiche = npcSheets.at(-1);
    expect(fiche).toMatchObject({ entityId: "e-aubergiste", seed: Number(aubergiste.id.slice(5)) });
    expect(fiche?.archetype).toBeDefined();
    // V3.2-48 : son équipement aussi, à la richesse de la ville du lieu.
    expect(npcGears.at(-1)?.entityId).toBe("e-aubergiste");
  });

  it("sans droit de MJ, pas de vrai nom : la fiche garde son libellé", async () => {
    isAdmin = false;
    const aubergiste = await aubergeAvecVie();
    await promoteSketch(supabase, { ...base, sketchId: aubergiste.id });
    expect(trueNames).toEqual([]);
  });

  it("une esquisse tirée à la main ne reçoit ni vrai nom ni lien", async () => {
    scene = addSketch(emptyScene("ancre-rouillee"), { id: "sk-1", name: "Wil", trait: "roux", zone: "near", timesSpoken: 0, locationId: "ancre-rouillee" });
    await promoteSketch(supabase, { ...base, sketchId: "sk-1" });
    expect(trueNames).toEqual([]);
    expect(relationsInserted).toEqual([]);
    // V3.2-47 : une fiche quand même, de Roturier (pas d'archétype), à graine dérivée de l'esquisse.
    expect(npcSheets.at(-1)).toMatchObject({ seed: expect.any(Number) });
    expect(npcSheets.at(-1)?.archetype).toBeUndefined();
  });
});
