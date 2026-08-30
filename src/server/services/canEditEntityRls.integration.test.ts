import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { canEditEntity } from "../../core/permissions/canEditEntity";
import type { Viewer } from "../../core/visibility/types";

/**
 * V2-M3 (Lot M) : compare, pour chaque profil, le verdict de la table de
 * verite pure (`canEditEntity`, src/core/permissions) au verdict reel
 * obtenu par une ECRITURE RLS-gatee (migration
 * 20260830110001_entity_grants_and_write_rls.sql). Meme motif que
 * `visibilityRls.integration.test.ts` pour la LECTURE — sans ce test, rien
 * ne prouve que `app.can_edit_entity`/`app.is_world_admin` reproduisent
 * vraiment `canEditEntity()` plutot que de simplement compiler.
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("resserrement de la RLS d'ecriture (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let worldId: string;
  let campaignId: string;
  let targetEntityId: string;

  const userIds: Record<string, string> = {};
  const clients: Record<string, SupabaseClient> = {};

  async function createProfile(key: string): Promise<{ id: string; client: SupabaseClient }> {
    const email = `integration-test-edit-${key}-${Date.now()}@creadonjon.local`;
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

    // Six profils : proprietaire, editeur du monde (`world_members`), MJ
    // d'une campagne SANS role de monde separe (flux d'invitation par
    // email existant), un joueur qui revendique l'entite cible comme son
    // PJ, un joueur avec un `entity_grants` explicite sur elle, un simple
    // joueur sans lien avec elle, et un tiers hors du monde.
    const [owner, worldEditor, campaignGm, ownCharacterPlayer, grantedPlayer, plainPlayer, outsider] = await Promise.all([
      createProfile("owner"),
      createProfile("world-editor"),
      createProfile("campaign-gm"),
      createProfile("own-character-player"),
      createProfile("granted-player"),
      createProfile("plain-player"),
      createProfile("outsider"),
    ]);
    userIds.owner = owner.id;
    clients.owner = owner.client;
    userIds.worldEditor = worldEditor.id;
    clients.worldEditor = worldEditor.client;
    userIds.campaignGm = campaignGm.id;
    clients.campaignGm = campaignGm.client;
    userIds.ownCharacterPlayer = ownCharacterPlayer.id;
    clients.ownCharacterPlayer = ownCharacterPlayer.client;
    userIds.grantedPlayer = grantedPlayer.id;
    clients.grantedPlayer = grantedPlayer.client;
    userIds.plainPlayer = plainPlayer.id;
    clients.plainPlayer = plainPlayer.client;
    userIds.outsider = outsider.id;
    clients.outsider = outsider.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test edition", slug: `integration-test-edit-${Date.now()}`, owner_id: userIds.owner })
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
      { campaign_id: campaignId, user_id: userIds.ownCharacterPlayer, role: "player" },
      { campaign_id: campaignId, user_id: userIds.grantedPlayer, role: "player" },
      { campaign_id: campaignId, user_id: userIds.plainPlayer, role: "player" },
    ]);
    if (membersError) throw new Error(membersError.message);

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "cible-edition", name: "Cible d'edition", entity_kind: "character", created_by: userIds.owner })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    targetEntityId = entity.id;

    const { error: characterError } = await admin
      .from("campaign_characters")
      .insert({ campaign_id: campaignId, entity_id: targetEntityId, user_id: userIds.ownCharacterPlayer, is_pc: true });
    if (characterError) throw new Error(characterError.message);

    const { error: grantError } = await admin
      .from("entity_grants")
      .insert({ entity_id: targetEntityId, user_id: userIds.grantedPlayer, granted_by: userIds.owner });
    if (grantError) throw new Error(grantError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    for (const id of Object.values(userIds)) await admin.auth.admin.deleteUser(id);
  });

  function viewerFor(profile: string): Viewer {
    switch (profile) {
      case "owner":
        return { kind: "user", userId: userIds.owner, worldRole: "owner", campaignRoles: {} };
      case "worldEditor":
        return { kind: "user", userId: userIds.worldEditor, worldRole: "editor", campaignRoles: {} };
      case "campaignGm":
        return { kind: "user", userId: userIds.campaignGm, worldRole: null, campaignRoles: { [campaignId]: "gm" } };
      case "ownCharacterPlayer":
        return { kind: "user", userId: userIds.ownCharacterPlayer, worldRole: null, campaignRoles: { [campaignId]: "player" } };
      case "grantedPlayer":
        return { kind: "user", userId: userIds.grantedPlayer, worldRole: null, campaignRoles: { [campaignId]: "player" } };
      case "plainPlayer":
        return { kind: "user", userId: userIds.plainPlayer, worldRole: null, campaignRoles: { [campaignId]: "player" } };
      case "outsider":
        return { kind: "user", userId: userIds.outsider, worldRole: null, campaignRoles: {} };
      default:
        throw new Error(`profil inconnu : ${profile}`);
    }
  }

  const PROFILES = [
    "owner",
    "worldEditor",
    "campaignGm",
    "ownCharacterPlayer",
    "grantedPlayer",
    "plainPlayer",
    "outsider",
  ] as const;

  function ctxFor(profile: string) {
    return { isOwnCharacter: profile === "ownCharacterPlayer", isGranted: profile === "grantedPlayer" };
  }

  async function canRenameEntity(client: SupabaseClient, name: string): Promise<boolean> {
    const { data, error } = await client.from("entities").update({ name }).eq("id", targetEntityId).select("id");
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  }

  it("UPDATE entities : chaque profil obtient exactement le verdict de canEditEntity()", async () => {
    for (const profile of PROFILES) {
      const pureResult = canEditEntity(viewerFor(profile), ctxFor(profile));
      const rlsResult = await canRenameEntity(clients[profile], `Cible d'edition (${profile})`);
      expect(rlsResult, profile).toBe(pureResult);
    }
  });

  async function canInsertBlock(client: SupabaseClient): Promise<boolean> {
    const { data, error } = await client
      .from("blocks")
      .insert({
        entity_id: targetEntityId,
        block_type: "text",
        display: { label: "Test", layout: "prose" },
        data: { __v: 1, segments: [] },
        visibility_level: "public",
        visibility_scope_id: null,
      })
      .select("id");
    if (error) return false;
    return (data?.length ?? 0) > 0;
  }

  it("INSERT blocks : meme verdict que canEditEntity() sur l'entite hote", async () => {
    for (const profile of PROFILES) {
      const pureResult = canEditEntity(viewerFor(profile), ctxFor(profile));
      const rlsResult = await canInsertBlock(clients[profile]);
      expect(rlsResult, profile).toBe(pureResult);
    }
  });

  it("un simple joueur sans revendication ni octroi ne peut pas supprimer la fiche", async () => {
    const { data, error } = await clients.plainPlayer.from("entities").delete().eq("id", targetEntityId).select("id");
    if (error) throw new Error(error.message);
    expect(data?.length ?? 0).toBe(0);
  });

  it("campaigns/campaign_members : un simple joueur ne peut plus renommer la campagne ni s'auto-promouvoir MJ (is_world_admin, pas is_world_member)", async () => {
    const rename = await clients.plainPlayer.from("campaigns").update({ name: "Campagne detournee" }).eq("id", campaignId).select("id");
    if (rename.error) throw new Error(rename.error.message);
    expect(rename.data?.length ?? 0).toBe(0);

    const selfPromote = await clients.plainPlayer
      .from("campaign_members")
      .update({ role: "gm" })
      .eq("campaign_id", campaignId)
      .eq("user_id", userIds.plainPlayer)
      .select("campaign_id");
    if (selfPromote.error) throw new Error(selfPromote.error.message);
    expect(selfPromote.data?.length ?? 0).toBe(0);
  });

  it("campaigns : le MJ de campagne peut renommer sans etre proprietaire/editeur du monde (is_world_admin)", async () => {
    const { data, error } = await clients.campaignGm.from("campaigns").update({ name: "Campagne renommee par le MJ" }).eq("id", campaignId).select("id");
    if (error) throw new Error(error.message);
    expect(data?.length ?? 0).toBe(1);
  });
});
