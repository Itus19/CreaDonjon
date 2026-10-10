import { describe, expect, it } from "vitest";
import { DEFAULT_TABLE_SETTINGS, mayPlayerChange, mergeTableSettings, parseTableSettings, zCampaignTableSettings } from "./tableSettings";

describe("réglages de table (V3.1-108, ADR 0036 §5 et 0043)", () => {
  it("donne les valeurs par défaut décidées à une colonne vide", () => {
    expect(parseTableSettings({})).toEqual({
      inspiration_max: 1,
      player_can_edit: { conditions: false, inspiration: false, hp: true, currency: true, spell_slots: true, hit_dice: true },
    });
    expect(DEFAULT_TABLE_SETTINGS.player_can_edit.hp).toBe(true);
  });

  it("complète un réglage partiel champ par champ", () => {
    const s = parseTableSettings({ inspiration_max: 3, player_can_edit: { hp: false } });
    expect(s.inspiration_max).toBe(3);
    expect(s.player_can_edit).toEqual({ conditions: false, inspiration: false, hp: false, currency: true, spell_slots: true, hit_dice: true });
  });

  it("une valeur illisible retombe sur les défauts, jamais sur « tout permis »", () => {
    expect(parseTableSettings("n'importe quoi")).toEqual(DEFAULT_TABLE_SETTINGS);
    expect(parseTableSettings({ player_can_edit: { hp: "oui" } }).player_can_edit.hp).toBe(true);
    expect(parseTableSettings(null)).toEqual(DEFAULT_TABLE_SETTINGS);
  });

  it("le schéma d'écriture refuse une clé inconnue et une borne hors limite", () => {
    expect(zCampaignTableSettings.safeParse({ player_can_edit: { xp: true } }).success).toBe(false);
    expect(zCampaignTableSettings.safeParse({ inspiration_max: 0 }).success).toBe(false);
    expect(zCampaignTableSettings.safeParse({ inspiration_max: 6 }).success).toBe(false);
    expect(zCampaignTableSettings.safeParse({ inspiration_max: 2, player_can_edit: { conditions: true } }).success).toBe(true);
  });
});

describe("mayPlayerChange", () => {
  const s = parseTableSettings({ player_can_edit: { hp: false } });

  it("le MJ change tout, interrupteur coupé ou non", () => {
    expect(mayPlayerChange("hp", s, { callerIsGm: true })).toBe(true);
    expect(mayPlayerChange("inspiration", s, { callerIsGm: true })).toBe(true);
  });

  it("une joueuse suit les interrupteurs", () => {
    expect(mayPlayerChange("hp", s, { callerIsGm: false })).toBe(false);
    expect(mayPlayerChange("inspiration", s, { callerIsGm: false })).toBe(false);
    expect(mayPlayerChange("hit_dice", s, { callerIsGm: false })).toBe(true);
  });
});

describe("mergeTableSettings", () => {
  it("ne change que ce que le réglage partiel nomme", () => {
    const merged = mergeTableSettings(DEFAULT_TABLE_SETTINGS, { player_can_edit: { inspiration: true } });
    expect(merged.player_can_edit).toEqual({ ...DEFAULT_TABLE_SETTINGS.player_can_edit, inspiration: true });
    expect(merged.inspiration_max).toBe(1);
  });

  it("une valeur absente n'efface jamais un interrupteur", () => {
    const merged = mergeTableSettings(DEFAULT_TABLE_SETTINGS, { player_can_edit: { hp: undefined } });
    expect(merged.player_can_edit.hp).toBe(true);
  });
});
