import { describe, expect, it } from "vitest";
import type { RoomsBlockData } from "../schemas/blocks/rooms";
import { exposureHere, perceivedCues } from "./perceived";
import type { Weather } from "./weather";

const pieces: RoomsBlockData = {
  __v: 1,
  rooms: [
    { id: "cour", name: "La cour", description: "", exposure: "outdoor" },
    { id: "salle", name: "Grande salle", description: "" },
  ],
};

describe("exposureHere", () => {
  it("prend l'exposition de la pièce du wiki où l'on est, retrouvée par son nom", () => {
    expect(exposureHere({ roomBlocks: [pieces], roomName: "la cour", buildingHint: false })).toBe("outdoor");
  });

  it("met dedans une pièce sans exposition, ou une esquisse de pièce", () => {
    expect(exposureHere({ roomBlocks: [pieces], roomName: "Grande salle", buildingHint: false })).toBe("indoor");
    expect(exposureHere({ roomBlocks: [pieces], roomName: "Le grenier", buildingHint: false })).toBe("indoor");
  });

  it("prend l'exposition de l'espace principal quand elle est écrite", () => {
    expect(exposureHere({ roomBlocks: [{ ...pieces, main_exposure: "sheltered" }], roomName: null, buildingHint: false })).toBe("sheltered");
  });

  it("met dedans l'espace principal d'un bâtiment (des pièces, ou une carte des prix)", () => {
    expect(exposureHere({ roomBlocks: [pieces], roomName: null, buildingHint: false })).toBe("indoor");
    expect(exposureHere({ roomBlocks: [], roomName: null, buildingHint: true })).toBe("indoor");
  });

  it("met dehors un lieu sans pièce ni indice de bâtiment", () => {
    expect(exposureHere({ roomBlocks: [], roomName: null, buildingHint: false })).toBe("outdoor");
  });
});

const pluie: Weather = { sky: "overcast", precipitation: "rain", wind: "breeze", fog: false, temperatureC: 8, feel: "cool", season: "autumn" };

describe("perceivedCues", () => {
  it("ne rend rien de plus dehors : tout est perçu", () => {
    expect(perceivedCues(pluie, "outdoor")).toEqual([]);
  });

  it("fait entendre la pluie dedans, sans jamais la faire tomber sur le personnage", () => {
    expect(perceivedCues(pluie, "indoor")).toEqual(["rain_on_roof"]);
  });

  it("ne fait rien entendre d'une bruine depuis l'intérieur", () => {
    expect(perceivedCues({ ...pluie, precipitation: "drizzle" }, "indoor")).toEqual([]);
  });

  it("fait entendre l'orage, la grêle et le vent fort", () => {
    expect(perceivedCues({ ...pluie, precipitation: "thunderstorm", wind: "gale" }, "indoor")).toEqual(["thunder", "wind_howls"]);
    expect(perceivedCues({ ...pluie, precipitation: "hail" }, "indoor")).toEqual(["hail_on_roof"]);
  });

  it("laisse passer le grand froid et la chaleur écrasante à travers les murs", () => {
    expect(perceivedCues({ ...pluie, precipitation: "none", temperatureC: -12, feel: "freezing" }, "indoor")).toEqual(["cold_seeps"]);
    expect(perceivedCues({ ...pluie, precipitation: "none", temperatureC: 38, feel: "scorching" }, "indoor")).toEqual(["stifling_heat"]);
  });

  it("à l'abri, montre la pluie qui tombe à côté et le vent qu'on sent", () => {
    expect(perceivedCues({ ...pluie, wind: "wind" }, "sheltered")).toEqual(["precipitation_nearby", "wind_felt"]);
  });
});
