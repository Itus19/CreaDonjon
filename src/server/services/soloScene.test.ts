import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { emptyScene, type SceneState } from "@/src/core/rules/scene";

/**
 * V3-C6 — Même méthode que `sceneSketches.test.ts` : le vrai moteur de scène
 * tourne réellement, seuls les accès base et le tirage du générateur sont
 * simulés. Ce qui se vérifie ici : la météo ne se tire QUE quand le lieu
 * change vraiment, jamais à chaque « présents » retouché sur la même scène.
 */

let scene: SceneState | null;
let generateResult: { sections: { key: string; label: string; text: string; slots: [] }[] } | { error: string };
const discoverCalls: { entityId: string; level: string }[] = [];

vi.mock("@/src/server/repos/sceneStates", () => ({
  getSceneState: async () => scene,
  putSceneState: async (_s: unknown, params: { state: SceneState }) => {
    scene = params.state;
  },
}));
vi.mock("@/src/server/repos/combats", () => ({ listCombatsForCampaign: async () => [] }));
vi.mock("@/src/server/repos/relations", () => ({ listPartOfRelationsForWorld: async () => [] }));
vi.mock("@/src/server/repos/entities", () => ({ listEntitiesByIds: async () => [], listEntitiesByKinds: async () => [] }));
vi.mock("@/src/server/services/discoveries", () => ({
  discoverEntity: async (_s: unknown, params: { entityId: string; level: string }) => {
    discoverCalls.push({ entityId: params.entityId, level: params.level });
  },
}));
const seenLocationIdAtDraw: (string | undefined)[] = [];
vi.mock("@/src/server/services/sceneGeneration", () => ({
  generateForScene: async () => {
    // Le vrai `generateForScene` relit `scene_states` lui-meme pour resoudre
    // ses axes (V3-C1) — ce mock lit la MEME source simulee, pour prouver
    // que le nouveau lieu y est deja quand le tirage a lieu (V3-C6).
    seenLocationIdAtDraw.push(scene?.locationId);
    return generateResult;
  },
}));

const { setScene } = await import("./soloScene");
const supabase = {} as SupabaseClient<Database>;
const base = { campaignId: "c", worldId: "w", callerId: "u" };

beforeEach(() => {
  scene = null;
  discoverCalls.length = 0;
  seenLocationIdAtDraw.length = 0;
  generateResult = { sections: [{ key: "meteo-condition", label: "Condition", text: "Pluie battante", slots: [] }] };
});

describe("setScene — la météo (V3-C6)", () => {
  it("premiere scene jamais posee : tire une meteo", async () => {
    const out = await setScene(supabase, { ...base, locationId: "ancre-rouillee", present: [] });
    expect(out.weather).toBe("Pluie battante");
  });

  it("meme lieu resauvegarde (presents retouches) : ne retire pas de meteo", async () => {
    await setScene(supabase, { ...base, locationId: "ancre-rouillee", present: [] });
    generateResult = { sections: [{ key: "meteo-condition", label: "Condition", text: "Ciel degage", slots: [] }] };
    const out = await setScene(supabase, { ...base, locationId: "ancre-rouillee", present: ["bram"] });
    expect(out.weather).toBe("Pluie battante"); // pas "Ciel degage" : aucun second tirage
  });

  it("changement de lieu : tire une meteo fraiche", async () => {
    await setScene(supabase, { ...base, locationId: "ancre-rouillee", present: [] });
    generateResult = { sections: [{ key: "meteo-condition", label: "Condition", text: "Ciel degage", slots: [] }] };
    const out = await setScene(supabase, { ...base, locationId: "les-quais", present: [] });
    expect(out.weather).toBe("Ciel degage");
  });

  it("le tirage voit deja le NOUVEAU lieu, jamais l'ancien (ordre d'ecriture)", async () => {
    await setScene(supabase, { ...base, locationId: "ancre-rouillee", present: [] });
    await setScene(supabase, { ...base, locationId: "les-quais", present: [] });
    // Un seul tirage par appel avec changement de lieu ; le second doit voir "les-quais", jamais "ancre-rouillee".
    expect(seenLocationIdAtDraw.at(-1)).toBe("les-quais");
  });

  it("le tirage echoue (aucun outil MJ) : la meteo reste absente, sans lever", async () => {
    generateResult = { error: "no_generators" };
    const out = await setScene(supabase, { ...base, locationId: "ancre-rouillee", present: [] });
    expect(out.weather).toBeNull();
  });
});

describe("setScene — reutilise emptyScene, jamais un second etat par defaut", () => {
  it("une scene neuve porte les valeurs de emptyScene, meteo comprise", async () => {
    generateResult = { error: "no_generators" };
    const out = await setScene(supabase, { ...base, locationId: "ancre-rouillee", present: [] });
    const expected = emptyScene("ancre-rouillee");
    expect(out.time).toEqual(expected.time);
    expect(out.lighting).toBe(expected.lighting);
  });
});
