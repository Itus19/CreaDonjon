import { describe, expect, it } from "vitest";
import { stateNeighbors, zAbstractWorld } from "./world";
import { MONDE_ESSAI } from "./history/mondeEssai";

describe("zAbstractWorld", () => {
  it("accepte le monde de test", () => {
    expect(() => zAbstractWorld.parse(MONDE_ESSAI)).not.toThrow();
  });

  it("refuse deux villes de même identifiant", () => {
    const sites = [...MONDE_ESSAI.sites, MONDE_ESSAI.sites[0]];
    expect(() => zAbstractWorld.parse({ ...MONDE_ESSAI, sites })).toThrow();
  });

  it("refuse un lien vers une ville inconnue", () => {
    const links = [...MONDE_ESSAI.links, { a: "v-hornver", b: "v-nulle-part", distanceKm: 10, kind: "road" }];
    expect(() => zAbstractWorld.parse({ ...MONDE_ESSAI, links })).toThrow();
  });

  it("refuse un État dont la capitale n'est pas une de ses villes", () => {
    const states = [{ ...MONDE_ESSAI.states[0], capitalSiteId: "v-ostral" }, MONDE_ESSAI.states[1]];
    expect(() => zAbstractWorld.parse({ ...MONDE_ESSAI, states })).toThrow();
  });

  it("refuse une ville rattachée à un État inconnu", () => {
    const sites = MONDE_ESSAI.sites.map((s) => (s.id === "v-berton" ? { ...s, stateId: "s-fantome" } : s));
    expect(() => zAbstractWorld.parse({ ...MONDE_ESSAI, sites })).toThrow();
  });

  it("refuse une guerre imposée qui commence après le présent ou nomme un État inconnu", () => {
    const tard = [{ ...MONDE_ESSAI.anchors[0], startYear: 400, endYear: null }];
    expect(() => zAbstractWorld.parse({ ...MONDE_ESSAI, anchors: tard })).toThrow();
    const inconnu = [{ ...MONDE_ESSAI.anchors[0], attackers: ["s-fantome"] }];
    expect(() => zAbstractWorld.parse({ ...MONDE_ESSAI, anchors: inconnu })).toThrow();
  });
});

describe("stateNeighbors", () => {
  it("relie deux États dont des villes sont reliées, et ignore les villes libres", () => {
    const voisins = stateNeighbors(MONDE_ESSAI);
    expect([...(voisins.get("s-grania") ?? [])]).toEqual(["s-vriia"]);
    expect([...(voisins.get("s-vriia") ?? [])]).toEqual(["s-grania"]);
  });
});
