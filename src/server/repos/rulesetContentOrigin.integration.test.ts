import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * V1-D5 : sans ce test, rien ne prouve que les garde-fous de
 * `specs/ruleset-personnel.md` §3.1/§3.3 sont de vrais refus en base — pas
 * de simples avertissements d'interface (CLAUDE.md, garde-fous en triggers).
 * Deux triggers testes ici : `share_links_forbid_personal_reference`
 * (partage refuse pour un monde OU une campagne fondes sur un ruleset
 * `personal_reference`) et `rulesets_forbid_personal_reference_downgrade`
 * (aucune bascule hors de `personal_reference`, meme via `service_role`).
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("content_origin et garde-fous de reference personnelle (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let officialRulesetId: string;
  let userCreatedRulesetId: string;
  let personalRulesetId: string;
  let personalWorldId: string;
  let normalWorldId: string;
  let personalCampaignId: string;
  let partyEntityId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `integration-test-content-origin-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (userError || !userData.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    userId = userData.user.id;

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .eq("base_system", "dnd_srd_51")
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");
    officialRulesetId = official.id;

    const { data: userCreated, error: userCreatedError } = await admin
      .from("rulesets")
      .insert({ name: "Variante test — maison", base_system: "dnd_srd_51", parent_ruleset_id: officialRulesetId, is_official_base: false, created_by: userId, content_origin: "user_created" })
      .select("id")
      .single();
    if (userCreatedError || !userCreated) throw new Error(userCreatedError?.message ?? "creation variante user_created echouee");
    userCreatedRulesetId = userCreated.id;

    const { data: personal, error: personalError } = await admin
      .from("rulesets")
      .insert({ name: "Variante test — reference personnelle", base_system: "dnd_srd_51", parent_ruleset_id: officialRulesetId, is_official_base: false, created_by: userId, content_origin: "personal_reference" })
      .select("id")
      .single();
    if (personalError || !personal) throw new Error(personalError?.message ?? "creation variante personal_reference echouee");
    personalRulesetId = personal.id;

    const { data: personalWorld, error: personalWorldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — reference personnelle", slug: `test-personal-${Date.now()}`, owner_id: userId, default_ruleset_id: personalRulesetId })
      .select("id")
      .single();
    if (personalWorldError || !personalWorld) throw new Error(personalWorldError?.message ?? "creation monde personnel echouee");
    personalWorldId = personalWorld.id;

    const { data: normalWorld, error: normalWorldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — normal", slug: `test-normal-${Date.now()}`, owner_id: userId, default_ruleset_id: officialRulesetId })
      .select("id")
      .single();
    if (normalWorldError || !normalWorld) throw new Error(normalWorldError?.message ?? "creation monde normal echouee");
    normalWorldId = normalWorld.id;

    // Faction requise par campaigns.party_entity_id (V1-C1) — pas de contenu
    // narratif ici, juste le minimum pour inserer une campagne de test.
    const { data: party, error: partyError } = await admin
      .from("entities")
      .insert({ world_id: normalWorldId, name: "Groupe test", entity_kind: "faction", slug: `groupe-test-${Date.now()}`, created_by: userId })
      .select("id")
      .single();
    if (partyError || !party) throw new Error(partyError?.message ?? "creation entite faction echouee");
    partyEntityId = party.id;

    // Campagne rattachee au monde NORMAL (ruleset officiel par defaut) mais
    // epinglant elle-meme le ruleset personal_reference — verifie que le
    // trigger regarde bien campaigns.ruleset_id, pas seulement
    // worlds.default_ruleset_id (V1-C1 : les deux peuvent diverger).
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: normalWorldId, name: "Campagne test", ruleset_id: personalRulesetId, mode: "campaign", gm_user_id: userId, party_entity_id: partyEntityId })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    personalCampaignId = campaign.id;
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("campaigns").delete().eq("gm_user_id", userId);
      await admin.from("entities").delete().eq("created_by", userId);
      await admin.from("worlds").delete().eq("owner_id", userId);
      await admin.from("rulesets").delete().eq("created_by", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("le backfill a pose content_origin = official_srd sur les rulesets officiels", async () => {
    const { data, error } = await admin.from("rulesets").select("content_origin").eq("id", officialRulesetId).single();
    expect(error).toBeNull();
    expect(data?.content_origin).toBe("official_srd");
  });

  it("refuse un lien de partage sur un monde dont le ruleset par defaut est personal_reference", async () => {
    const { error } = await admin
      .from("share_links")
      .insert({ world_id: personalWorldId, token_hash: `test-${Date.now()}-a`, scope: "public_only", created_by: userId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("reference personnelle");
  });

  it("refuse un lien de partage scope a une campagne fondee sur personal_reference, meme si le monde par defaut ne l'est pas", async () => {
    const { error } = await admin
      .from("share_links")
      .insert({ world_id: normalWorldId, campaign_id: personalCampaignId, token_hash: `test-${Date.now()}-b`, scope: "players", created_by: userId });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("reference personnelle");
  });

  it("autorise un lien de partage normal (monde et campagne hors personal_reference)", async () => {
    const { error } = await admin
      .from("share_links")
      .insert({ world_id: normalWorldId, token_hash: `test-${Date.now()}-c`, scope: "public_only", created_by: userId });
    expect(error).toBeNull();
    await admin.from("share_links").delete().eq("world_id", normalWorldId).is("campaign_id", null);
  });

  it("refuse la bascule hors de personal_reference, meme avec service_role", async () => {
    const { error } = await admin.from("rulesets").update({ content_origin: "user_created" }).eq("id", personalRulesetId);
    expect(error).not.toBeNull();
    expect(error?.message).toContain("reference personnelle");
  });

  it("une variante user_created ordinaire reste librement modifiable (aucune surcapture par le nouveau trigger)", async () => {
    const { error } = await admin.from("rulesets").update({ name: "Variante test — renommee" }).eq("id", userCreatedRulesetId);
    expect(error).toBeNull();
  });
});
