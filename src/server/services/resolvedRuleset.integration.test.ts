import { beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { assembleResolvedRuleset } from "./resolvedRuleset";
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
});
