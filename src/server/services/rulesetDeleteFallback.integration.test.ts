import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";
import { deleteRulesetVariantFromWorld } from "./rules";

/**
 * V3.1-57 — supprimer la variante ACTIVE depuis Règles actives : le monde et
 * sa campagne reviennent à la base, puis la variante disparaît. Si elle ne
 * peut pas disparaître (base d'une autre variante), le monde la reprend.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("supprimer la variante active (V3.1-57, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let officialId: string;
  let worldId: string;
  let worldSlug: string;
  let campaignId: string;
  const rulesetIds: string[] = [];

  const typed = () => gm.client as unknown as SupabaseClient<Database>;
  async function variante(nom: string, parentId: string): Promise<string> {
    const { data, error } = await admin
      .from("rulesets")
      .insert({ name: nom, base_system: "dnd_srd_52", parent_ruleset_id: parentId, created_by: gm.id, content_origin: "user_created" })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "variante");
    rulesetIds.push(data.id);
    return data.id;
  }
  async function actif(): Promise<{ monde: string | null; campagne: string | null }> {
    const [{ data: w }, { data: c }] = await Promise.all([
      admin.from("worlds").select("default_ruleset_id").eq("id", worldId).single(),
      admin.from("campaigns").select("ruleset_id").eq("id", campaignId).single(),
    ]);
    return { monde: w?.default_ruleset_id ?? null, campagne: c?.ruleset_id ?? null };
  }
  async function activer(id: string) {
    await admin.from("worlds").update({ default_ruleset_id: id }).eq("id", worldId);
    await admin.from("campaigns").update({ ruleset_id: id }).eq("id", campaignId);
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    gm = await getReusableTestAccount(admin, "gm");
    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).eq("base_system", "dnd_srd_52").limit(1).single();
    officialId = official!.id;
    worldSlug = `integration-test-ruleset-delete-${Date.now()}`;
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test suppression de variante", slug: worldSlug, owner_id: gm.id, default_ruleset_id: officialId })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: officialId, mode: "campaign", gm_user_id: gm.id })
      .select("id")
      .single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert({ campaign_id: campaignId, user_id: gm.id, role: "gm" });
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    for (const id of [...rulesetIds].reverse()) await admin.from("rulesets").delete().eq("id", id);
  });

  it("la variante active disparaît, le monde et la campagne reviennent à sa base", async () => {
    const id = await variante("Variante de test active", officialId);
    await activer(id);
    expect(await deleteRulesetVariantFromWorld(typed(), { worldSlug, rulesetId: id })).toBe("deleted");
    expect(await actif()).toEqual({ monde: officialId, campagne: officialId });
    const { data } = await admin.from("rulesets").select("id").eq("id", id);
    expect(data ?? []).toEqual([]);
  });

  it("base d'une autre variante : refusée, et le monde garde la variante", async () => {
    const mere = await variante("Variante de test mère", officialId);
    await variante("Variante de test fille", mere);
    await activer(mere);
    expect(await deleteRulesetVariantFromWorld(typed(), { worldSlug, rulesetId: mere })).toBe("in_use");
    expect(await actif()).toEqual({ monde: mere, campagne: mere });
  });

  it("une variante inactive se supprime sans toucher au ruleset du monde", async () => {
    await activer(officialId);
    const id = await variante("Variante de test inactive", officialId);
    expect(await deleteRulesetVariantFromWorld(typed(), { worldSlug, rulesetId: id })).toBe("deleted");
    expect(await actif()).toEqual({ monde: officialId, campagne: officialId });
  });
});
