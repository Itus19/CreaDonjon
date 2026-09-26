import { describe, expect, it } from "vitest";
import {
  DAY_MINUTES,
  SKETCH_SPOKEN_ANCHOR_THRESHOLD,
  addSketch,
  advanceTime,
  budgetOf,
  startTurn,
  dropSketchesOutsideLocation,
  emptyScene,
  enterScene,
  leaveScene,
  lightingAt,
  moveToZone,
  recordSketchSpoke,
  removeSketch,
  rememberEvent,
  sceneCalendarDate,
  sceneZoneOf,
  sketchShouldAnchorForSpeaking,
  textNamesSketch,
  zSceneState,
  type SceneSketch,
  type SceneState,
} from "./scene";
import { DEFAULT_CALENDAR } from "../calendar/defaultCalendar";
import type { CalendarConfig, GameDate } from "../calendar/types";

const SCENE: SceneState = {
  __v: 3,
  locationId: "ancre-rouillee",
  present: [
    { entityId: "bram", zone: "engaged" },
    { entityId: "grelin", zone: "near", disposition: "mefiant" },
  ],
  time: { day: 14, hour: 23, minute: 10 },
  lighting: "dim",
  activeCombatId: null,
  recentEvents: [],
  budgets: {},
  sketches: [],
};

const ELFE: SceneSketch = {
  id: "esquisse-1",
  name: "L'elfe taciturne",
  trait: "essuie des chopes sans lever les yeux",
  zone: "near",
  timesSpoken: 0,
  locationId: "ancre-rouillee",
};

describe("le temps avance parce que le CODE le fait avancer", () => {
  it("ajoute des minutes sans deborder l'heure", () => {
    expect(advanceTime(SCENE.time, 20)).toEqual({ day: 14, hour: 23, minute: 30 });
  });

  it("passe au jour suivant en franchissant minuit", () => {
    // 23h10 + 60 min = 00h10 le jour 15. C'est l'erreur que le modele fait
    // systematiquement (ADR 0009) : ici personne ne la fait, c'est arithmetique.
    expect(advanceTime(SCENE.time, 60)).toEqual({ day: 15, hour: 0, minute: 10 });
  });

  it("encaisse un repos long sans se perdre", () => {
    expect(advanceTime({ day: 1, hour: 22, minute: 0 }, 8 * 60)).toEqual({ day: 2, hour: 6, minute: 0 });
  });

  it("encaisse plusieurs jours d'un coup (voyage)", () => {
    expect(advanceTime({ day: 1, hour: 0, minute: 0 }, 3 * DAY_MINUTES + 90)).toEqual({
      day: 4,
      hour: 1,
      minute: 30,
    });
  });

  it("refuse de reculer : le temps de jeu ne remonte jamais", () => {
    expect(() => advanceTime(SCENE.time, -10)).toThrow();
  });

  it("zero minute est licite et ne change rien", () => {
    expect(advanceTime(SCENE.time, 0)).toEqual(SCENE.time);
  });
});

describe("l'eclairage suit l'heure, sauf quand la scene le fixe", () => {
  it("fait jour en milieu de journee, nuit au milieu de la nuit", () => {
    expect(lightingAt({ day: 1, hour: 12, minute: 0 })).toBe("bright");
    expect(lightingAt({ day: 1, hour: 2, minute: 0 })).toBe("dark");
  });

  it("le crepuscule et l'aube sont penombre", () => {
    expect(lightingAt({ day: 1, hour: 6, minute: 30 })).toBe("dim");
    expect(lightingAt({ day: 1, hour: 20, minute: 0 })).toBe("dim");
  });
});

describe("qui est present, et a quelle distance", () => {
  it("fait entrer quelqu'un, par defaut a portee de vue", () => {
    const out = enterScene(SCENE, { entityId: "ktar" });
    expect(sceneZoneOf(out, "ktar")).toBe("far");
  });

  it("ne fait pas entrer deux fois la meme entite", () => {
    const out = enterScene(enterScene(SCENE, { entityId: "ktar" }), { entityId: "ktar" });
    expect(out.present.filter((p) => p.entityId === "ktar")).toHaveLength(1);
  });

  it("fait sortir, et l'absent n'a plus de zone", () => {
    const out = leaveScene(SCENE, "grelin");
    expect(sceneZoneOf(out, "grelin")).toBeUndefined();
    expect(out.present.map((p) => p.entityId)).toEqual(["bram"]);
  });

  it("sortir quelqu'un d'absent ne change rien et ne leve pas", () => {
    expect(leaveScene(SCENE, "personne")).toEqual(SCENE);
  });

  it("rapproche et eloigne sans grille tactique", () => {
    expect(sceneZoneOf(moveToZone(SCENE, "grelin", "engaged"), "grelin")).toBe("engaged");
  });

  it("deplacer un absent est une faute, pas un silence", () => {
    // Sinon une regle viserait dans le vide en croyant avoir agi.
    expect(() => moveToZone(SCENE, "personne", "near")).toThrow(/personne/);
  });

  it("conserve la disposition quand on change la zone", () => {
    const out = moveToZone(SCENE, "grelin", "far");
    expect(out.present.find((p) => p.entityId === "grelin")?.disposition).toBe("mefiant");
  });
});

describe("les cinq derniers evenements, et pas six", () => {
  it("garde les cinq plus recents, le plus recent en tete", () => {
    let s = emptyScene("ancre-rouillee");
    for (const id of ["e1", "e2", "e3", "e4", "e5", "e6", "e7"]) s = rememberEvent(s, id);
    expect(s.recentEvents).toEqual(["e7", "e6", "e5", "e4", "e3"]);
  });
});

describe("le schema", () => {
  it("accepte une scene reelle", () => {
    expect(zSceneState.safeParse(SCENE).success).toBe(true);
  });

  it("accepte une esquisse", () => {
    expect(zSceneState.safeParse({ ...SCENE, sketches: [ELFE] }).success).toBe(true);
  });

  it("refuse une heure impossible", () => {
    expect(zSceneState.safeParse({ ...SCENE, time: { day: 1, hour: 24, minute: 0 } }).success).toBe(false);
    expect(zSceneState.safeParse({ ...SCENE, time: { day: 1, hour: 1, minute: 60 } }).success).toBe(false);
  });

  it("refuse une zone hors des trois", () => {
    expect(
      zSceneState.safeParse({ ...SCENE, present: [{ entityId: "x", zone: "adjacent" }] }).success,
    ).toBe(false);
  });

  it("refuse plus de cinq evenements recents", () => {
    expect(zSceneState.safeParse({ ...SCENE, recentEvents: ["1", "2", "3", "4", "5", "6"] }).success).toBe(false);
  });
});

describe("le budget de tour vit dans la scene (V3-B2)", () => {
  it("ouvre un tour neuf : action, bonus, reaction, et la vitesse en metres", () => {
    const scene = startTurn(SCENE, "bram", 9);
    expect(scene.budgets.bram).toEqual({ action: 1, bonus: 1, reaction: 1, movement: 9, free: 1 });
  });

  it("n'efface pas le budget des autres — une reaction deja depensee le reste", () => {
    const depense = { ...SCENE, budgets: { grelin: { action: 1, bonus: 1, reaction: 0, movement: 9, free: 1 } } };
    expect(startTurn(depense, "bram", 9).budgets.grelin.reaction).toBe(0);
  });

  it("rend un budget neuf a qui n'en a pas encore, sans rien ecrire", () => {
    expect(budgetOf(SCENE, "inconnu", 12).movement).toBe(12);
    expect(SCENE.budgets).toEqual({});
  });
});

describe("la date de la scene vient du calendrier du monde (V3-D2)", () => {
  const jourPrecis = (partial: Partial<GameDate>): GameDate => ({
    year: 1247,
    month: 3,
    day: 12,
    precision: "day",
    end: null,
    label: null,
    ...partial,
  });

  it("le jour 1 tombe sur la date marquee 'aujourd'hui' par le MJ", () => {
    const calendar: CalendarConfig = { ...DEFAULT_CALENDAR, currentDate: jourPrecis({}) };
    expect(sceneCalendarDate(1, calendar)).toEqual(jourPrecis({}));
  });

  it("avance d'autant de jours que le compteur de scene, mois et annee compris", () => {
    const calendar: CalendarConfig = { ...DEFAULT_CALENDAR, currentDate: jourPrecis({ day: 30 }) };
    // DEFAULT_CALENDAR : des mois de 30 jours — le jour 3 de la scene tombe deux jours apres le 30, donc le 2 du mois suivant.
    expect(sceneCalendarDate(3, calendar)).toEqual(jourPrecis({ month: 4, day: 2 }));
  });

  it("aucune date reglee : pas d'ancre, pas de date inventee", () => {
    expect(sceneCalendarDate(5, DEFAULT_CALENDAR)).toBeNull();
  });

  it("une date reglee a une precision plus large que le jour n'est pas une ancre utilisable", () => {
    const calendar: CalendarConfig = {
      ...DEFAULT_CALENDAR,
      currentDate: { year: 1247, month: null, day: null, precision: "year", end: null, label: null },
    };
    expect(sceneCalendarDate(5, calendar)).toBeNull();
  });
});

describe("les esquisses (V3-C2) : un personnage incident, jamais une fiche", () => {
  it("ajoute une esquisse", () => {
    expect(addSketch(SCENE, ELFE).sketches).toEqual([ELFE]);
  });

  it("n'ajoute pas deux fois le meme identifiant local", () => {
    const once = addSketch(SCENE, ELFE);
    expect(addSketch(once, ELFE).sketches).toHaveLength(1);
  });

  it("retire une esquisse ancree ou disparue", () => {
    const withElfe = addSketch(SCENE, ELFE);
    expect(removeSketch(withElfe, ELFE.id).sketches).toEqual([]);
  });

  it("retirer une esquisse absente ne leve pas et ne change rien", () => {
    expect(removeSketch(SCENE, "inconnue")).toEqual(SCENE);
  });

  it("compte chaque replique", () => {
    const withElfe = addSketch(SCENE, ELFE);
    const spoken = recordSketchSpoke(withElfe, ELFE.id);
    expect(spoken.sketches[0].timesSpoken).toBe(1);
  });

  it("parler ne fait rien pour une esquisse absente", () => {
    expect(recordSketchSpoke(SCENE, "inconnue")).toEqual(SCENE);
  });

  it(`s'ancre au-dela de ${SKETCH_SPOKEN_ANCHOR_THRESHOLD} repliques, pas avant`, () => {
    expect(sketchShouldAnchorForSpeaking({ ...ELFE, timesSpoken: SKETCH_SPOKEN_ANCHOR_THRESHOLD })).toBe(false);
    expect(sketchShouldAnchorForSpeaking({ ...ELFE, timesSpoken: SKETCH_SPOKEN_ANCHOR_THRESHOLD + 1 })).toBe(true);
  });

  it("une esquisse ne survit qu'a son lieu de tirage", () => {
    const withElfe = addSketch(SCENE, ELFE);
    expect(dropSketchesOutsideLocation(withElfe, "ancre-rouillee").sketches).toEqual([ELFE]);
    expect(dropSketchesOutsideLocation(withElfe, "les-quais").sketches).toEqual([]);
  });

  it("nomme explicitement : un mot entier, jamais une sous-chaine", () => {
    expect(textNamesSketch("je demande son nom à l'elfe taciturne", "elfe taciturne")).toBe(true);
    expect(textNamesSketch("je regarde le brame du cerf", "bram")).toBe(false);
    expect(textNamesSketch("Bram me sert une bière", "bram")).toBe(true);
  });
});
