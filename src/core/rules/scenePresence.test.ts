import { describe, expect, it } from "vitest";
import { addSketch, emptyScene, enterScene, type SceneSketch, type SceneState } from "./scene";
import { changerDePiece, pieceCourante, presentsAilleurs, presentsIci, ramenerIci, esquissesAilleurs, esquissesIci, oublierLesPieces } from "./scenePresence";

const LIEU = "auberge";
const sketch = (id: string, room?: string | null): SceneSketch => ({
  id,
  name: id,
  trait: "trait",
  zone: "near",
  timesSpoken: 0,
  locationId: LIEU,
  ...(room !== undefined ? { room } : {}),
});

function dansLeHall(): SceneState {
  let scene = emptyScene(LIEU);
  scene = enterScene(scene, { entityId: "pj", zone: "near" });
  scene = enterScene(scene, { entityId: "mabelle", zone: "near" });
  scene = enterScene(scene, { entityId: "sergent", zone: "far" });
  return addSketch(scene, sketch("garcon"));
}

describe("presence par piece (V3.2-28)", () => {
  it("sans piece, tout le monde est la", () => {
    const scene = dansLeHall();
    expect(pieceCourante(scene)).toBeNull();
    expect(presentsIci(scene).map((p) => p.entityId)).toEqual(["pj", "mabelle", "sergent"]);
    expect(esquissesIci(scene).map((s) => s.id)).toEqual(["garcon"]);
    expect(presentsAilleurs(scene)).toEqual([]);
  });

  it("une ancienne scene sans piece par personne garde tout le monde avec le personnage", () => {
    const scene: SceneState = { ...dansLeHall(), room: { locationId: LIEU, name: "le hall", description: "", anchored: true } };
    expect(presentsIci(scene)).toHaveLength(3);
  });

  it("entrer seul dans sa chambre laisse les autres dans le hall", () => {
    const scene = changerDePiece(dansLeHall(), { avant: null, apres: "la chambre", suivent: ["pj"] });
    const dans = { ...scene, room: { locationId: LIEU, name: "la chambre", description: "", anchored: false } };
    expect(presentsIci(dans).map((p) => p.entityId)).toEqual(["pj"]);
    expect(esquissesIci(dans)).toEqual([]);
    expect(presentsAilleurs(dans).map((p) => [p.entityId, p.room])).toEqual([
      ["mabelle", null],
      ["sergent", null],
    ]);
    expect(esquissesAilleurs(dans).map((s) => s.id)).toEqual(["garcon"]);
  });

  it("ceux qui suivent entrent avec le personnage, esquisses comprises", () => {
    const scene = changerDePiece(dansLeHall(), { avant: null, apres: "la cuisine", suivent: ["pj", "mabelle", "garcon"] });
    const dans = { ...scene, room: { locationId: LIEU, name: "la cuisine", description: "", anchored: true } };
    expect(presentsIci(dans).map((p) => p.entityId)).toEqual(["pj", "mabelle"]);
    expect(esquissesIci(dans).map((s) => s.id)).toEqual(["garcon"]);
  });

  it("ressortir fait retrouver ceux de l'espace principal", () => {
    let scene = changerDePiece(dansLeHall(), { avant: null, apres: "la chambre", suivent: ["pj"] });
    scene = { ...scene, room: { locationId: LIEU, name: "la chambre", description: "", anchored: false } };
    scene = changerDePiece(scene, { avant: "la chambre", apres: null, suivent: ["pj"] });
    scene = { ...scene, room: null };
    expect(presentsIci(scene).map((p) => p.entityId)).toEqual(["pj", "mabelle", "sergent"]);
  });

  it("une personne entree dans la scene arrive dans la piece du personnage", () => {
    let scene = changerDePiece(dansLeHall(), { avant: null, apres: "la chambre", suivent: ["pj"] });
    scene = { ...scene, room: { locationId: LIEU, name: "la chambre", description: "", anchored: false } };
    scene = enterScene(scene, { entityId: "servante", zone: "near" });
    scene = addSketch(scene, sketch("chat"));
    expect(presentsIci(scene).map((p) => p.entityId)).toEqual(["pj", "servante"]);
    expect(esquissesIci(scene).map((s) => s.id)).toEqual(["chat"]);
  });

  it("ramener ici fait venir quelqu'un d'une autre piece", () => {
    let scene = changerDePiece(dansLeHall(), { avant: null, apres: "la chambre", suivent: ["pj"] });
    scene = { ...scene, room: { locationId: LIEU, name: "la chambre", description: "", anchored: false } };
    scene = ramenerIci(scene, ["mabelle"]);
    expect(presentsIci(scene).map((p) => p.entityId)).toEqual(["pj", "mabelle"]);
  });

  it("changer de lieu oublie les pieces de chacun", () => {
    let scene = changerDePiece(dansLeHall(), { avant: null, apres: "la chambre", suivent: ["pj"] });
    scene = oublierLesPieces({ ...scene, room: null });
    expect(scene.present.every((p) => p.room === undefined)).toBe(true);
    expect(presentsIci(scene)).toHaveLength(3);
  });
});
