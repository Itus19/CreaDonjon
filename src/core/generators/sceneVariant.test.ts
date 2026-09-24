import { describe, expect, it } from "vitest";
import { SeededRng, type Rng } from "../dice/rng";
import type { GeneratorVariantAxis } from "./variants";
import { resolveSceneVariant, sceneTableKey } from "./sceneVariant";

const WEALTH: GeneratorVariantAxis = {
  key: "wealth",
  label: "Richesse",
  allowRandom: true,
  options: [
    { key: "modeste", label: "Modeste" },
    { key: "correcte", label: "Correcte" },
    { key: "reputee", label: "Réputée" },
  ],
};
const ZONE: GeneratorVariantAxis = {
  key: "zone",
  label: "Zone",
  options: [
    { key: "bourg", label: "Bourg" },
    { key: "ville", label: "Ville" },
    { key: "capitale", label: "Capitale" },
  ],
};
const TYPE: GeneratorVariantAxis = {
  key: "type",
  label: "Type",
  options: [
    { key: "forgeron", label: "Forgeron" },
    { key: "bazar", label: "Bazar" },
  ],
};

/** Un Rng qui echoue au premier appel : prouve qu'aucun tirage n'a eu lieu. */
const NO_DRAW: Rng = {
  nextInt: () => {
    throw new Error("aucun tirage attendu");
  },
};

describe("resolveSceneVariant", () => {
  it("lit la richesse et la zone dans l'infobox du lieu, sans tirer", () => {
    const place = [
      { label: "Richesse", value: "Réputée" },
      { label: "Zone", value: "capitale" },
    ];
    const resolved = resolveSceneVariant([WEALTH, ZONE], [place], {}, NO_DRAW);
    expect(resolved.wealth).toEqual({ key: "reputee", label: "Réputée", source: "location" });
    expect(resolved.zone).toEqual({ key: "capitale", label: "Capitale", source: "location" });
  });

  it("accepte le nom technique de l'axe, sans casse ni accents", () => {
    const place = [{ label: "  WEALTH ", value: "reputee" }];
    expect(resolveSceneVariant([WEALTH], [place], {}, NO_DRAW).wealth.key).toBe("reputee");
  });

  it("remonte au parent part_of quand le lieu ne dit rien", () => {
    const tavern = [{ label: "Ambiance", value: "enfumée" }];
    const city = [{ label: "Zone", value: "Ville" }];
    const resolved = resolveSceneVariant([ZONE], [tavern, city], {}, NO_DRAW);
    expect(resolved.zone).toEqual({ key: "ville", label: "Ville", source: "parent" });
  });

  it("le lieu passe devant son parent", () => {
    const tavern = [{ label: "Zone", value: "Bourg" }];
    const city = [{ label: "Zone", value: "Capitale" }];
    expect(resolveSceneVariant([ZONE], [tavern, city], {}, NO_DRAW).zone.key).toBe("bourg");
  });

  it("tire l'axe par le RNG quand aucun lieu ne le porte", () => {
    const resolved = resolveSceneVariant([WEALTH], [[]], {}, new SeededRng(1));
    expect(WEALTH.options.map((o) => o.key)).toContain(resolved.wealth.key);
    expect(resolved.wealth.source).toBe("random");
  });

  it("une valeur inconnue sur le lieu ne remonte pas au parent : elle est tiree", () => {
    const tavern = [{ label: "Richesse", value: "opulente" }];
    const city = [{ label: "Richesse", value: "Modeste" }];
    const resolved = resolveSceneVariant([WEALTH], [tavern, city], {}, new SeededRng(7));
    expect(resolved.wealth.source).toBe("random");
  });

  it("ignore un choix de l'appelant sur un axe qui vient du lieu", () => {
    const place = [{ label: "Richesse", value: "Modeste" }];
    const resolved = resolveSceneVariant([WEALTH], [place], { wealth: "reputee" }, NO_DRAW);
    expect(resolved.wealth.key).toBe("modeste");
  });

  it("prend le choix de l'appelant pour un axe hors lieu, s'il est une option connue", () => {
    const resolved = resolveSceneVariant([TYPE], [[]], { type: "bazar" }, NO_DRAW);
    expect(resolved.type).toEqual({ key: "bazar", label: "Bazar", source: "caller" });
  });

  it("tire un axe hors lieu dont le choix est absent ou inconnu", () => {
    const resolved = resolveSceneVariant([TYPE], [[]], { type: "banque" }, new SeededRng(3));
    expect(resolved.type.source).toBe("random");
    expect(TYPE.options.map((o) => o.key)).toContain(resolved.type.key);
  });

  it("est rejouable : meme graine, meme resultat", () => {
    const a = resolveSceneVariant([WEALTH, ZONE, TYPE], [[]], {}, new SeededRng(42));
    const b = resolveSceneVariant([WEALTH, ZONE, TYPE], [[]], {}, new SeededRng(42));
    expect(a).toEqual(b);
  });
});

describe("sceneTableKey", () => {
  it("interpole l'axe et ses voisins, comme le tirage", () => {
    const resolved = resolveSceneVariant([WEALTH, TYPE], [[{ label: "Richesse", value: "Modeste" }]], { type: "forgeron" }, NO_DRAW);
    expect(sceneTableKey("objets-{type}", [WEALTH, TYPE], resolved)).toBe("objets-forgeron");
    expect(sceneTableKey("menu-{wealth_below}", [WEALTH, TYPE], resolved)).toBe("menu-modeste");
    expect(sceneTableKey("menu-{wealth_above}", [WEALTH, TYPE], resolved)).toBe("menu-correcte");
  });
});
