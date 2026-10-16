import { describe, expect, it } from "vitest";
import { claimableView } from "./claimable";

/** V3.1-100 (ADR 0049) : ce que l'écran de choix montre, et sur quelle carte il s'ouvre. */
describe("claimableView", () => {
  const visibles = new Set(["a", "b", "c"]);

  it("sans lien nominatif : tous les PJ ouverts, ouvert sur « Nouveau personnage »", () => {
    const view = claimableView(
      [
        { entityId: "a", reservedForMe: false },
        { entityId: "b", reservedForMe: false },
      ],
      visibles
    );
    expect(view).toEqual({ entityIds: ["a", "b"], startOn: { kind: "new" } });
  });

  it("arrivée par un lien nominatif : seulement le PJ visé, ouvert sur lui", () => {
    const view = claimableView(
      [
        { entityId: "a", reservedForMe: false },
        { entityId: "b", reservedForMe: true },
      ],
      visibles
    );
    expect(view).toEqual({ entityIds: ["b"], startOn: { kind: "character", entityId: "b" } });
  });

  it("aucun PJ : la carte « Nouveau personnage » seule", () => {
    expect(claimableView([], visibles)).toEqual({ entityIds: [], startOn: { kind: "new" } });
  });

  it("un PJ que la joueuse ne peut pas voir n'apparaît jamais, même réservé pour elle", () => {
    const view = claimableView(
      [
        { entityId: "cache", reservedForMe: true },
        { entityId: "a", reservedForMe: false },
      ],
      visibles
    );
    expect(view).toEqual({ entityIds: ["a"], startOn: { kind: "new" } });
  });
});
