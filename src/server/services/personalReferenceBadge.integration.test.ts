import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRuleEntryForWorld } from "./rules";

/**
 * V1-D5 : sans ce test, rien ne prouve que le badge "reference personnelle"
 * (specs/ruleset-personnel.md) distingue reellement une fiche TOUCHEE par
 * une surcharge d'un ruleset `personal_reference` d'une fiche simplement
 * HERITEE de la base SRD a travers une telle variante — deux cas que la
 * boucle de collecte des surcharges (`getRuleEntryForWorld`) doit traiter
 * differemment (voir le commentaire dans src/server/services/rules.ts :
 * "une variante personal_reference peut tres bien ne rien surcharger sur
 * telle entree").
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("badge reference personnelle : entree touchee vs entree heritee (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let userId: string;
  let personalRulesetId: string;
  let worldId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `integration-test-personal-badge-${Date.now()}@creadonjon.local`;
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

    const { data: personal, error: personalError } = await admin
      .from("rulesets")
      .insert({
        name: "Variante de test integration — badge reference personnelle",
        base_system: "dnd_srd_51",
        parent_ruleset_id: official.id,
        is_official_base: false,
        created_by: userId,
        content_origin: "personal_reference",
      })
      .select("id")
      .single();
    if (personalError || !personal) throw new Error(personalError?.message ?? "creation variante personal_reference echouee");
    personalRulesetId = personal.id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — badge reference personnelle", slug: `test-badge-${Date.now()}`, owner_id: userId, default_ruleset_id: personalRulesetId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { error: overrideError } = await userClient.rpc("upsert_ruleset_override", {
      p_ruleset_id: personalRulesetId,
      p_entry_key: "epee-de-la-brume-test",
      p_block_type: null,
      p_action: "add_entry",
      p_payload: { name: "Épée de la Brume (test)", entry_type: "weapon" },
      p_patch: null,
      p_note: "test d'integration",
    });
    if (overrideError) throw new Error(overrideError.message);
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("worlds").delete().eq("owner_id", userId);
      await admin.from("rulesets").delete().eq("created_by", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("porte le badge sur une fiche maison creee par surcharge dans la variante personal_reference", async () => {
    const entry = await getRuleEntryForWorld(admin, worldId, "epee-de-la-brume-test", "en");
    expect(entry).not.toBeNull();
    expect(entry?.personalReference).toBe(true);
  });

  it("ne porte pas le badge sur une fiche SRD heritee, non touchee par une surcharge de la variante", async () => {
    const entry = await getRuleEntryForWorld(admin, worldId, "dagger", "en");
    expect(entry).not.toBeNull();
    expect(entry?.personalReference).toBe(false);
  });
});
