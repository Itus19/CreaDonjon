import { describe, expect, it } from "vitest";
import { advanceSceneTime, emptyScene, enterScene, type SceneState } from "./scene";
import { marquerDites, nouvellesNonDites, poserLaVie, rafraichirLaVie } from "./sceneLife";
import { esquissesIci, presentsIci } from "./scenePresence";
import type { SettlementBlockData } from "../schemas/blocks/settlement";

const ville: SettlementBlockData = { __v: 1, seed: 99, population: 8000, zone: "ville", wealth: "correcte", biome: "temperate_deciduous_forest", peoples: [], trades: [] };
const AUBERGE = "auberge";

function aLAuberge(hour: number, workers: { entityId: string }[] = []): SceneState {
  let scene = emptyScene(AUBERGE, { day: 10, hour, minute: 0 });
  scene = enterScene(scene, { entityId: "pj", zone: "near" });
  return poserLaVie(scene, { placeType: "inn", settlement: ville, workers });
}

const calcules = (scene: SceneState) => [...scene.sketches.map((s) => s.id), ...scene.present.map((p) => p.entityId)].filter((id) => id !== "pj").sort();

describe("la vie du lieu dans la scène (V3.2-31)", () => {
  it("poser la vie fait entrer ceux qui sont là à cette heure, sans nouvelle", () => {
    const scene = aLAuberge(20);
    expect(scene.sketches.length).toBeGreaterThan(0);
    expect(scene.sketches.every((s) => s.id.startsWith("calc-") && s.locationId === AUBERGE)).toBe(true);
    expect(nouvellesNonDites(scene)).toEqual([]);
    expect(scene.life?.computed.length).toBe(scene.sketches.length);
  });

  it("le même lieu à la même heure donne toujours les mêmes gens", () => {
    expect(calcules(aLAuberge(20))).toEqual(calcules(aLAuberge(20)));
  });

  it("dormir dix heures : le hall du matin n'a pas les mêmes gens que celui du soir", () => {
    const soir = aLAuberge(20);
    const matin = advanceSceneTime(soir, 10 * 60);
    expect(matin.time).toMatchObject({ day: 11, hour: 6 });
    expect(calcules(matin)).not.toEqual(calcules(soir));
    expect(calcules(matin)).toEqual(calcules(aLAuberge(6)).length === 0 ? [] : calcules(matin));
  });

  it("avancer l'heure produit des nouvelles pour ce que le personnage voit changer", () => {
    const soir = aLAuberge(20);
    const nuit = advanceSceneTime(soir, 7 * 60);
    const nouvelles = nouvellesNonDites(nuit);
    expect(nouvelles.length).toBeGreaterThan(0);
    for (const n of nouvelles.filter((x) => x.change === "leave")) expect(soir.sketches.some((s) => s.id === n.id)).toBe(true);
    for (const n of nouvelles.filter((x) => x.change === "arrive")) expect(esquissesIci(nuit).some((s) => s.id === n.id)).toBe(true);
    expect(nouvelles.every((n) => n.name !== null)).toBe(true);
  });

  it("marquer dites vide la liste des nouvelles à raconter", () => {
    const nuit = advanceSceneTime(aLAuberge(20), 7 * 60);
    expect(nouvellesNonDites(marquerDites(nuit))).toEqual([]);
  });

  it("quelqu'un ajouté à la main n'est jamais retiré par le moteur", () => {
    let scene = aLAuberge(20);
    scene = enterScene(scene, { entityId: "sergent", zone: "far" });
    scene = advanceSceneTime(scene, 30 * 60);
    expect(scene.present.some((p) => p.entityId === "sergent")).toBe(true);
  });

  it("un PNJ du wiki qui travaille là entre comme présent, à la place de l'aubergiste tiré", () => {
    const scene = aLAuberge(14, [{ entityId: "mabelle" }]);
    expect(presentsIci(scene).map((p) => p.entityId)).toContain("mabelle");
    expect(scene.sketches.some((s) => s.name.startsWith("aubergiste"))).toBe(false);
  });

  it("dans sa chambre, le personnage ne voit pas le hall bouger", () => {
    let scene = aLAuberge(20);
    scene = { ...scene, room: { locationId: AUBERGE, name: "ma chambre", description: "", anchored: false }, present: scene.present.map((p) => ({ ...p, room: p.entityId === "pj" ? "ma chambre" : null })), sketches: scene.sketches.map((s) => ({ ...s, room: s.room ?? null })) };
    const apres = advanceSceneTime(scene, 10 * 60);
    expect(nouvellesNonDites(apres)).toEqual([]);
    expect(presentsIci(apres).map((p) => p.entityId)).toEqual(["pj"]);
    expect(esquissesIci(apres)).toEqual([]);
  });

  it("rien ne bouge en combat, ni pour un autre lieu, ni sans vie", () => {
    const scene = aLAuberge(20);
    expect(rafraichirLaVie({ ...scene, activeCombatId: "c1", time: { day: 11, hour: 8, minute: 0 } }).sketches).toEqual(scene.sketches);
    expect(rafraichirLaVie({ ...scene, locationId: "ailleurs", time: { day: 11, hour: 8, minute: 0 } }).sketches).toEqual(scene.sketches);
    const sans = emptyScene(AUBERGE);
    expect(advanceSceneTime(sans, 600).sketches).toEqual([]);
  });

  it("sans type de lieu, poser la vie la retire", () => {
    const scene = aLAuberge(20);
    expect(poserLaVie(scene, null).life).toBeUndefined();
  });
});
