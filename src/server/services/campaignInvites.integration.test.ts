import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  claimInvite,
  createCampaignInvite,
  listUnclaimedCharactersForToken,
  resolveDestinationForInvitedUser,
  resolveInviteForJoin,
  revokeInvite,
  setInvitePassword,
  verifyInvitePassword,
} from "./campaignInvites";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V2-M4 (Lot M), mis a jour pour V3.1-10 (ADR 0031) : verifie contre une
 * vraie base le mecanisme le plus sensible du lot. Couvre : resolution
 * anonyme du jeton, liste des personnages non reclames (elle aussi
 * anonyme), reclamation course-safe (deux visiteurs ne peuvent pas prendre
 * le meme personnage), et reouverture d'un lien MJ deja reclame qui
 * reconnecte le MEME compte par lien magique.
 *
 * Depuis V3.1-10, `claimInvite` n'ouvre plus de compte : la personne en a
 * deja un (cree par `accountAuth.createTagAccount`, ou sa session courante)
 * et le passe en `existingUserId`. Les « visiteurs » de ce fichier sont donc
 * des comptes du groupe fixe (docs/TESTS.md §2) : aucun compte n'est cree
 * ni supprime ici.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("liens d'invitation (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let ownerClient: SupabaseClient;
  let ownerId: string;
  let worldId: string;
  let campaignId: string;
  let entityAId: string;
  let entityBId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const owner = await getReusableTestAccount(admin, "owner");
    ownerId = owner.id;
    ownerClient = owner.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test invitations", slug: `integration-test-invites-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

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

    const { data: entities, error: entitiesError } = await admin
      .from("entities")
      .insert([
        { world_id: worldId, slug: "pj-a", name: "PJ A", entity_kind: "character", created_by: ownerId },
        { world_id: worldId, slug: "pj-b", name: "PJ B", entity_kind: "character", created_by: ownerId },
      ])
      .select("id, slug");
    if (entitiesError || !entities) throw new Error(entitiesError?.message ?? "creation entites echouee");
    entityAId = entities.find((e) => e.slug === "pj-a")!.id;
    entityBId = entities.find((e) => e.slug === "pj-b")!.id;

    const { error: charactersError } = await admin.from("campaign_characters").insert([
      { campaign_id: campaignId, entity_id: entityAId, is_pc: true, user_id: null },
      { campaign_id: campaignId, entity_id: entityBId, is_pc: true, user_id: null },
    ]);
    if (charactersError) throw new Error(charactersError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    // Les comptes du groupe fixe ne sont jamais supprimes : leurs roles et
    // personnages partent avec le monde (cascade).
  });

  it("un jeton invalide ne resout a rien", async () => {
    const anon = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const result = await resolveInviteForJoin(anon, "jeton-qui-n-existe-pas");
    expect(result.ok).toBe(false);
  });

  it("cree un lien, le resout anonymement, liste les personnages non reclames, reclame un PJ et etablit une vraie session", async () => {
    const { token } = await createCampaignInvite(ownerClient, {
      campaignId,
      worldId: null,
      intendedRole: "player",
      createdBy: ownerId,
    });

    // Un visiteur SANS SESSION doit pouvoir resoudre le jeton et voir la liste.
    const anon = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const resolved = await resolveInviteForJoin(anon, token);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.invite.claimedByUserId).toBeNull();
    expect(resolved.invite.intendedRole).toBe("player");

    const characters = await listUnclaimedCharactersForToken(anon, token);
    expect(characters.map((c) => c.entityId).sort()).toEqual([entityAId, entityBId].sort());

    // Le visiteur a deja son compte (V3.1-10) : il le passe, et garde sa session.
    const visitor = await getReusableTestAccount(admin, "playerB");
    const claim = await claimInvite({
      invite: resolved.invite,
      claim: { role: "player", name: "Jérémy", entityId: entityAId },
      existingUserId: visitor.id,
    });
    expect(claim).toEqual({ ok: true, tokenHash: null });

    // La destination calculee doit pointer vers la fiche du personnage reclame.
    const destination = await resolveDestinationForInvitedUser(visitor.client, resolved.invite, visitor.id);
    expect(destination).toContain("/f/pj-a");

    // La fiche revendiquee n'apparait plus dans la liste des personnages libres.
    const anon2 = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const remaining = await listUnclaimedCharactersForToken(anon2, token);
    expect(remaining.map((c) => c.entityId)).toEqual([entityBId]);
  });

  it("deux visiteurs ne peuvent pas reclamer le meme personnage (course-safe)", async () => {
    const { token } = await createCampaignInvite(ownerClient, { campaignId, worldId: null, intendedRole: "player", createdBy: ownerId });
    const anon = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const resolved = await resolveInviteForJoin(anon, token);
    if (!resolved.ok) throw new Error("resolution echouee");

    const [antoine, concurrent] = await Promise.all([getReusableTestAccount(admin, "playerC"), getReusableTestAccount(admin, "viewer")]);
    const [first, second] = await Promise.all([
      claimInvite({ invite: resolved.invite, claim: { role: "player", name: "Antoine", entityId: entityBId }, existingUserId: antoine.id }),
      claimInvite({ invite: { ...resolved.invite }, claim: { role: "player", name: "Concurrent", entityId: entityBId }, existingUserId: concurrent.id }),
    ]);
    const results = [first, second];
    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    // Lien joueur reutilisable (V3.1-10) : la course se joue sur le
    // PERSONNAGE (`is("user_id", null)`), jamais sur le lien.
    if (failed[0] && !failed[0].ok) expect(failed[0].reason).toBe("character_already_taken");
    const { data } = await admin.from("campaign_characters").select("user_id").eq("entity_id", entityBId).single();
    expect([antoine.id, concurrent.id]).toContain(data?.user_id);
  });

  it("un lien deja reclame reconnecte le MEME compte a la reouverture, sans redemander de role", async () => {
    const { token } = await createCampaignInvite(ownerClient, { campaignId, worldId: null, intendedRole: "gm", createdBy: ownerId });
    const anon = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });

    const firstResolve = await resolveInviteForJoin(anon, token);
    if (!firstResolve.ok) throw new Error("resolution echouee");
    const jeremy = await getReusableTestAccount(admin, "editor");
    const firstClaim = await claimInvite({ invite: firstResolve.invite, claim: { role: "gm", name: "Jérémy MJ" }, existingUserId: jeremy.id });
    expect(firstClaim).toEqual({ ok: true, tokenHash: null });

    // Reouverture, depuis un navigateur SANS session : meme jeton, aucune information de role/nom fournie.
    const secondResolve = await resolveInviteForJoin(anon, token);
    if (!secondResolve.ok) throw new Error("seconde resolution echouee");
    expect(secondResolve.invite.claimedByUserId).toBe(jeremy.id);

    const secondClaim = await claimInvite({ invite: secondResolve.invite });
    if (!secondClaim.ok) throw new Error("reouverture echouee");
    if (!secondClaim.tokenHash) throw new Error("reouverture sans existingUserId : un tokenHash est toujours attendu ici");
    const { data: secondSession, error: secondError } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: secondClaim.tokenHash });
    if (secondError || !secondSession.user) throw new Error("seconde session echouee");

    expect(secondSession.user.id).toBe(jeremy.id);
  });

  it("un lien revoque ne resout plus a rien, meme deja reclame", async () => {
    const { invite, token } = await createCampaignInvite(ownerClient, { campaignId, worldId: null, intendedRole: "gm", createdBy: ownerId });
    await admin.from("campaign_invites").update({ revoked_at: new Date().toISOString() }).eq("id", invite.id);

    const anon = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const resolved = await resolveInviteForJoin(anon, token);
    expect(resolved.ok).toBe(false);
  });

  it("un lien protege refuse un mauvais mot de passe et accepte le bon, avec verrouillage au-dela de 10 essais", async () => {
    const { token } = await createCampaignInvite(ownerClient, {
      campaignId,
      worldId: null,
      intendedRole: "player",
      password: "secret-jeremy",
      createdBy: ownerId,
    });
    const anon = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });

    expect(await verifyInvitePassword(anon, token, "mauvais-mot-de-passe")).toBe("wrong");
    expect(await verifyInvitePassword(anon, token, "secret-jeremy")).toBe("ok");

    for (let i = 0; i < 10; i++) {
      await verifyInvitePassword(anon, token, "encore-mauvais");
    }
    expect(await verifyInvitePassword(anon, token, "secret-jeremy")).toBe("locked");
  });

  it("le mot de passe est modifiable par le proprietaire du monde, par la personne qui a reclame le lien, mais pas par un tiers", async () => {
    const { invite, token } = await createCampaignInvite(ownerClient, { campaignId, worldId: null, intendedRole: "gm", createdBy: ownerId });
    const anon = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const resolved = await resolveInviteForJoin(anon, token);
    if (!resolved.ok) throw new Error("resolution echouee");
    const antoine = await getReusableTestAccount(admin, "editor");
    const claim = await claimInvite({ invite: resolved.invite, claim: { role: "gm", name: "Antoine MJ" }, existingUserId: antoine.id });
    if (!claim.ok) throw new Error("reclamation echouee");

    // Le proprietaire du monde peut poser un mot de passe.
    const byOwner = await setInvitePassword(ownerClient, { inviteId: invite.id, password: "pose-par-le-mj" });
    expect(byOwner.allowed).toBe(true);

    // La personne qui a reclame ce lien peut le changer elle-meme.
    const byClaimant = await setInvitePassword(antoine.client, { inviteId: invite.id, password: "change-par-lui-meme" });
    expect(byClaimant.allowed).toBe(true);

    // Un tiers sans lien avec cette invitation ne le peut pas.
    const { client: outsiderClient } = await getReusableTestAccount(admin, "outsider");

    const byOutsider = await setInvitePassword(outsiderClient, { inviteId: invite.id, password: "vole-par-un-tiers" });
    expect(byOutsider.allowed).toBe(false);
  });

  it("une session deja ouverte qui reclame un second lien ajoute le role au MEME compte, jamais un second (retour utilisateur : MJ dans un monde ET joueur dans un autre)", async () => {
    // Deuxieme monde/campagne, distinct de la fixture partagee : c'est
    // precisement le scenario "un role different dans un AUTRE monde".
    const { data: secondWorld, error: secondWorldError } = await admin
      .from("worlds")
      .insert({ name: "Second monde de test invitations", slug: `integration-test-invites-2-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (secondWorldError || !secondWorld) throw new Error(secondWorldError?.message ?? "creation second monde echouee");

    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    const { data: secondCampaign, error: secondCampaignError } = await admin
      .from("campaigns")
      .insert({ world_id: secondWorld.id, name: "Seconde campagne de test", ruleset_id: official!.id, mode: "campaign" })
      .select("id")
      .single();
    if (secondCampaignError || !secondCampaign) throw new Error(secondCampaignError?.message ?? "creation seconde campagne echouee");

    // Un troisieme personnage, dedie a ce test : `entityAId`/`entityBId`
    // sont deja reclames par des tests precedents de ce meme fichier.
    const { data: entityC, error: entityCError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: `pj-c-${Date.now()}`, name: "PJ C", entity_kind: "character", created_by: ownerId })
      .select("id")
      .single();
    if (entityCError || !entityC) throw new Error(entityCError?.message ?? "creation entite echouee");
    const { error: entityCCharacterError } = await admin
      .from("campaign_characters")
      .insert({ campaign_id: campaignId, entity_id: entityC.id, is_pc: true, user_id: null });
    if (entityCCharacterError) throw new Error(entityCCharacterError.message);

    try {
      // Premier lien : Jeremy rejoint comme JOUEUR sur la campagne de la fixture.
      const { token: firstToken } = await createCampaignInvite(ownerClient, {
        campaignId,
        worldId: null,
        intendedRole: "player",
        createdBy: ownerId,
      });
      const jeremy = await getReusableTestAccount(admin, "gm");
      const anon = jeremy.client;
      const firstResolved = await resolveInviteForJoin(anon, firstToken);
      if (!firstResolved.ok) throw new Error("premiere resolution echouee");
      const firstClaim = await claimInvite({
        invite: firstResolved.invite,
        claim: { role: "player", name: "Jérémy", entityId: entityC.id },
        existingUserId: jeremy.id,
      });
      if (!firstClaim.ok) throw new Error("premiere reclamation echouee");
      const firstSession = { user: { id: jeremy.id } };

      // Deuxieme lien, SUR LE SECOND MONDE, reclame en tant que MJ — avec la
      // session deja ouverte de ce compte : le role s'ajoute au MEME compte.
      const { token: secondToken } = await createCampaignInvite(ownerClient, {
        campaignId: secondCampaign.id,
        worldId: null,
        intendedRole: "gm",
        createdBy: ownerId,
      });
      const secondResolved = await resolveInviteForJoin(anon, secondToken);
      if (!secondResolved.ok) throw new Error("seconde resolution echouee");
      const {
        data: { user: sessionBeforeSecondClaim },
      } = await anon.auth.getUser();
      const secondClaim = await claimInvite({
        invite: secondResolved.invite,
        claim: { role: "gm", name: "Jérémy MJ" },
        existingUserId: sessionBeforeSecondClaim?.id,
      });
      if (!secondClaim.ok) throw new Error("seconde reclamation echouee");

      // Aucune nouvelle session necessaire : c'est le signal que le role
      // s'est ajoute au compte courant, pas a un nouveau.
      expect(secondClaim.tokenHash).toBeNull();

      // Le MEME compte porte desormais les deux roles, sur deux mondes distincts.
      const { data: membership } = await anon
        .from("campaign_members")
        .select("campaign_id, role")
        .eq("user_id", firstSession.user.id);
      const roles = new Map(membership?.map((m) => [m.campaign_id, m.role]));
      expect(roles.get(campaignId)).toBe("player");
      expect(roles.get(secondCampaign.id)).toBe("gm");
    } finally {
      await admin.from("worlds").delete().eq("id", secondWorld.id);
    }
  });

  it("revoquer un lien JOUEUR herite de l'ancien regime n'expulse pas qui s'en est servi (bug V3.1-15, migration 20261001140000)", async () => {
    const player = await getReusableTestAccount(admin, "player");
    const { invite } = await createCampaignInvite(ownerClient, { campaignId, worldId: null, intendedRole: "player", createdBy: ownerId });
    // Ancien regime a usage unique (avant V3.1-10) : le lien joueur porte
    // encore `claimed_by_user_id`.
    await admin.from("campaign_invites").update({ claimed_by_user_id: player.id, claimed_name: "Joueuse d'avant" }).eq("id", invite.id);
    await admin.from("campaign_members").upsert({ campaign_id: campaignId, user_id: player.id, role: "player" }, { onConflict: "campaign_id,user_id" });

    try {
      const result = await revokeInvite(ownerClient, invite.id);
      expect(result).toMatchObject({ allowed: true, revoked: true, removedMember: false, releasedCharacter: false });
      const { data: member } = await admin.from("campaign_members").select("user_id").eq("campaign_id", campaignId).eq("user_id", player.id).maybeSingle();
      expect(member).not.toBeNull();
    } finally {
      await admin.from("campaign_members").delete().eq("campaign_id", campaignId).eq("user_id", player.id);
    }
  });
});
