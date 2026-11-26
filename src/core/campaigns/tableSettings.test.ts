import { describe, expect, it } from "vitest";
import { DEFAULT_RECIT } from "./recit";
import { DEFAULT_TABLE_SETTINGS, estEnReserve, mayPlayerChange, mergeTableSettings, parseTableSettings, sheetControls, showsRemotePlay, withPlayStyle, zCampaignTableSettings } from "./tableSettings";

describe("réglages de table (V3.1-108, ADR 0036 §5 et 0043)", () => {
  it("donne les valeurs par défaut décidées à une colonne vide", () => {
    expect(parseTableSettings({})).toEqual({
      inspiration_max: 1,
      play_style: "table",
      players_level: true,
      player_can_edit: { conditions: false, inspiration: false, hp: true, currency: true, spell_slots: true, hit_dice: true },
      reserve: [],
      solo_show_outcome: false,
      recit: DEFAULT_RECIT,
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

describe("sheetControls (V3.1-109)", () => {
  const tout = { conditions: true, inspiration: true, hp: true, currency: true, spell_slots: true, hit_dice: true };

  it("la joueuse : les interrupteurs de la campagne, champ par champ", () => {
    expect(sheetControls(DEFAULT_TABLE_SETTINGS, { callerIsGm: false })).toEqual(DEFAULT_TABLE_SETTINGS.player_can_edit);
  });

  it("le MJ garde toutes les commandes, quels que soient les interrupteurs", () => {
    const fermes = { ...DEFAULT_TABLE_SETTINGS, player_can_edit: { ...tout, hp: false, currency: false } };
    expect(sheetControls(fermes, { callerIsGm: true })).toEqual(tout);
  });

  it("hors campagne, pas de table, donc pas d'interrupteur", () => {
    expect(sheetControls(null, { callerIsGm: false })).toEqual(tout);
  });

  it("rend une copie : la modifier ne touche pas aux réglages", () => {
    const controles = sheetControls(DEFAULT_TABLE_SETTINGS, { callerIsGm: false });
    controles.hp = false;
    expect(DEFAULT_TABLE_SETTINGS.player_can_edit.hp).toBe(true);
  });
});

describe("la façon de jouer (ADR 0103)", () => {
  it("se lit, retombe sur « à table » si illisible", () => {
    expect(parseTableSettings({ play_style: "remote" }).play_style).toBe("remote");
    expect(parseTableSettings({ play_style: "partout" }).play_style).toBe("table");
  });

  it("ne passe jamais par le schéma d'écriture commun, ni ne bouge au passage d'un autre réglage", () => {
    expect(zCampaignTableSettings.safeParse({ play_style: "remote" }).success).toBe(false);
    const distance = withPlayStyle(DEFAULT_TABLE_SETTINGS, "remote");
    expect(mergeTableSettings(distance, { inspiration_max: 2 }).play_style).toBe("remote");
  });

  it("l'écran à distance existe pour « à distance » et « les deux »", () => {
    expect(showsRemotePlay(withPlayStyle(DEFAULT_TABLE_SETTINGS, "table"))).toBe(false);
    expect(showsRemotePlay(withPlayStyle(DEFAULT_TABLE_SETTINGS, "remote"))).toBe(true);
    expect(showsRemotePlay(withPlayStyle(DEFAULT_TABLE_SETTINGS, "both"))).toBe(true);
  });
});

describe("les PJ en réserve (AG-14)", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  it("se lisent comme une liste d'identifiants, sans doublon ni valeur illisible", () => {
    expect(parseTableSettings({ reserve: [A, A, 42, "pas-un-id", B] }).reserve).toEqual([A, B]);
    expect(parseTableSettings({ reserve: "x" }).reserve).toEqual([]);
  });
  it("s'écrivent d'un bloc, et ne touchent ni à la façon de jouer ni aux autres réglages", () => {
    expect(zCampaignTableSettings.safeParse({ reserve: [A] }).success).toBe(true);
    expect(zCampaignTableSettings.safeParse({ reserve: ["pas-un-id"] }).success).toBe(false);
    const distance = withPlayStyle(DEFAULT_TABLE_SETTINGS, "remote");
    const apres = mergeTableSettings(distance, { reserve: [A] });
    expect(apres.reserve).toEqual([A]);
    expect(apres.play_style).toBe("remote");
    expect(mergeTableSettings(apres, { inspiration_max: 2 }).reserve).toEqual([A]);
  });
  it("dit si un PJ est en réserve", () => {
    const s = mergeTableSettings(DEFAULT_TABLE_SETTINGS, { reserve: [A] });
    expect(estEnReserve(s, A)).toBe(true);
    expect(estEnReserve(s, B)).toBe(false);
  });
});

describe("le niveau « Joueurs » (AG-10)", () => {
  it("est utilisé par défaut, et une valeur illisible le garde", () => {
    expect(parseTableSettings({}).players_level).toBe(true);
    expect(parseTableSettings({ players_level: "non" }).players_level).toBe(true);
    expect(parseTableSettings({ players_level: false }).players_level).toBe(false);
  });
  it("se coupe par le schéma d'écriture, sans toucher au reste", () => {
    expect(zCampaignTableSettings.safeParse({ players_level: false }).success).toBe(true);
    const coupe = mergeTableSettings(withPlayStyle(DEFAULT_TABLE_SETTINGS, "remote"), { players_level: false });
    expect(coupe.players_level).toBe(false);
    expect(coupe.play_style).toBe("remote");
    expect(mergeTableSettings(coupe, { inspiration_max: 2 }).players_level).toBe(false);
  });
});

describe("le DD et l'issue des jets dans le solo (V3.2-20)", () => {
  it("sont masqués par défaut, et une valeur illisible les garde masqués", () => {
    expect(parseTableSettings({}).solo_show_outcome).toBe(false);
    expect(parseTableSettings({ solo_show_outcome: "oui" }).solo_show_outcome).toBe(false);
    expect(parseTableSettings({ solo_show_outcome: true }).solo_show_outcome).toBe(true);
  });
  it("s'affichent par le schéma d'écriture, sans toucher au reste", () => {
    expect(zCampaignTableSettings.safeParse({ solo_show_outcome: true }).success).toBe(true);
    expect(zCampaignTableSettings.safeParse({ solo_show_outcome: "oui" }).success).toBe(false);
    const montre = mergeTableSettings(withPlayStyle(DEFAULT_TABLE_SETTINGS, "remote"), { solo_show_outcome: true });
    expect(montre.solo_show_outcome).toBe(true);
    expect(montre.play_style).toBe("remote");
    expect(mergeTableSettings(montre, { inspiration_max: 2 }).solo_show_outcome).toBe(true);
  });
});
