import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { canEditEntity } from "../../core/permissions/canEditEntity";
import type { Viewer } from "../../core/visibility/types";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

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

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    // Sept profils : proprietaire, editeur du monde (`world_members`), MJ
    // d'une campagne SANS role de monde separe (flux d'invitation par
    // email existant), un joueur qui revendique l'entite cible comme son
    // PJ, un joueur avec un `entity_grants` explicite sur elle, un simple
    // joueur sans lien avec elle, et un tiers hors du monde.
    const [owner, worldEditor, campaignGm, ownCharacterPlayer, grantedPlayer, plainPlayer, outsider] = await Promise.all([
      getReusableTestAccount(admin, "owner"),
      getReusableTestAccount(admin, "editor"),
      getReusableTestAccount(admin, "gm"),
      getReusableTestAccount(admin, "player"),
      getReusableTestAccount(admin, "playerB"),
      getReusableTestAccount(admin, "playerC"),
      getReusableTestAccount(admin, "outsider"),
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
    return { isOwnCharacter: profile === "ownCharacterPlayer", isGranted: profile === "grantedPlayer", isOwnPrivateNotes: false };
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

  it("entity_kind 'notes' : son createur peut la modifier, un autre membre du monde ne peut pas (5e cas de canEditEntity, V2-M7b)", async () => {
    const { data: notesEntity, error: insertError } = await clients.plainPlayer
      .from("entities")
      .insert({ world_id: worldId, slug: "notes-plainplayer-test", name: "Mes notes", entity_kind: "notes", created_by: userIds.plainPlayer })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);

    expect(canEditEntity(viewerFor("plainPlayer"), { isOwnCharacter: false, isGranted: false, isOwnPrivateNotes: true })).toBe(true);
    expect(canEditEntity(viewerFor("outsider"), { isOwnCharacter: false, isGranted: false, isOwnPrivateNotes: false })).toBe(false);

    const byCreator = await clients.plainPlayer.from("entities").update({ name: "Mes notes (modifiees)" }).eq("id", notesEntity.id).select("id");
    if (byCreator.error) throw new Error(byCreator.error.message);
    expect(byCreator.data?.length ?? 0).toBe(1);

    const byOtherMember = await clients.grantedPlayer.from("entities").update({ name: "Vole" }).eq("id", notesEntity.id).select("id");
    if (byOtherMember.error) throw new Error(byOtherMember.error.message);
    expect(byOtherMember.data?.length ?? 0).toBe(0);

    await admin.from("entities").delete().eq("id", notesEntity.id);
  });

  // V2.1-15 : ce test portait sur le 6e cas de `canEditEntity` (« c'est mon
  // entree du Livre de sessions »). Ce cas n'existe plus : l'autrice passe
  // par un vrai `entity_grants`, et c'est precisement ce qui rend le bouton
  // « Retirer » de l'outil de gestion de campagne operant sur elle. Le test
  // verifie donc maintenant le cycle complet — sans octroi, avec, puis apres
  // retrait — plutot que le seul verdict de depart.
  it("entity_kind 'session_journal' : l'autrice n'ecrit que par un octroi, que le MJ peut lui reprendre (V2.1-15)", async () => {
    const { data: journalEntity, error: insertError } = await clients.plainPlayer
      .from("entities")
      .insert({ world_id: worldId, slug: "journal-plainplayer-test", name: "Ce que la taverne a vu", entity_kind: "session_journal", created_by: userIds.plainPlayer })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    if (!journalEntity) throw new Error("entree de journal non creee");
    const journalEntityId = journalEntity.id;

    async function renameByAuthor(name: string): Promise<number> {
      const res = await clients.plainPlayer.from("entities").update({ name }).eq("id", journalEntityId).select("id");
      if (res.error) throw new Error(res.error.message);
      return res.data?.length ?? 0;
    }

    // Avoir cree la fiche ne suffit plus, des deux cotes du miroir.
    expect(canEditEntity(viewerFor("plainPlayer"), { isOwnCharacter: false, isGranted: false, isOwnPrivateNotes: false })).toBe(false);
    expect(await renameByAuthor("Sans octroi")).toBe(0);

    const { error: grantError } = await admin
      .from("entity_grants")
      .insert({ entity_id: journalEntity.id, user_id: userIds.plainPlayer, granted_by: userIds.campaignGm });
    if (grantError) throw new Error(grantError.message);

    expect(canEditEntity(viewerFor("plainPlayer"), { isOwnCharacter: false, isGranted: true, isOwnPrivateNotes: false })).toBe(true);
    expect(await renameByAuthor("Ce que la taverne a vu (corrige)")).toBe(1);

    // Le geste que l'outil de gestion de campagne declenche ("Retirer").
    await admin.from("entity_grants").delete().eq("entity_id", journalEntity.id).eq("user_id", userIds.plainPlayer);
    expect(await renameByAuthor("Apres retrait")).toBe(0);

    // Un autre membre du monde n'a jamais rien pu, le MJ toujours tout.
    const byOtherMember = await clients.grantedPlayer.from("entities").update({ name: "Vole" }).eq("id", journalEntity.id).select("id");
    if (byOtherMember.error) throw new Error(byOtherMember.error.message);
    expect(byOtherMember.data?.length ?? 0).toBe(0);

    const byGm = await clients.campaignGm.from("entities").update({ name: "Corrige par le MJ" }).eq("id", journalEntity.id).select("id");
    if (byGm.error) throw new Error(byGm.error.message);
    expect(byGm.data?.length ?? 0).toBe(1);

    await admin.from("entities").delete().eq("id", journalEntity.id);
  });
});
