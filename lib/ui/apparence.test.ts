import { describe, expect, it } from "vitest";
import { MODES_APPARENCE, modeApresChoixDeFond, pointsDeModes } from "./apparence";

/**
 * V3.1-58 — choisir un fond qui ne permet pas le mode en cours bascule sur un
 * mode permis, et la vignette montre les quatre modes (teinté si lisible).
 */
describe("modeApresChoixDeFond", () => {
  it("garde le mode quand le fond le permet", () => {
    expect(modeApresChoixDeFond("light", ["dark", "dim", "soft", "light"])).toEqual({ mode: "light", bascule: false });
  });

  it("bascule sur le premier mode permis, et le signale", () => {
    expect(modeApresChoixDeFond("light", ["dark", "dim"])).toEqual({ mode: "dark", bascule: true });
  });

  it("un fond sans mode déclaré ne change rien", () => {
    expect(modeApresChoixDeFond("soft", [])).toEqual({ mode: "soft", bascule: false });
  });
});

describe("pointsDeModes", () => {
  it("rend toujours les quatre modes, dans l'ordre, permis ou non", () => {
    expect(pointsDeModes(["dim", "dark"])).toEqual([
      { mode: "dark", permis: true },
      { mode: "dim", permis: true },
      { mode: "soft", permis: false },
      { mode: "light", permis: false },
    ]);
    expect(MODES_APPARENCE).toEqual(["dark", "dim", "soft", "light"]);
  });
});
