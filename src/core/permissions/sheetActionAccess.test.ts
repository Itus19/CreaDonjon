import { describe, expect, it } from "vitest";
import { decideSheetActionAccess } from "./sheetActionAccess";
import { DEFAULT_TABLE_SETTINGS, mergeTableSettings } from "../campaigns/tableSettings";

const base = {
  entityWorldId: "w1",
  callerCanEdit: true,
  callerIsGm: false,
  campaign: undefined,
  settings: DEFAULT_TABLE_SETTINGS,
} as const;

describe("decideSheetActionAccess", () => {
  it("refuse une fiche introuvable (ou invisible)", () => {
    expect(decideSheetActionAccess({ ...base, entityWorldId: null })).toBe("not_found");
  });

  it("refuse une joueuse qui ne peut pas editer la fiche, avant de juger la campagne", () => {
    expect(decideSheetActionAccess({ ...base, callerCanEdit: false, campaign: null })).toBe("forbidden");
  });

  it("refuse une campagne introuvable ou d'un autre monde", () => {
    expect(decideSheetActionAccess({ ...base, campaign: null })).toBe("not_found");
    expect(decideSheetActionAccess({ ...base, campaign: { worldId: "w2" } })).toBe("not_found");
  });

  it("laisse passer un geste sans interrupteur", () => {
    expect(decideSheetActionAccess({ ...base, campaign: { worldId: "w1" } })).toBe("ok");
  });

  it("refuse un champ dont l'interrupteur est coupe, pour une joueuse en campagne", () => {
    expect(decideSheetActionAccess({ ...base, campaign: { worldId: "w1" }, field: "inspiration" })).toBe("switch_off");
    expect(decideSheetActionAccess({ ...base, campaign: { worldId: "w1" }, field: "hp" })).toBe("ok");
  });

  it("le MJ n'est jamais concerne par les interrupteurs", () => {
    const closed = mergeTableSettings(DEFAULT_TABLE_SETTINGS, { player_can_edit: { hp: false } });
    expect(decideSheetActionAccess({ ...base, callerIsGm: true, settings: closed, campaign: { worldId: "w1" }, field: "hp" })).toBe("ok");
  });

  it("hors campagne (fiche d'essai), aucun interrupteur ne s'applique", () => {
    expect(decideSheetActionAccess({ ...base, field: "inspiration" })).toBe("ok");
  });
});
