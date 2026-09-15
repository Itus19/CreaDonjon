import { describe, expect, it } from "vitest";
import { zTextBlockData } from "./text";

describe("zTextBlockData", () => {
  it("accepte un bloc sans dropCap (tout le contenu anterieur a cette option)", () => {
    const parsed = zTextBlockData.parse({ __v: 1, segments: [] });
    expect(parsed.dropCap).toBe(false);
  });

  it("garde une lettrine demandee explicitement", () => {
    const parsed = zTextBlockData.parse({ __v: 1, segments: [], dropCap: true });
    expect(parsed.dropCap).toBe(true);
  });

  it("refuse une valeur non booleenne", () => {
    expect(() => zTextBlockData.parse({ __v: 1, segments: [], dropCap: "oui" })).toThrow();
  });
});
