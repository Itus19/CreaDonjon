import { describe, expect, it } from "vitest";
import { zResourcesBlockData } from "./resources";

describe("zResourcesBlockData", () => {
  it("valide un compteur lie a une regle et un compteur personnalise", () => {
    const data = {
      __v: 1 as const,
      trackers: [
        {
          id: "r1",
          label: "Second souffle",
          source: { kind: "rule" as const, key: "second_wind" },
          max: { formula: { op: "num" as const, value: 2 } },
          recharge: "short_rest" as const,
        },
        {
          id: "r2",
          label: "Points de fureur",
          max: { formula: { op: "num" as const, value: 5 } },
          recharge: "long_rest" as const,
          custom: true,
        },
      ],
    };
    expect(zResourcesBlockData.parse(data)).toEqual(data);
  });

  it("rejette un maximum sans formule", () => {
    const data = {
      __v: 1,
      trackers: [{ id: "r1", label: "Second souffle", max: { formula: undefined }, recharge: "short_rest" }],
    };
    expect(() => zResourcesBlockData.parse(data)).toThrow();
  });
});
