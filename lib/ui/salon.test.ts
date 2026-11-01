import { describe, expect, it } from "vitest";
import { fusionnerSalon, lectureJet, cibleDuFil, type FilChat } from "./salon";
import type { JetAffiche } from "./outilDes";

function jet(id: string, createdAt: string, extra: Partial<JetAffiche> = {}): JetAffiche {
  return {
    id,
    who: "Aria",
    what: "Perception",
    chips: [],
    total: 15,
    dc: null,
    dcPrivate: false,
    verdict: null,
    naturalD20: null,
    secret: false,
    groups: [],
    pair: null,
    createdAt,
    ...extra,
  };
}

const message = (id: string, created_at: string) => ({ id, created_at, body: id });

describe("fusionnerSalon", () => {
  it("intercale messages et jets par heure croissante", () => {
    const elements = fusionnerSalon([message("m2", "2026-10-01T10:02:00Z"), message("m1", "2026-10-01T10:00:00Z")], [jet("j1", "2026-10-01T10:01:00Z")], []);
    expect(elements.map((e) => e.id)).toEqual(["m1", "j1", "m2"]);
    expect(elements.map((e) => e.genre)).toEqual(["message", "jet", "message"]);
  });

  it("ne garde qu'un exemplaire d'un jet présent dans les deux listes, celui de la route", () => {
    const charge = jet("j1", "2026-10-01T10:00:00Z", { verdict: null });
    const recu = jet("j1", "2026-10-01T10:00:00Z", { verdict: "success" });
    const elements = fusionnerSalon([], [charge], [recu]);
    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({ genre: "jet", jet: { verdict: null } });
  });

  it("ajoute les jets reçus en direct qui manquent à la liste chargée", () => {
    const elements = fusionnerSalon([], [jet("j1", "2026-10-01T10:00:00Z")], [jet("j2", "2026-10-01T10:05:00Z")]);
    expect(elements.map((e) => e.id)).toEqual(["j1", "j2"]);
  });

  it("dédoublonne les messages par identifiant", () => {
    const elements = fusionnerSalon([message("m1", "2026-10-01T10:00:00Z"), message("m1", "2026-10-01T10:00:00Z")], [], []);
    expect(elements).toHaveLength(1);
  });

  it("à heure égale, garde l'ordre d'arrivée (messages d'abord)", () => {
    const elements = fusionnerSalon([message("m1", "2026-10-01T10:00:00Z")], [jet("j1", "2026-10-01T10:00:00Z")], []);
    expect(elements.map((e) => e.id)).toEqual(["m1", "j1"]);
  });
});

describe("lectureJet", () => {
  it("rend le DD et le verdict d'un jet ordinaire", () => {
    expect(lectureJet(jet("j", "t", { dc: 12, verdict: "success" }), false)).toEqual({ dc: 12, dcInconnu: false, verdict: "success" });
  });

  it("côté joueur, cache le verdict et le DD d'un DD privé, même reçus bruts", () => {
    expect(lectureJet(jet("j", "t", { dc: 12, dcPrivate: true, verdict: "fail" }), false)).toEqual({ dc: null, dcInconnu: true, verdict: null });
  });

  it("côté MJ, montre tout d'un DD privé", () => {
    expect(lectureJet(jet("j", "t", { dc: 12, dcPrivate: true, verdict: "fail" }), true)).toEqual({ dc: 12, dcInconnu: false, verdict: "fail" });
  });

  it("sans DD, pas de verdict à inventer", () => {
    expect(lectureJet(jet("j", "t"), false)).toEqual({ dc: null, dcInconnu: false, verdict: null });
  });
});

describe("cibleDuFil", () => {
  it("le salon est le fil nul", () => {
    const fil: FilChat = { genre: "salon" };
    expect(cibleDuFil(fil, "moi")).toBeNull();
  });

  it("le fil privé du MJ désigne le joueur choisi, celui du joueur est le sien", () => {
    expect(cibleDuFil({ genre: "prive", joueurId: "j1" }, "mj")).toBe("j1");
    expect(cibleDuFil({ genre: "prive" }, "moi")).toBe("moi");
    expect(cibleDuFil({ genre: "prive" }, null)).toBeUndefined();
  });
});
