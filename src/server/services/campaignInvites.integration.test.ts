import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  claimInvite,
  createCampaignInvite,
  listUnclaimedCharactersForToken,
  resolveDestinationForInvitedUser,
  resolveInviteForJoin,
} from "./campaignInvites";

/**
 * V2-M4 (Lot M) : verifie contre une vraie base le mecanisme le plus
 * sensible du lot — un ami obtient un compte reel et une session, sans
 * jamais voir d'email ni de mot de passe, uniquement via un jeton
 * d'invitation. Couvre : resolution anonyme du jeton, liste des
 * personnages non reclames (elle aussi anonyme), reclamation course-safe
 * (deux visiteurs ne peuvent pas prendre le meme personnage), etablissement
 * reel d'une session via `verifyOtp`, et reouverture du meme lien plus
 * tard qui reconnecte le MEME compte sans jamais redemander le role.
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
  const createdInvitedUserIds: string[] = [];

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `integration-test-invites-owner-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (userError || !userData.user) throw new Error(userError?.message ?? "creation proprietaire echouee");
    ownerId = userData.user.id;
    ownerClient = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await ownerClient.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(signInError.message);

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
    for (const id of [ownerId, ...createdInvitedUserIds]) if (id) await admin.auth.admin.deleteUser(id);
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

    const claim = await claimInvite({ invite: resolved.invite, claim: { role: "player", name: "Jérémy", entityId: entityAId } });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;

    const { data: verified, error: verifyError } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: claim.tokenHash });
    if (verifyError || !verified.user) throw new Error(verifyError?.message ?? "session non etablie");
    createdInvitedUserIds.push(verified.user.id);

    // La destination calculee doit pointer vers la fiche du personnage reclame.
    const destination = await resolveDestinationForInvitedUser(anon, resolved.invite, verified.user.id);
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

    const [first, second] = await Promise.all([
      claimInvite({ invite: resolved.invite, claim: { role: "player", name: "Antoine", entityId: entityBId } }),
      claimInvite({ invite: { ...resolved.invite }, claim: { role: "player", name: "Concurrent", entityId: entityBId } }),
    ]);
    const results = [first, second];
    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    // Meme jeton non encore reclame => meme adresse synthetique pour les
    // deux : le perdant echoue a la creation du compte lui-meme
    // (`invite_already_claimed`), avant meme d'atteindre la reclamation du
    // personnage — deux visiteurs d'un lien ENCORE LIBRE ne peuvent de
    // toute facon devenir qu'UNE seule identite au final.
    if (failed[0] && !failed[0].ok) expect(failed[0].reason).toBe("invite_already_claimed");

    // Nettoyage : le compte du gagnant a ete lie a l'invite ci-dessus (meme jeton, deja "reclame" par le gagnant) — retrouve pour suppression.
    const { data } = await admin.from("campaign_characters").select("user_id").eq("entity_id", entityBId).single();
    if (data?.user_id) createdInvitedUserIds.push(data.user_id);
  });

  it("un lien deja reclame reconnecte le MEME compte a la reouverture, sans redemander de role", async () => {
    const { token } = await createCampaignInvite(ownerClient, { campaignId, worldId: null, intendedRole: "gm", createdBy: ownerId });
    const anon = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });

    const firstResolve = await resolveInviteForJoin(anon, token);
    if (!firstResolve.ok) throw new Error("resolution echouee");
    const firstClaim = await claimInvite({ invite: firstResolve.invite, claim: { role: "gm", name: "Jérémy MJ" } });
    if (!firstClaim.ok) throw new Error("reclamation echouee");
    const { data: firstSession, error: firstError } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: firstClaim.tokenHash });
    if (firstError || !firstSession.user) throw new Error("premiere session echouee");
    createdInvitedUserIds.push(firstSession.user.id);

    // Reouverture : meme jeton, aucune information de role/nom fournie.
    const secondResolve = await resolveInviteForJoin(anon, token);
    if (!secondResolve.ok) throw new Error("seconde resolution echouee");
    expect(secondResolve.invite.claimedByUserId).toBe(firstSession.user.id);

    const secondClaim = await claimInvite({ invite: secondResolve.invite });
    if (!secondClaim.ok) throw new Error("reouverture echouee");
    const { data: secondSession, error: secondError } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: secondClaim.tokenHash });
    if (secondError || !secondSession.user) throw new Error("seconde session echouee");

    expect(secondSession.user.id).toBe(firstSession.user.id);
  });

  it("un lien revoque ne resout plus a rien, meme deja reclame", async () => {
    const { invite, token } = await createCampaignInvite(ownerClient, { campaignId, worldId: null, intendedRole: "gm", createdBy: ownerId });
    await admin.from("campaign_invites").update({ revoked_at: new Date().toISOString() }).eq("id", invite.id);

    const anon = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const resolved = await resolveInviteForJoin(anon, token);
    expect(resolved.ok).toBe(false);
  });
});
