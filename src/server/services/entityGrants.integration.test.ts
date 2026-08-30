import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { isWorldAdmin } from "./permissions";
import { grantEntityEditAccess, listGrantsForEntity, revokeEntityEditAccess } from "./entityGrants";

/**
 * V2-M7 (Lot M) : `isWorldAdmin` (miroir SQL de `app.is_world_admin`) et les
 * trois services `entity_grants` (`grantEntityEditAccess`/
 * `revokeEntityEditAccess`/`listGrantsForEntity`) contre une vraie base —
 * meme motif que `canEditEntityRls.integration.test.ts` pour `canEditEntity`.
 * Sans ce test, rien ne prouve que le panneau MJ (octroi d'edition) est
 * vraiment reserve au MJ plutot que de simplement compiler.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("isWorldAdmin et entity_grants (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let worldId: string;
  let campaignId: string;
  let targetEntityId: string;

  const userIds: Record<string, string> = {};
  const clients: Record<string, SupabaseClient> = {};

  async function createProfile(key: string): Promise<{ id: string; client: SupabaseClient }> {
    const email = `integration-test-grants-${key}-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? `creation ${key} echouee`);
    const client = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(signInError.message);
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const [owner, worldEditor, campaignGm, plainPlayer, outsider] = await Promise.all([
      createProfile("owner"),
      createProfile("world-editor"),
      createProfile("campaign-gm"),
      createProfile("plain-player"),
      createProfile("outsider"),
    ]);
    userIds.owner = owner.id;
    clients.owner = owner.client;
    userIds.worldEditor = worldEditor.id;
    clients.worldEditor = worldEditor.client;
    userIds.campaignGm = campaignGm.id;
    clients.campaignGm = campaignGm.client;
    userIds.plainPlayer = plainPlayer.id;
    clients.plainPlayer = plainPlayer.client;
    userIds.outsider = outsider.id;
    clients.outsider = outsider.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test octrois", slug: `integration-test-grants-${Date.now()}`, owner_id: userIds.owner })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { error: memberError } = await admin
      .from("world_members")
      .insert({ world_id: worldId, user_id: userIds.worldEditor, role: "editor" });
    if (memberError) throw new Error(memberError.message);

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;

    const { error: membersError } = await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: userIds.campaignGm, role: "gm" },
      { campaign_id: campaignId, user_id: userIds.plainPlayer, role: "player" },
    ]);
    if (membersError) throw new Error(membersError.message);

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "cible-octroi", name: "Cible d'octroi", entity_kind: "character", created_by: userIds.owner })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    targetEntityId = entity.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    for (const id of Object.values(userIds)) await admin.auth.admin.deleteUser(id);
  });

  it("isWorldAdmin : proprietaire, editeur et MJ de campagne sont admin ; un simple joueur et un tiers ne le sont pas", async () => {
    expect(await isWorldAdmin(clients.owner, { worldId, userId: userIds.owner })).toBe(true);
    expect(await isWorldAdmin(clients.worldEditor, { worldId, userId: userIds.worldEditor })).toBe(true);
    expect(await isWorldAdmin(clients.campaignGm, { worldId, userId: userIds.campaignGm })).toBe(true);
    expect(await isWorldAdmin(clients.plainPlayer, { worldId, userId: userIds.plainPlayer })).toBe(false);
    expect(await isWorldAdmin(clients.outsider, { worldId, userId: userIds.outsider })).toBe(false);
  });

  it("grantEntityEditAccess : le MJ (proprietaire) peut accorder, un simple joueur ne peut pas", async () => {
    const byPlayer = await grantEntityEditAccess(clients.plainPlayer, {
      entityId: targetEntityId,
      granteeUserId: userIds.plainPlayer,
      callerId: userIds.plainPlayer,
    });
    expect(byPlayer).toEqual({ ok: false, reason: "forbidden" });

    const byOwner = await grantEntityEditAccess(clients.owner, {
      entityId: targetEntityId,
      granteeUserId: userIds.plainPlayer,
      callerId: userIds.owner,
    });
    expect(byOwner).toEqual({ ok: true });
  });

  it("listGrantsForEntity : le MJ voit l'octroi accorde ci-dessus, un simple joueur est refuse", async () => {
    const asOwner = await listGrantsForEntity(clients.owner, { entityId: targetEntityId, callerId: userIds.owner });
    expect(asOwner.ok).toBe(true);
    if (asOwner.ok) {
      expect(asOwner.grants.map((g) => g.user_id)).toContain(userIds.plainPlayer);
    }

    const asPlayer = await listGrantsForEntity(clients.plainPlayer, { entityId: targetEntityId, callerId: userIds.plainPlayer });
    expect(asPlayer).toEqual({ ok: false, reason: "forbidden" });
  });

  it("revokeEntityEditAccess : le MJ peut retirer l'octroi, un simple joueur ne peut pas ; une entite inconnue renvoie not_found", async () => {
    const byPlayer = await revokeEntityEditAccess(clients.plainPlayer, {
      entityId: targetEntityId,
      granteeUserId: userIds.plainPlayer,
      callerId: userIds.plainPlayer,
    });
    expect(byPlayer).toEqual({ ok: false, reason: "forbidden" });

    const unknownEntity = await revokeEntityEditAccess(clients.owner, {
      entityId: "00000000-0000-0000-0000-000000000000",
      granteeUserId: userIds.plainPlayer,
      callerId: userIds.owner,
    });
    expect(unknownEntity).toEqual({ ok: false, reason: "not_found" });

    const byOwner = await revokeEntityEditAccess(clients.owner, {
      entityId: targetEntityId,
      granteeUserId: userIds.plainPlayer,
      callerId: userIds.owner,
    });
    expect(byOwner).toEqual({ ok: true });

    const afterRevoke = await listGrantsForEntity(clients.owner, { entityId: targetEntityId, callerId: userIds.owner });
    expect(afterRevoke.ok).toBe(true);
    if (afterRevoke.ok) {
      expect(afterRevoke.grants.map((g) => g.user_id)).not.toContain(userIds.plainPlayer);
    }
  });
});
