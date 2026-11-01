import { describe, expect, it } from "vitest";
import { rollDetailForReader } from "./rollForReader";

describe("un jet tel que son lecteur a le droit de le lire (V3.1-22, règle 5)", () => {
  it("DD privé : le joueur ne reçoit pas le verdict ; le MJ, si", () => {
    const detail = { who: "MJ", what: "Perception", dc: null, dcPrivate: true, verdict: "success", trace: [] };
    expect(rollDetailForReader(detail, { isGm: false })).toEqual({ who: "MJ", what: "Perception", dc: null, dcPrivate: true, verdict: null, trace: [] });
    expect(rollDetailForReader(detail, { isGm: true })).toBe(detail);
  });

  it("DD public ou sans DD : rien ne change", () => {
    const detail = { who: "Brunhild", what: "Athlétisme", dc: 12, verdict: "fail" };
    expect(rollDetailForReader(detail, { isGm: false })).toBe(detail);
    expect(rollDetailForReader(null, { isGm: false })).toBeNull();
  });
});
