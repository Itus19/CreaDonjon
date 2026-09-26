import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { discoverEntity, listDiscoveredEntityIds } from "./discoveries";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3-C4 — `entity_discoveries` n'avait jamais été écrite avant ce ticket :
 * ce test confirme l'écriture/lecture réelles (l'index unique fondé sur
 * `coalesce(user_id, ...)`, le respect de la promotion) contre la vraie
 * table, que les tests purs et les tests avec dépôt simulé (`discoveries.test.ts`)
 * ne peuvent pas exercer.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("discoverEntity / listDiscoveredEntityIds (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let worldId: string;
  let campaignId: string;
  let entityId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    userId = (await getReusableTestAccount(admin, "owner")).id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — decouvertes", slug: `test-discoveries-${Date.now()}`, owner_id: userId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: official, error: officialError } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne test", ruleset_id: official.id, mode: "solo" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, name: "Village test", entity_kind: "location", slug: `village-decouverte-${Date.now()}`, created_by: userId })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    entityId = entity.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("cree la ligne au premier appel, puis la fait progresser sans jamais regresser", async () => {
    await discoverEntity(admin, { campaignId, userId, entityId, level: "mentioned" });
    let ids = await listDiscoveredEntityIds(admin, campaignId, userId);
    expect(ids.has(entityId)).toBe(true);

    const { data: afterMentioned } = await admin.from("entity_discoveries").select("detail_level").eq("campaign_id", campaignId).eq("entity_id", entityId).single();
    expect(afterMentioned!.detail_level).toBe("mentioned");

    await discoverEntity(admin, { campaignId, userId, entityId, level: "known" });
    const { data: afterKnown } = await admin.from("entity_discoveries").select("detail_level").eq("campaign_id", campaignId).eq("entity_id", entityId).single();
    expect(afterKnown!.detail_level).toBe("known");

    await discoverEntity(admin, { campaignId, userId, entityId, level: "mentioned" });
    const { data: afterRegressAttempt } = await admin.from("entity_discoveries").select("detail_level").eq("campaign_id", campaignId).eq("entity_id", entityId).single();
    expect(afterRegressAttempt!.detail_level).toBe("known");

    ids = await listDiscoveredEntityIds(admin, campaignId, userId);
    expect(ids).toEqual(new Set([entityId]));
  });
});
