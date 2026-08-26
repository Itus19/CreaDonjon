import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { canSee } from "../../core/visibility/canSee";
import type { Viewer, VisibilityLevel } from "../../core/visibility/types";

/**
 * V1-C2 : compare, pour chaque niveau de visibilite et chaque profil de
 * lecteur, le verdict de la table de verite pure (`canSee`,
 * src/core/visibility) au verdict reel obtenu par une lecture RLS-gatee
 * (migration 20260804150001_visibility_rls_descent.sql). Sans ce test, rien
 * ne prouve que la politique Postgres reproduit vraiment canSee() plutot
 * que de simplement compiler — c'est le seul verrou entre un joueur et un
 * secret de MJ (SCHEMA.md §4.2, §19).
 *
 * Divergence assumee et documentee (pas un echec de test) : le niveau
 * 'campaign' de canSee() exige en plus que la lecture ait lieu dans le
 * CONTEXTE de cette campagne precise (ctx.campaignId === scopeId) — RLS ne
 * peut pas connaitre ce contexte (une politique ne voit que la ligne et
 * auth.uid()). Aucun appel reel de l'application ne passe aujourd'hui de
 * ctx.campaignId (verifie par grep avant d'ecrire cette migration) : la
 * comparaison ci-dessous utilise donc, pour 'campaign', le verdict
 * "membre de cette campagne, sans egard au contexte" cote RLS, et compare
 * canSee() avec ce MEME contexte factice (celui de la campagne testee) —
 * les deux mesurent alors la garantie de securite reelle (jamais de fuite
 * vers un non-membre), qui est ce que RLS peut effectivement garantir.
 *
 * Profil retire (migration 20260826100001, "un monde = une campagne") : ce
 * fichier testait un profil "joueur d'une AUTRE campagne du meme monde",
 * pour verifier qu'il n'heritait pas du niveau 'players' par simple
 * appartenance au monde. La contrainte d'unicite `campaigns_world_id_unique`
 * rend ce profil desormais impossible a construire (un monde n'a plus
 * qu'une seule campagne) — pas juste deplace ailleurs : un membre d'une
 * campagne d'un AUTRE monde n'a aucun lien avec ce monde-ci et se confond
 * avec le profil "outsider" deja couvert, sans rien tester de plus.
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("descente de la visibilite dans les politiques RLS (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let worldId: string;
  let entityId: string;
  let rulesetId: string;
  let campaignAId: string;

  const userIds: Record<string, string> = {};
  const clients: Record<string, SupabaseClient> = {};

  async function createProfile(key: string): Promise<{ id: string; client: SupabaseClient }> {
    const email = `integration-test-vis-${key}-${Date.now()}@creadonjon.local`;
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

    // Cinq profils, refletant ceux de canSee.test.ts : proprietaire, simple
    // spectateur du monde (aucune campagne), joueur d'UNE campagne SANS
    // ligne world_members separee (verifie le correctif is_world_member,
    // migration 20260804150002), MJ de cette meme campagne, et un tiers sans
    // aucun lien. (Le profil "joueur d'une autre campagne du meme monde" a
    // ete retire — voir commentaire de tete de fichier.)
    const [owner, worldViewer, campaignPlayer, campaignGm, outsider] = await Promise.all([
      createProfile("owner"),
      createProfile("world-viewer"),
      createProfile("campaign-player"),
      createProfile("campaign-gm"),
      createProfile("outsider"),
    ]);
    userIds.owner = owner.id;
    clients.owner = owner.client;
    userIds.worldViewer = worldViewer.id;
    clients.worldViewer = worldViewer.client;
    userIds.campaignPlayer = campaignPlayer.id;
    clients.campaignPlayer = campaignPlayer.client;
    userIds.campaignGm = campaignGm.id;
    clients.campaignGm = campaignGm.client;
    userIds.outsider = outsider.id;
    clients.outsider = outsider.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test RLS", slug: `integration-test-rls-${Date.now()}`, owner_id: userIds.owner })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { error: memberError } = await admin
      .from("world_members")
      .insert({ world_id: worldId, user_id: userIds.worldViewer, role: "viewer" });
    if (memberError) throw new Error(memberError.message);

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "cible-de-test", name: "Cible de test", entity_kind: "other", created_by: userIds.owner })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    entityId = entity.id;

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");
    rulesetId = official.id;

    const { data: campaignA, error: campaignAError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne A", ruleset_id: rulesetId, mode: "campaign" })
      .select("id")
      .single();
    if (campaignAError || !campaignA) throw new Error(campaignAError?.message ?? "creation campagne A echouee");
    campaignAId = campaignA.id;

    const { error: membersError } = await admin.from("campaign_members").insert([
      { campaign_id: campaignAId, user_id: userIds.campaignPlayer, role: "player" },
      { campaign_id: campaignAId, user_id: userIds.campaignGm, role: "gm" },
    ]);
    if (membersError) throw new Error(membersError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    for (const id of Object.values(userIds)) await admin.auth.admin.deleteUser(id);
  });

  async function insertBlock(params: {
    level: VisibilityLevel;
    scopeId: string | null;
    createdBy: string | null;
  }): Promise<string> {
    const { data, error } = await admin
      .from("blocks")
      .insert({
        entity_id: entityId,
        block_type: "text",
        display: { label: "Test", layout: "prose" },
        data: { __v: 1, segments: [] },
        visibility_level: params.level,
        visibility_scope_id: params.scopeId,
        created_by: params.createdBy,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "creation bloc echouee");
    return data.id;
  }

  async function canReadBlock(client: SupabaseClient, blockId: string): Promise<boolean> {
    const { data, error } = await client.from("blocks").select("id").eq("id", blockId).maybeSingle();
    if (error) throw new Error(error.message);
    return data !== null;
  }

  function viewerFor(profile: string): Viewer {
    switch (profile) {
      case "owner":
        return { kind: "user", userId: userIds.owner, worldRole: "owner", campaignRoles: {} };
      case "worldViewer":
        return { kind: "user", userId: userIds.worldViewer, worldRole: "viewer", campaignRoles: {} };
      case "campaignPlayer":
        return { kind: "user", userId: userIds.campaignPlayer, worldRole: null, campaignRoles: { [campaignAId]: "player" } };
      case "campaignGm":
        return { kind: "user", userId: userIds.campaignGm, worldRole: null, campaignRoles: { [campaignAId]: "gm" } };
      case "outsider":
        return { kind: "user", userId: userIds.outsider, worldRole: null, campaignRoles: {} };
      default:
        throw new Error(`profil inconnu : ${profile}`);
    }
  }

  const PROFILES = ["owner", "worldViewer", "campaignPlayer", "campaignGm", "outsider"] as const;

  it("niveau 'public' : la garde d'appartenance au monde prime (divergence assumee pour 'outsider', cf. D-01)", async () => {
    const blockId = await insertBlock({ level: "public", scopeId: null, createdBy: null });
    for (const profile of PROFILES) {
      const rlsResult = await canReadBlock(clients[profile], blockId);
      const pureResult = canSee({ level: "public", scopeId: null, createdBy: null }, viewerFor(profile));
      if (profile === "outsider") {
        // canSee() dit vrai (public = visible de tous) ; RLS dit faux, car
        // l'appartenance au monde reste un prealable a TOUTE lecture de
        // `blocks` (le vrai "public a tous" passe par le lien de partage
        // service_role, D-01 — pas par cette table). Divergence connue,
        // pas un echec : documentee explicitement plutot que masquee.
        expect(pureResult).toBe(true);
        expect(rlsResult).toBe(false);
      } else {
        expect(rlsResult, profile).toBe(pureResult);
      }
    }
  });

  it("niveau 'players'", async () => {
    const blockId = await insertBlock({ level: "players", scopeId: null, createdBy: null });
    const expected: Record<string, boolean> = {
      owner: true,
      worldViewer: false,
      campaignPlayer: true,
      campaignGm: true,
      outsider: false,
    };
    for (const profile of PROFILES) {
      const rlsResult = await canReadBlock(clients[profile], blockId);
      const pureResult = canSee({ level: "players", scopeId: null, createdBy: null }, viewerFor(profile));
      expect(pureResult, profile).toBe(expected[profile]);
      expect(rlsResult, profile).toBe(expected[profile]);
    }
  });

  it("niveau 'gm'", async () => {
    const blockId = await insertBlock({ level: "gm", scopeId: null, createdBy: null });
    const expected: Record<string, boolean> = {
      owner: true,
      worldViewer: false,
      campaignPlayer: false,
      campaignGm: true,
      outsider: false,
    };
    for (const profile of PROFILES) {
      const rlsResult = await canReadBlock(clients[profile], blockId);
      const pureResult = canSee({ level: "gm", scopeId: null, createdBy: null }, viewerFor(profile));
      expect(pureResult, profile).toBe(expected[profile]);
      expect(rlsResult, profile).toBe(expected[profile]);
    }
  });

  it("niveau 'campaign' (scope = campagne A) : jamais de fuite vers un membre d'une autre campagne", async () => {
    const blockId = await insertBlock({ level: "campaign", scopeId: campaignAId, createdBy: null });
    const ctx = { campaignId: campaignAId };
    const expected: Record<string, boolean> = {
      owner: false, // canSee() : le proprietaire n'est pas automatiquement membre d'une campagne
      worldViewer: false,
      campaignPlayer: true,
      campaignGm: true,
      outsider: false,
    };
    for (const profile of PROFILES) {
      const rlsResult = await canReadBlock(clients[profile], blockId);
      const pureResult = canSee({ level: "campaign", scopeId: campaignAId, createdBy: null }, viewerFor(profile), ctx);
      expect(pureResult, profile).toBe(expected[profile]);
      expect(rlsResult, profile).toBe(expected[profile]);
    }
  });

  it("niveau 'user' (scope = campaignPlayer)", async () => {
    const blockId = await insertBlock({ level: "user", scopeId: userIds.campaignPlayer, createdBy: null });
    for (const profile of PROFILES) {
      const rlsResult = await canReadBlock(clients[profile], blockId);
      const pureResult = canSee({ level: "user", scopeId: userIds.campaignPlayer, createdBy: null }, viewerFor(profile));
      expect(rlsResult, profile).toBe(pureResult);
    }
  });

  it("niveau 'private' (auteur = campaignPlayer)", async () => {
    const blockId = await insertBlock({ level: "private", scopeId: null, createdBy: userIds.campaignPlayer });
    for (const profile of PROFILES) {
      const rlsResult = await canReadBlock(clients[profile], blockId);
      const pureResult = canSee({ level: "private", scopeId: null, createdBy: userIds.campaignPlayer }, viewerFor(profile));
      expect(rlsResult, profile).toBe(pureResult);
    }
  });

  it("aucune recursion sur campaign_members : une lecture via un joueur de campagne aboutit sans erreur Postgres", async () => {
    const blockId = await insertBlock({ level: "players", scopeId: null, createdBy: null });
    await expect(canReadBlock(clients.campaignPlayer, blockId)).resolves.toBe(true);
  });
});
