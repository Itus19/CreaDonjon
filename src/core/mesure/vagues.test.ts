import { describe, expect, it } from "vitest";
import { resumerRequetes } from "./vagues";

describe("resumerRequetes", () => {
  it("rien a resumer", () => {
    expect(resumerRequetes([])).toEqual({ requetes: 0, auth: 0, vagues: 0, dureeMs: 0, cumulMs: 0 });
  });

  it("des requetes paralleles font une seule vague", () => {
    const r = resumerRequetes([
      { debut: 0, ms: 50, chemin: "/rest/v1/worlds" },
      { debut: 5, ms: 40, chemin: "/rest/v1/entities" },
    ]);
    expect(r.vagues).toBe(1);
    expect(r.dureeMs).toBe(50);
    expect(r.cumulMs).toBe(90);
  });

  it("des requetes qui s'attendent font autant de vagues", () => {
    const r = resumerRequetes([
      { debut: 0, ms: 50, chemin: "/auth/v1/user" },
      { debut: 52, ms: 30, chemin: "/rest/v1/worlds" },
      { debut: 60, ms: 10, chemin: "/rest/v1/campaigns" },
      { debut: 85, ms: 20, chemin: "/rest/v1/entities" },
    ]);
    // auth -> worlds -> entities : la plus longue chaine d'attentes.
    expect(r.vagues).toBe(3);
    expect(r.auth).toBe(1);
    expect(r.requetes).toBe(4);
    expect(r.dureeMs).toBe(105);
  });
});
