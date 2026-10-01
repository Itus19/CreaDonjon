import { describe, expect, it } from "vitest";
import { canRemoveFromCampaign, groupCampaignPeople, personLabel } from "./people";

const members = [
  { user_id: "soso", role: "player" },
  { user_id: "gabriel", role: "gm" },
  { user_id: "tamara1", role: "player" },
  { user_id: "tamara2", role: "player" },
  { user_id: "claude", role: "gm" },
];
const names = { soso: "Soso", gabriel: "Gabriel", tamara1: "Tamara", tamara2: "Tamara", claude: "Claude" };

describe("groupCampaignPeople", () => {
  it("separe les MJ et une carte par compte joueur, dans l'ordre des membres", () => {
    const g = groupCampaignPeople({ members, characters: [], grants: [], displayNames: names });
    expect(g.gms.map((p) => p.userId)).toEqual(["gabriel", "claude"]);
    expect(g.players.map((p) => p.userId)).toEqual(["soso", "tamara1", "tamara2"]);
  });

  it("pose le PJ sur la carte de son joueur, et ses fiches partagees", () => {
    const g = groupCampaignPeople({
      members,
      characters: [{ entity_id: "fine", user_id: "soso", is_pc: true }],
      grants: [
        { entity_id: "epitha", user_id: "soso" },
        { entity_id: "prologue", user_id: "gabriel" },
      ],
      displayNames: names,
    });
    const soso = g.players.find((p) => p.userId === "soso");
    expect(soso?.pcEntityId).toBe("fine");
    expect(soso?.grantedEntityIds).toEqual(["epitha"]);
    expect(g.gms.find((p) => p.userId === "gabriel")?.grantedEntityIds).toEqual(["prologue"]);
  });

  it("range a part les PNJ, les PJ liberes et un personnage tenu par un compte qui n'est plus membre", () => {
    const g = groupCampaignPeople({
      members,
      characters: [
        { entity_id: "mirella", user_id: null, is_pc: false },
        { entity_id: "libre", user_id: null, is_pc: true },
        { entity_id: "orphelin", user_id: "parti", is_pc: true },
      ],
      grants: [],
      displayNames: names,
    });
    expect(g.unclaimed).toEqual([
      { entityId: "mirella", kind: "npc", userId: null },
      { entityId: "libre", kind: "free_pc", userId: null },
      { entityId: "orphelin", kind: "orphan", userId: "parti" },
    ]);
  });

  it("garde le PJ d'un MJ sur sa ligne plutot que de le perdre", () => {
    const g = groupCampaignPeople({ members, characters: [{ entity_id: "pj-mj", user_id: "gabriel", is_pc: true }], grants: [], displayNames: names });
    expect(g.gms.find((p) => p.userId === "gabriel")?.pcEntityId).toBe("pj-mj");
  });
});

describe("personLabel", () => {
  it("ajoute le tag quand il est connu", () => {
    expect(personLabel("Tamara", "4821")).toBe("Tamara#4821");
  });

  it("nom seul sans tag (compte a courriel, ou appelant qui n'est pas MJ)", () => {
    expect(personLabel("Tamara", undefined)).toBe("Tamara");
  });
});

describe("canRemoveFromCampaign", () => {
  const person = (userId: string, role: "gm" | "player") => ({ userId, role, name: userId, pcEntityId: null, grantedEntityIds: [] });

  it("un compte joueur se retire toujours", () => {
    expect(canRemoveFromCampaign(person("soso", "player"), "gabriel")).toBe(true);
  });

  it("un second MJ (pas le createur du monde) se retire aussi", () => {
    expect(canRemoveFromCampaign(person("claude", "gm"), "gabriel")).toBe(true);
  });

  it("jamais le createur du monde", () => {
    expect(canRemoveFromCampaign(person("gabriel", "gm"), "gabriel")).toBe(false);
  });

  it("createur inconnu : aucun MJ ne se propose au retrait, par prudence", () => {
    expect(canRemoveFromCampaign(person("claude", "gm"), null)).toBe(false);
    expect(canRemoveFromCampaign(person("soso", "player"), null)).toBe(true);
  });
});
