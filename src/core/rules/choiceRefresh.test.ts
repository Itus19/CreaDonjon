import { describe, expect, it } from "vitest";
import type { OpenChoice } from "./choices";
import { choicesToRefresh, isValidRefreshAnswer, withoutRefresh } from "./choiceRefresh";

const ouvert = (key: string, refresh: OpenChoice["refresh"], chosen: string[], count = 1): OpenChoice => ({
  key,
  label: key,
  count,
  from: { kind: "option", options: [{ id: "arid", label: { fr: "Aride" } }, { id: "polar", label: { fr: "Polaire" } }] },
  refresh,
  chosen,
  preset: false,
  sourceKey: key.split(".")[0]!,
  atLevel: 3,
});

describe("les choix rouverts au repos (V3.1-119)", () => {
  const terrain = ouvert("circle-of-the-land.land", "long_rest", ["arid"]);
  const resilience = ouvert("fiend-patron.damage-type", "short_rest", ["fire"]);
  const jamais = ouvert("versatile.feat", "never", ["alert"]);
  const sansReponse = ouvert("hunter.option", "short_rest", []);

  it("un repos long rouvre les choix « repos long » et « repos court » ; un repos court, seulement les siens", () => {
    expect(choicesToRefresh([terrain, resilience, jamais], "long_rest")).toEqual(["circle-of-the-land.land", "fiend-patron.damage-type"]);
    expect(choicesToRefresh([terrain, resilience, jamais], "short_rest")).toEqual(["fiend-patron.damage-type"]);
  });

  it("un choix pas encore répondu n'est pas « rouvert » : il est déjà à faire", () => {
    expect(choicesToRefresh([sansReponse], "short_rest")).toEqual([]);
  });

  it("une réponse vaut si le moteur la retient entière (bon nombre, options valides)", () => {
    expect(isValidRefreshAnswer({ ...terrain, chosen: ["polar"] }, ["polar"])).toBe(true);
    // Le moteur a écarté une valeur (hors options) : refusé.
    expect(isValidRefreshAnswer({ ...terrain, chosen: [] }, ["volcanic"])).toBe(false);
    expect(isValidRefreshAnswer(undefined, ["polar"])).toBe(false);
    expect(isValidRefreshAnswer({ ...terrain, count: 2, chosen: ["polar"] }, ["polar"])).toBe(false);
  });

  it("répondre ou garder retire le choix de la liste, sans toucher aux autres", () => {
    expect(withoutRefresh(["a", "b"], "a")).toEqual(["b"]);
    expect(withoutRefresh(["a"], "z")).toEqual(["a"]);
  });
});
