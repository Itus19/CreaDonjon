import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildSoloTurnContext } from "./turnContext";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { Viewer } from "@/src/core/visibility";

/**
 * V3-B3 — Contre la base reelle plutot qu'a coups de mocks : les trois
 * choses que ce ticket ajoute reellement dependent de la RLS et du
 * filtrage de visibilite deja eprouves ailleurs (`visibilityRls.integration.test.ts`)
 * — `known_as`, la bande d'attitude nommee, et le filtrage par audience des
 * quetes. Rien de tout ca n'est testable en memoire sans re-simuler la
 * base, ce qui finirait par diverger du vrai comportement.
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("buildSoloTurnContext (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let worldId: string;
  let campaignId: string;
  let locationEntityId: string;
  let playerEntityId: string;
  let npcEntityId: string;
  let playerClient: SupabaseClient;
  let playerUserId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const [gm, player] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    playerUserId = player.id;
    playerClient = player.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test contexte de tour", slug: `integration-test-turn-context-${Date.now()}`, owner_id: gm.id })
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
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official.id, mode: "solo" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;

    const { error: membersError } = await admin
      .from("campaign_members")
      .insert([{ campaign_id: campaignId, user_id: playerUserId, role: "player" }]);
    if (membersError) throw new Error(membersError.message);

    async function createEntity(slug: string, name: string, entityKind: string): Promise<string> {
      const { data, error } = await admin
        .from("entities")
        .insert({ world_id: worldId, slug, name, entity_kind: entityKind, created_by: gm.id })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? `creation entite ${slug} echouee`);
      return data.id;
    }

    [locationEntityId, playerEntityId, npcEntityId] = await Promise.all([
      createEntity(`lieu-test-${Date.now()}`, "L'Ancre Rouillée (test)", "location"),
      createEntity(`pj-test-${Date.now()}`, "Perrin (test)", "character"),
      createEntity(`pnj-test-${Date.now()}`, "Le Vrai Nom Du PNJ", "character"),
    ]);

    const { error: sceneError } = await admin.from("scene_states").insert({
      campaign_id: campaignId,
      state: {
        __v: 2,
        locationId: locationEntityId,
        present: [{ entityId: npcEntityId, zone: "near" }],
        time: { day: 3, hour: 22, minute: 15 },
        lighting: "dim",
        activeCombatId: null,
        recentEvents: [],
        budgets: {},
      },
      updated_by: gm.id,
    });
    if (sceneError) throw new Error(sceneError.message);

    // Amical (40 tombe dans strong_pos, bands.ts) : la bande nommee que le contexte doit montrer, jamais "40".
    const { error: attitudeError } = await admin.from("entity_attitudes").insert({
      campaign_id: campaignId,
      source_entity_id: npcEntityId,
      target_entity_id: playerEntityId,
      axes: { friendship_hostility: 40 },
    });
    if (attitudeError) throw new Error(attitudeError.message);

    // known_as : le joueur ne connait ce PNJ que sous ce nom d'emprunt.
    const { error: relationshipError } = await admin.from("blocks").insert({
      entity_id: playerEntityId,
      block_type: "relationship",
      display: { label: "Relation" },
      data: { __v: 1, target: { kind: "entity", id: npcEntityId }, knownAs: "un étranger au regard dur", historyVisible: 20 },
    });
    if (relationshipError) throw new Error(relationshipError.message);

    // Deux quetes : une visible du joueur, une reservee au MJ — c'est ce que l'audience doit trier.
    const { error: questsError } = await admin.from("blocks").insert([
      {
        entity_id: locationEntityId,
        block_type: "quest",
        display: { label: "Quête visible du joueur" },
        visibility_level: "players",
        data: {
          __v: 1,
          state: "in_progress",
          giver: null,
          objectives: [{ id: "o1", text: "Objectif ouvert", done: false }],
          rewards: [],
          prerequisites: [],
        },
      },
      {
        entity_id: locationEntityId,
        block_type: "quest",
        display: { label: "Secret du MJ" },
        visibility_level: "gm",
        data: { __v: 1, state: "in_progress", giver: null, objectives: [], rewards: [], prerequisites: [] },
      },
    ]);
    if (questsError) throw new Error(questsError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("le PNJ apparait sous son known_as, avec sa bande d'attitude nommee — jamais le vrai nom ni le nombre", async () => {
    const viewer: Viewer = { kind: "user", userId: playerUserId, worldRole: null, campaignRoles: { [campaignId]: "player" } };
    const { text, npcIds } = await buildSoloTurnContext(playerClient, {
      worldId,
      campaignId,
      playerEntityId,
      viewer,
      playerAction: "je regarde autour de moi",
      facts: [],
      changes: [],
      hints: [],
    });

    expect(text).toContain("un étranger au regard dur");
    expect(text).not.toContain("Le Vrai Nom Du PNJ");
    expect(text).toContain("amical");
    expect(text).not.toContain("40");
    expect(npcIds).toEqual([npcEntityId]);
  });

  it("seule la quete visible du joueur entre dans le contexte, jamais le secret du MJ", async () => {
    const viewer: Viewer = { kind: "user", userId: playerUserId, worldRole: null, campaignRoles: { [campaignId]: "player" } };
    const { text } = await buildSoloTurnContext(playerClient, {
      worldId,
      campaignId,
      playerEntityId,
      viewer,
      playerAction: "je regarde autour de moi",
      facts: [],
      changes: [],
      hints: [],
    });

    expect(text).toContain("Quête visible du joueur");
    expect(text).not.toContain("Secret du MJ");
  });
});
