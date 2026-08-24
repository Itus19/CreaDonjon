import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHomebrewWeapon } from "./rules";
import { resolveEquipmentArmorData, resolveEquipmentCost, resolveEquipmentWeaponData, resolveEquipmentWeight } from "./resolvedRuleset";

/**
 * V1-D4 : sans ce test, rien ne prouve qu'une fiche maison (surcharge
 * `add_entry` + `add_block`, aucune ligne `ruleset_entries`, aucun
 * `custom_table` de secours) resout reellement jusqu'aux fonctions
 * consommees par les actions de jeu (`resolveEquipmentWeaponData`/
 * `resolveEquipmentWeight`/`resolveEquipmentCost`) — c'est precisement le
 * chemin qu'aucun test existant n'exercait avant ce ticket (toutes les
 * entrees officielles ont un `custom_table` redondant qui masquait le trou).
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("arme maison : ecriture + resolution mecanique (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let userId: string;
  let variantRulesetId: string;
  let entryKey: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `integration-test-homebrew-weapon-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (userError || !userData.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    userId = userData.user.id;

    userClient = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await userClient.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(signInError.message);

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .eq("base_system", "dnd_srd_51")
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { data: variant, error: variantError } = await admin
      .from("rulesets")
      .insert({
        name: "Variante de test integration — arme maison",
        base_system: "dnd_srd_51",
        parent_ruleset_id: official.id,
        is_official_base: false,
        created_by: userId,
      })
      .select("id")
      .single();
    if (variantError || !variant) throw new Error(variantError?.message ?? "creation variante echouee");
    variantRulesetId = variant.id;
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("rulesets").delete().eq("created_by", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("cree une epee maison et la resout comme une arme SRD (degats, poids, cout) sans custom_table", async () => {
    const created = await createHomebrewWeapon(userClient, {
      rulesetId: variantRulesetId,
      name: "Épée de Gabriel",
      weapon: {
        category: "martial",
        is_ranged: false,
        damage: { dice: { op: "dice", count: 1, faces: 8 }, type: "slashing" },
        properties: [{ kind: "rule", key: "weapon-property-finesse" }],
        weight: { value: 3, unit: "lb" },
        cost: { value: 15, unit: "gp" },
      },
    });
    entryKey = created.entryKey;
    expect(entryKey).toBe("epee-de-gabriel");
    expect(created.rulesetId).toBe(variantRulesetId);

    const [weaponByKey, weightByKey, costByKey, armorByKey] = await Promise.all([
      resolveEquipmentWeaponData(admin, variantRulesetId, [entryKey]),
      resolveEquipmentWeight(admin, variantRulesetId, [entryKey]),
      resolveEquipmentCost(admin, variantRulesetId, [entryKey]),
      resolveEquipmentArmorData(admin, variantRulesetId, [entryKey]),
    ]);

    expect(weaponByKey[entryKey]).toEqual({
      damageDice: "1d8",
      damageType: "slashing",
      versatileDamageDice: null,
      properties: ["finesse"],
      isRanged: false,
      masteryKey: null,
    });
    expect(weightByKey[entryKey]).toBe(3);
    expect(costByKey[entryKey]).toEqual({ quantity: 15, unit: "gp" });
    expect(armorByKey[entryKey]).toBeNull();
  });
});
