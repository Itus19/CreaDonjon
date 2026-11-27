import { describe, expect, it } from "vitest";
import { sitesWithinKm, sitesToReveal } from "./reveal";
import { MONDE_ESSAI } from "./history/mondeEssai";

// Liens du monde d'essai : Hornver –60– Berton –85– Pellemont –40– Ostral –70– Gué-Salé
describe("sitesWithinKm", () => {
  it("mesure la distance par les liens, la ville de départ à 0", () => {
    expect(sitesWithinKm(MONDE_ESSAI, "v-pellemont", 100)).toEqual([
      { siteId: "v-pellemont", km: 0 },
      { siteId: "v-ostral", km: 40 },
      { siteId: "v-berton", km: 85 },
    ]);
  });

  it("additionne les tronçons d'un chemin et prend le plus court", () => {
    const loin = sitesWithinKm(MONDE_ESSAI, "v-hornver", 1000);
    expect(loin.find((s) => s.siteId === "v-gue-sale")?.km).toBe(255);
    const raccourci = { ...MONDE_ESSAI, links: [...MONDE_ESSAI.links, { a: "v-hornver", b: "v-ostral", distanceKm: 100, kind: "sea" as const }] };
    expect(sitesWithinKm(raccourci, "v-hornver", 1000).find((s) => s.siteId === "v-gue-sale")?.km).toBe(170);
  });

  it("rend seulement la ville de départ quand le rayon est nul", () => {
    expect(sitesWithinKm(MONDE_ESSAI, "v-berton", 0)).toEqual([{ siteId: "v-berton", km: 0 }]);
  });

  it("refuse une ville inconnue ou un rayon négatif", () => {
    expect(() => sitesWithinKm(MONDE_ESSAI, "v-nulle-part", 10)).toThrow(RangeError);
    expect(() => sitesWithinKm(MONDE_ESSAI, "v-berton", -1)).toThrow(RangeError);
  });
});

describe("sitesToReveal", () => {
  it("écarte les villes qui ont déjà leur page et borne le nombre, les plus proches d'abord", () => {
    const placed = new Set(["v-ostral"]);
    expect(sitesToReveal(MONDE_ESSAI, "v-pellemont", { radiusKm: 200, placed, max: 2 })).toEqual(["v-pellemont", "v-berton"]);
  });
});
