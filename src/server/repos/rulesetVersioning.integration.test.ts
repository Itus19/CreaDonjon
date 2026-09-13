import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V1-A4 : sans ce test, rien ne prouve que les rulesets officiels restent
 * inviolables (CLAUDE.md regle 12) ni que "un ruleset publie est fige,
 * toute edition cree version + 1 avec le meme lineage_id" (SCHEMA.md §9.4)
 * fonctionne reellement — les deux sont des triggers/fonctions Postgres,
 * invisibles a `npm run test:core`.
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que publicShare.integration.test.ts).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("surcharge et versioning de ruleset (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let userId: string;
  let officialRulesetId: string;
  let variantRulesetId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const account = await getReusableTestAccount(admin, "owner");
    userId = account.id;
    userClient = account.client;

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");
    officialRulesetId = official.id;

    const { data: variant, error: variantError } = await admin
      .from("rulesets")
      .insert({
        name: "Variante de test integration",
        base_system: "dnd_srd_51",
        parent_ruleset_id: officialRulesetId,
        is_official_base: false,
        created_by: userId,
      })
      .select("id")
      .single();
    if (variantError || !variant) throw new Error(variantError?.message ?? "creation variante echouee");
    variantRulesetId = variant.id;
  });

  afterAll(async () => {
    // Toutes les versions creees pendant le test partagent created_by : les
    // supprimer par cle etrangere suffit, pas besoin de suivre lineage_id.
    if (userId) {
      await admin.from("rulesets").delete().eq("created_by", userId);
    }
  });

  it("le trigger forbid_official_ruleset_write empeche de renommer un ruleset officiel, meme avec service_role", async () => {
    const { error } = await admin.from("rulesets").update({ name: "Tentative de renommage" }).eq("id", officialRulesetId);
    expect(error).not.toBeNull();
    expect(error?.message).toContain("officiel");
  });

  it("le trigger forbid_official_ruleset_entry_write empeche de modifier une entree officielle", async () => {
    const { data: officialEntry, error: entryError } = await admin
      .from("ruleset_entries")
      .select("id")
      .eq("ruleset_id", officialRulesetId)
      .limit(1)
      .single();
    if (entryError || !officialEntry) throw new Error(entryError?.message ?? "aucune entree officielle a tester");

    const { error } = await admin.from("ruleset_entries").update({ ai_digest: "tentative" }).eq("id", officialEntry.id);
    expect(error).not.toBeNull();
    expect(error?.message).toContain("non modifiable");
  });

  it("upsert_ruleset_override refuse une surcharge directe sur un ruleset officiel", async () => {
    const { error } = await userClient.rpc("upsert_ruleset_override", {
      p_ruleset_id: officialRulesetId,
      p_entry_key: "fireball",
      p_block_type: "effects",
      p_action: "patch_block",
      p_payload: null,
      p_patch: { effects: [] },
      p_note: "tentative illegale",
    });
    expect(error).not.toBeNull();
  });

  it("upsert_ruleset_override refuse la surcharge d'un ruleset qui n'appartient pas a l'appelant", async () => {
    const { client: otherClient } = await getReusableTestAccount(admin, "outsider");

    const { error } = await otherClient.rpc("upsert_ruleset_override", {
      p_ruleset_id: variantRulesetId,
      p_entry_key: "fireball",
      p_block_type: "effects",
      p_action: "patch_block",
      p_payload: null,
      p_patch: {},
      p_note: "tentative d'un tiers",
    });
    expect(error).not.toBeNull();
  });

  it("editer un ruleset non publie modifie la meme ligne, pas de nouvelle version", async () => {
    const { data: targetId, error } = await userClient.rpc("upsert_ruleset_override", {
      p_ruleset_id: variantRulesetId,
      p_entry_key: "fireball",
      p_block_type: "effects",
      p_action: "patch_block",
      p_payload: null,
      p_patch: { effects: [{ id: "e1", damage_type: "Cold" }] },
      p_note: "premier changement",
    });
    expect(error).toBeNull();
    expect(targetId).toBe(variantRulesetId);
  });

  it("publier fige la version ; editer ensuite cree v+1 avec le meme lineage_id et copie les surcharges", async () => {
    const { error: publishError } = await userClient.rpc("publish_ruleset", { p_ruleset_id: variantRulesetId });
    expect(publishError).toBeNull();

    const { data: beforeRow } = await admin
      .from("rulesets")
      .select("lineage_id, version, published_at")
      .eq("id", variantRulesetId)
      .single();
    expect(beforeRow?.published_at).not.toBeNull();

    const { data: newRulesetId, error } = await userClient.rpc("upsert_ruleset_override", {
      p_ruleset_id: variantRulesetId,
      p_entry_key: "magic-missile",
      p_block_type: "effects",
      p_action: "patch_block",
      p_payload: null,
      p_patch: { effects: [{ id: "e1", damage_type: "Force" }] },
      p_note: "deuxieme changement, apres publication",
    });
    expect(error).toBeNull();
    expect(newRulesetId).not.toBe(variantRulesetId);

    const { data: newRow } = await admin
      .from("rulesets")
      .select("lineage_id, version, published_at")
      .eq("id", newRulesetId!)
      .single();
    expect(newRow?.lineage_id).toBe(beforeRow?.lineage_id);
    expect(newRow?.version).toBe((beforeRow?.version ?? 0) + 1);
    expect(newRow?.published_at).toBeNull();

    const { data: copiedOverride } = await admin
      .from("ruleset_overrides")
      .select("*")
      .eq("ruleset_id", newRulesetId!)
      .eq("entry_key", "fireball")
      .maybeSingle();
    expect(copiedOverride).not.toBeNull();

    const { data: newOverride } = await admin
      .from("ruleset_overrides")
      .select("*")
      .eq("ruleset_id", newRulesetId!)
      .eq("entry_key", "magic-missile")
      .maybeSingle();
    expect(newOverride).not.toBeNull();

    const { data: staleOverride } = await admin
      .from("ruleset_overrides")
      .select("*")
      .eq("ruleset_id", variantRulesetId)
      .eq("entry_key", "magic-missile")
      .maybeSingle();
    expect(staleOverride).toBeNull();
  });

  it("publish_ruleset est idempotent : publier deux fois ne change rien", async () => {
    const { data: before } = await admin.from("rulesets").select("published_at").eq("id", variantRulesetId).single();
    const { error } = await userClient.rpc("publish_ruleset", { p_ruleset_id: variantRulesetId });
    expect(error).toBeNull();
    const { data: after } = await admin.from("rulesets").select("published_at").eq("id", variantRulesetId).single();
    expect(after?.published_at).toBe(before?.published_at);
  });
});
