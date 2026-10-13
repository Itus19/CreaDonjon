import { beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { assembleResolvedRuleset, resolveCharacterChoices } from "./resolvedRuleset";
import { characterSheet, type CharacterBuild } from "../../core/rules/sheet";

/**
 * V1-B4 : sans ce test, rien ne prouve que l'assembleur produit un
 * `ResolvedRuleset` reel et exploitable a partir des donnees SRD deja
 * importees (pas un jeu de demonstration) — les tests purs de
 * `srdMapping.test.ts` verifient chaque extracteur isolement, mais pas le
 * cablage bout en bout contre la base reelle (chain-walk, blocs,
 * traductions, resolution de features).
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("assembleResolvedRuleset (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let rulesetId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await admin
      .from("rulesets")
      .select("id")
      .eq("base_system", "dnd_srd_51")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (error || !data) throw new Error(error?.message ?? "aucun ruleset SRD 5.1 officiel en base");
    rulesetId = data.id;
  });

  it("assemble un nain guerrier a partir des donnees SRD reellement importees", async () => {
    const assembled = await assembleResolvedRuleset(
      admin,
      rulesetId,
      { species: "dwarf", classes: [{ key: "fighter", level: 1 }] },
      "fr"
    );

    expect(assembled.ruleset.features["species:dwarf"].modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "ability.con", op: "add", value: 2 }),
        expect.objectContaining({ target: "speed", op: "set", value: 25 }),
      ])
    );
    expect(assembled.ruleset.classes.fighter).toMatchObject({
      hitDie: 10,
      savingThrowProficiencies: ["str", "con"],
      spellcasting: undefined,
    });
    expect(assembled.remainingChoices).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "fighter.skills", count: 2 })])
    );
    expect(assembled.remainingChoices[0].options).toContain("athletics");

    // Golden case §B7 (V1-B1) rejoue avec des donnees reelles plutot qu'un fixture ecrit a la main.
    const build: CharacterBuild = {
      species: "dwarf",
      classes: [{ key: "fighter", level: 1 }],
      abilities: { assigned: { str: 16, dex: 10, con: 12, int: 8, wis: 13, cha: 10 } },
      featureKeys: ["species:dwarf"],
    };
    const sheet = characterSheet(build, assembled.ruleset, [], []);
    expect(sheet.abilities.con).toMatchObject({ score: 14, mod: 2 });
    expect(sheet.speed.value).toBe(25);
    expect(sheet.savingThrows.str).toMatchObject({ mod: 5, proficient: true });
    expect(sheet.hitPoints.max).toBe(12);
  });

  it("assemble un magicien avec ses emplacements de sort reels", async () => {
    const assembled = await assembleResolvedRuleset(admin, rulesetId, { classes: [{ key: "wizard", level: 3 }] }, "fr");
    expect(assembled.ruleset.classes.wizard).toMatchObject({
      hitDie: 6,
      savingThrowProficiencies: ["int", "wis"],
      spellcasting: { ability: "int", slotsByLevel: { 3: { 1: 4, 2: 2 } } },
    });
  });

  // V3.1-62 : l'assembleur lance ses lectures en parallele ; l'ordre des
  // choix restants, lui, ne doit pas bouger — l'assistant de creation les
  // affiche dans cet ordre, et une competence proposee par la classe ET par
  // un trait va d'abord a la classe (`routeSkillChoices`, V3.1-4).
  it("SRD 2024 : l'ordre des choix restants d'un Humain Guerrier reste classe, armes, trait, langues", async () => {
    const { data, error } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    if (error || !data) throw new Error(error?.message ?? "aucun ruleset SRD 5.2.1 officiel en base");
    const assembled = await assembleResolvedRuleset(
      admin,
      data.id,
      { species: "human", background: "soldier", classes: [{ key: "fighter", level: 1 }] },
      "fr"
    );
    expect(assembled.remainingChoices.map((c) => c.id)).toEqual(["fighter.skills", "fighter.weapon_mastery", "skillful.skills", "character.languages"]);
  });
});

/**
 * V3.1-116 : les choix accordés posés par l'import (`data/srd/choices-2024.json`)
 * se résolvent bout en bout contre la base : catalogue des dons, réponse
 * imposée par l'historique, sorts validés d'après leurs vraies fiches.
 */
describe.skipIf(!hasCreds)("choix accordés du SRD 2024 (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let rulesetId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).limit(1).single();
    if (error || !data) throw new Error(error?.message ?? "aucun ruleset SRD 5.2.1 officiel en base");
    rulesetId = data.id;
  });

  it("Humain Acolyte : Polyvalent ouvre les dons d'origine, l'Acolyte impose la liste du clerc, les sorts hors liste sont écartés", async () => {
    const assembled = await assembleResolvedRuleset(admin, rulesetId, { species: "human", background: "acolyte", classes: [{ key: "fighter", level: 1 }] }, "fr");
    expect(Object.keys(assembled.featCatalog).sort()).toEqual(["alert", "magic-initiate", "savage-attacker", "skilled"]);
    expect(assembled.choicePresets).toEqual({ "magic-initiate.list": ["cleric"] });
    expect(assembled.choiceSources.map((s) => s.key)).toEqual(expect.arrayContaining(["skillful", "versatile", "magic-initiate"]));

    const resolved = await resolveCharacterChoices(
      admin,
      rulesetId,
      assembled,
      {
        "magic-initiate.list.cleric.cantrips": ["guidance", "fire-bolt"],
        "magic-initiate.list.cleric.spell": ["bless"],
        "magic-initiate.ability": ["wis"],
        "versatile.feat": ["alert"],
      },
      1
    );
    const spells = resolved.features.flatMap((f) => f.spells ?? []).map((s) => s.key);
    // Trait de feu n'est pas sur la liste du clerc.
    expect(spells).toEqual(["guidance", "bless"]);
    expect(resolved.features.some((f) => f.key === "choice:versatile.feat")).toBe(true);
  });

  it("Elfe : le Drow apprend ses sorts aux niveaux 1, 3 et 5", async () => {
    const assembled = await assembleResolvedRuleset(admin, rulesetId, { species: "elf", classes: [{ key: "wizard", level: 5 }] }, "fr");
    const resolved = await resolveCharacterChoices(admin, rulesetId, assembled, { "elven-lineage.lineage": ["drow"], "elven-lineage.ability": ["int"] }, 5);
    const build: CharacterBuild = {
      species: "elf",
      classes: [{ key: "wizard", level: 5 }],
      abilities: { assigned: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 } },
      featureKeys: resolved.features.map((f) => f.key),
    };
    const features = Object.fromEntries(resolved.features.map((f) => [f.key, f]));
    const sheet = characterSheet(build, { ...assembled.ruleset, features: { ...assembled.ruleset.features, ...features } }, [], []);
    expect(sheet.grantedSpells.map((s) => s.key)).toEqual(["dancing-lights", "faerie-fire", "darkness"]);
    expect(assembled.remainingChoices.some((c) => c.id === "keen-senses.skills")).toBe(true);
  });
});

/**
 * V3.1-117 : la sous-classe rejoint le lot résolu ; ses aptitudes atteintes
 * ouvrent leurs choix, comptés au niveau de CLASSE.
 */
describe.skipIf(!hasCreds)("sous-classes du SRD 2024 (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let rulesetId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).limit(1).single();
    if (error || !data) throw new Error(error?.message ?? "aucun ruleset SRD 5.2.1 officiel en base");
    rulesetId = data.id;
  });

  it("Druide 5 du Cercle de la Terre, terres arides : ses sorts de cercle jusqu'au niveau 5", async () => {
    // L'import désambiguïse la clé : « circle-of-the-land » est déjà une aptitude 2014.
    const classes = [{ key: "druid", level: 5, subclass: "circle-of-the-land-subclass" }];
    const assembled = await assembleResolvedRuleset(admin, rulesetId, { classes }, "fr");
    expect(assembled.choiceSources.map((s) => s.key)).toContain("circle-of-the-land-subclass.circle-of-the-land-spells");
    const resolved = await resolveCharacterChoices(admin, rulesetId, assembled, { "circle-of-the-land-subclass.circle-of-the-land-spells.land": ["arid"] }, 5, { druid: 5 });
    const build: CharacterBuild = {
      species: "",
      classes: [{ key: "druid", level: 5 }],
      abilities: { assigned: { str: 8, dex: 12, con: 14, int: 10, wis: 16, cha: 10 } },
      featureKeys: resolved.features.map((f) => f.key),
    };
    const features = Object.fromEntries(resolved.features.map((f) => [f.key, f]));
    const sheet = characterSheet(build, { ...assembled.ruleset, features: { ...assembled.ruleset.features, ...features } }, [], []);
    expect(sheet.grantedSpells.map((s) => s.key)).toEqual(["blur", "burning-hands", "fire-bolt", "fireball"]);
  });

  it("Magicien évocateur : Savant en évocation refuse un sort d'une autre école ou de niveau 3", async () => {
    const assembled = await assembleResolvedRuleset(admin, rulesetId, { classes: [{ key: "wizard", level: 3, subclass: "evoker" }] }, "fr");
    const resolved = await resolveCharacterChoices(admin, rulesetId, assembled, { "evoker.evocation-savant.spells": ["fireball", "shield", "magic-missile"] }, 3, { wizard: 3 });
    expect(resolved.open.find((c) => c.key === "evoker.evocation-savant.spells")?.chosen).toEqual(["magic-missile"]);
  });

  it("une sous-classe descriptive (Voleur) n'ajoute ni aptitude chiffrée ni choix", async () => {
    const without = await assembleResolvedRuleset(admin, rulesetId, { classes: [{ key: "rogue", level: 3 }] }, "fr");
    const withThief = await assembleResolvedRuleset(admin, rulesetId, { classes: [{ key: "rogue", level: 3, subclass: "thief" }] }, "fr");
    expect(Object.keys(withThief.ruleset.features).sort()).toEqual(Object.keys(without.ruleset.features).sort());
    expect(withThief.choiceSources).toEqual(without.choiceSources);
  });
});

/**
 * V3.1-113 : emplacements du multiclassé et magie de pacte, lus dans les
 * données importées (poids d'incantation, table du ruleset).
 */
describe.skipIf(!hasCreds)("emplacements de sort du SRD 2024 (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let rulesetId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).limit(1).single();
    if (error || !data) throw new Error(error?.message ?? "aucun ruleset SRD 5.2.1 officiel en base");
    rulesetId = data.id;
  });

  async function sheetOf(classes: { key: string; level: number }[]) {
    const assembled = await assembleResolvedRuleset(admin, rulesetId, { classes }, "fr");
    const build: CharacterBuild = {
      species: "",
      classes,
      abilities: { assigned: { str: 10, dex: 10, con: 10, int: 14, wis: 14, cha: 16 } },
      featureKeys: [],
    };
    return characterSheet(build, assembled.ruleset, [], []);
  }

  it("occultiste 20 : 4 emplacements de pacte de niveau 5", async () => {
    const sheet = await sheetOf([{ key: "warlock", level: 20 }]);
    expect(sheet.spellcasting?.pactSlots).toEqual({ count: 4, slotLevel: 5 });
    expect(sheet.spellcasting?.slots).toEqual({});
  });

  it("clerc 3 / magicien 2 : les emplacements d'un lanceur de niveau 5", async () => {
    const sheet = await sheetOf([
      { key: "cleric", level: 3 },
      { key: "wizard", level: 2 },
    ]);
    expect(sheet.spellcasting?.slots).toEqual({ 1: 4, 2: 3, 3: 2 });
  });
});
