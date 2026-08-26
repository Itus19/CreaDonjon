import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  assignCampaignCharacter,
  createCampaign,
  getCampaignCharacters,
  getCampaignMembers,
  inviteCampaignMember,
  type CampaignSummary,
} from "./campaigns";

/** Un monde = une campagne (migration 20260826100001) : chaque test qui cree une campagne a desormais besoin de son PROPRE monde, jamais un `worldId` partage entre plusieurs `it()`. */
function assertCampaign(result: CampaignSummary | "world_already_has_campaign"): asserts result is CampaignSummary {
  if (result === "world_already_has_campaign") throw new Error("Campagne attendue, la contrainte d'unicite a repondu un conflit.");
}

/**
 * V1-C1 : sans ce test, rien ne prouve que creer une campagne cree bien sa
 * faction *avant* la ligne `campaigns` (docs/adr/0008), que le createur
 * devient membre avec le bon role selon le mode, et que l'invitation par
 * email (`find_user_id_by_email`, migration 20260804140001) fonctionne
 * reellement contre la base — sans jamais lire `auth.users` directement.
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("campagnes (integration, base reelle)", () => {
  let admin: SupabaseClient;
  // `findUserIdByEmail` appelle une fonction `security invoker` : le
  // schema `app` n'accorde `usage` qu'a `authenticated` (et `anon`), jamais
  // a `service_role` (celui-ci le contourne par des enveloppes `security
  // definer` ailleurs, ex. l'import SRD — pas ce cas-ci). Les appels a
  // `inviteCampaignMember` doivent donc passer par un client connecte,
  // exactement comme le fera l'application reelle (session cookie, jamais
  // service_role), pas par `admin`.
  let gmClient: SupabaseClient;
  let gmUserId: string;
  let playerUserId: string;
  let playerEmail: string;
  let rulesetId: string;
  const createdWorldIds: string[] = [];

  async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
    const client = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return client;
  }

  /** Un monde = une campagne (migration 20260826100001) : un monde frais par test qui cree une campagne, jamais partage. */
  async function createTestWorld(): Promise<string> {
    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test campagnes", slug: `integration-test-campaigns-${Date.now()}-${createdWorldIds.length}`, owner_id: gmUserId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    createdWorldIds.push(world.id);
    return world.id;
  }

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const gmEmail = `integration-test-campaign-gm-${Date.now()}@creadonjon.local`;
    const gmPassword = `integration-test-${Date.now()}`;
    const { data: gmData, error: gmError } = await admin.auth.admin.createUser({
      email: gmEmail,
      password: gmPassword,
      email_confirm: true,
    });
    if (gmError || !gmData.user) throw new Error(gmError?.message ?? "creation MJ echouee");
    gmUserId = gmData.user.id;
    gmClient = await signedInClient(gmEmail, gmPassword);

    playerEmail = `integration-test-campaign-player-${Date.now()}@creadonjon.local`;
    const { data: playerData, error: playerError } = await admin.auth.admin.createUser({
      email: playerEmail,
      password: `integration-test-${Date.now()}`,
      email_confirm: true,
    });
    if (playerError || !playerData.user) throw new Error(playerError?.message ?? "creation joueur echouee");
    playerUserId = playerData.user.id;

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");
    rulesetId = official.id;
  });

  afterAll(async () => {
    for (const worldId of createdWorldIds) await admin.from("worlds").delete().eq("id", worldId);
    if (gmUserId) await admin.auth.admin.deleteUser(gmUserId);
    if (playerUserId) await admin.auth.admin.deleteUser(playerUserId);
  });

  it("cree la faction avant la campagne, et le createur devient MJ (mode campaign)", async () => {
    const worldId = await createTestWorld();
    const campaign = await createCampaign(admin, {
      worldId,
      createdBy: gmUserId,
      name: "La Croisade des Ombres",
      rulesetId,
      mode: "campaign",
    });
    assertCampaign(campaign);

    expect(campaign.partyEntityId).not.toBeNull();
    const { data: partyEntity } = await admin
      .from("entities")
      .select("entity_kind, name")
      .eq("id", campaign.partyEntityId!)
      .single();
    expect(partyEntity).toMatchObject({ entity_kind: "faction" });

    const members = await getCampaignMembers(admin, campaign.id);
    expect(members).toEqual([expect.objectContaining({ user_id: gmUserId, role: "gm" })]);
  });

  it("le createur devient simple joueur en mode solo (l'IA est MJ)", async () => {
    const worldId = await createTestWorld();
    const campaign = await createCampaign(admin, {
      worldId,
      createdBy: gmUserId,
      name: "Aventure en solo",
      rulesetId,
      mode: "solo",
    });
    assertCampaign(campaign);

    expect(campaign.gmUserId).toBeNull();
    const members = await getCampaignMembers(admin, campaign.id);
    expect(members).toEqual([expect.objectContaining({ user_id: gmUserId, role: "player" })]);
  });

  it("invite un joueur par email existant, signale l'absence de compte sinon", async () => {
    const worldId = await createTestWorld();
    const campaign = await createCampaign(admin, {
      worldId,
      createdBy: gmUserId,
      name: "Campagne a inviter",
      rulesetId,
      mode: "campaign",
    });
    assertCampaign(campaign);

    const invited = await inviteCampaignMember(gmClient, { campaignId: campaign.id, email: playerEmail, role: "player" });
    expect(invited).toEqual({ ok: true, userId: playerUserId });

    const notFound = await inviteCampaignMember(gmClient, {
      campaignId: campaign.id,
      email: "personne-najamais-un-compte@creadonjon.local",
      role: "player",
    });
    expect(notFound).toEqual({ ok: false, reason: "not_found" });

    const members = await getCampaignMembers(admin, campaign.id);
    expect(members.map((m) => m.user_id)).toContain(playerUserId);
  });

  it("attribue un personnage a un membre de la campagne", async () => {
    const worldId = await createTestWorld();
    const campaign = await createCampaign(admin, {
      worldId,
      createdBy: gmUserId,
      name: "Campagne avec personnage",
      rulesetId,
      mode: "campaign",
    });
    assertCampaign(campaign);
    await inviteCampaignMember(gmClient, { campaignId: campaign.id, email: playerEmail, role: "player" });

    const { data: characterEntity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "heroine-de-test", name: "Héroïne de test", entity_kind: "character", created_by: gmUserId })
      .select("id")
      .single();
    if (entityError || !characterEntity) throw new Error(entityError?.message ?? "creation entite personnage echouee");

    await assignCampaignCharacter(admin, {
      campaignId: campaign.id,
      entityId: characterEntity.id,
      userId: playerUserId,
      isPc: true,
    });

    const characters = await getCampaignCharacters(admin, campaign.id);
    expect(characters).toEqual([
      { campaign_id: campaign.id, entity_id: characterEntity.id, user_id: playerUserId, is_pc: true },
    ]);
  });
});
