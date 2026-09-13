import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { listWorldCardsForCurrentUser } from "./worlds";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V2-M5 (Lot M, écran d'accueil unifié, retour utilisateur 30 août) :
 * vérifie contre une vraie base que `myRole`/`myCharacter` reflètent le
 * rôle REEL de chaque compte dans CE monde précis — un même compte MJ d'un
 * monde peut être joueur d'un autre, jamais un rôle global figé.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("listWorldCardsForCurrentUser — role par monde (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let ownerId: string;
  let ownerClient: SupabaseClient;
  let jeremyId: string;
  let jeremyClient: SupabaseClient;
  let worldAId: string;
  let worldBId: string;
  let campaignAId: string;
  let campaignBId: string;
  let entityId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const owner = await getReusableTestAccount(admin, "owner");
    ownerId = owner.id;
    ownerClient = owner.client;

    const jeremy = await getReusableTestAccount(admin, "player");
    jeremyId = jeremy.id;
    jeremyClient = jeremy.client;

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    // Monde A : Jeremy y est JOUEUR, avec un personnage reclame.
    const { data: worldA, error: worldAError } = await admin
      .from("worlds")
      .insert({ name: "Monde A — Jeremy joueur", slug: `integration-test-worldcards-a-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (worldAError || !worldA) throw new Error(worldAError?.message ?? "creation monde A echouee");
    worldAId = worldA.id;

    const { data: campaignA, error: campaignAError } = await admin
      .from("campaigns")
      .insert({ world_id: worldAId, name: "Campagne A", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignAError || !campaignA) throw new Error(campaignAError?.message ?? "creation campagne A echouee");
    campaignAId = campaignA.id;

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldAId, slug: "pj-jeremy", name: "Personnage de Jérémy", entity_kind: "character", created_by: ownerId })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    entityId = entity.id;

    const { error: memberAError } = await admin
      .from("campaign_members")
      .insert({ campaign_id: campaignAId, user_id: jeremyId, role: "player" });
    if (memberAError) throw new Error(memberAError.message);

    const { error: characterError } = await admin
      .from("campaign_characters")
      .insert({ campaign_id: campaignAId, entity_id: entityId, is_pc: true, user_id: jeremyId });
    if (characterError) throw new Error(characterError.message);

    // Monde B : Jeremy y est MJ (campaign_members.role = 'gm'), monde
    // DIFFERENT du precedent — c'est precisement le scenario "MJ ici, joueur
    // ailleurs" du retour utilisateur.
    const { data: worldB, error: worldBError } = await admin
      .from("worlds")
      .insert({ name: "Monde B — Jeremy MJ", slug: `integration-test-worldcards-b-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (worldBError || !worldB) throw new Error(worldBError?.message ?? "creation monde B echouee");
    worldBId = worldB.id;

    const { data: campaignB, error: campaignBError } = await admin
      .from("campaigns")
      .insert({ world_id: worldBId, name: "Campagne B", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignBError || !campaignB) throw new Error(campaignBError?.message ?? "creation campagne B echouee");
    campaignBId = campaignB.id;

    const { error: memberBError } = await admin
      .from("campaign_members")
      .insert({ campaign_id: campaignBId, user_id: jeremyId, role: "gm" });
    if (memberBError) throw new Error(memberBError.message);
  });

  afterAll(async () => {
    if (worldAId) await admin.from("worlds").delete().eq("id", worldAId);
    if (worldBId) await admin.from("worlds").delete().eq("id", worldBId);
  });

  it("un meme compte voit 'joueur' avec son personnage sur un monde, et 'gm' sans personnage sur un autre", async () => {
    const cards = await listWorldCardsForCurrentUser(jeremyClient, jeremyId);
    const cardA = cards.find((c) => c.id === worldAId);
    const cardB = cards.find((c) => c.id === worldBId);

    expect(cardA?.myRole).toBe("player");
    expect(cardA?.myCharacter).toEqual({ entityId, entitySlug: "pj-jeremy", name: "Personnage de Jérémy" });

    expect(cardB?.myRole).toBe("gm");
    expect(cardB?.myCharacter).toBeNull();
  });

  it("le proprietaire du monde voit toujours 'gm', meme sans ligne world_members ni campaign_members", async () => {
    const cards = await listWorldCardsForCurrentUser(ownerClient, ownerId);
    const cardA = cards.find((c) => c.id === worldAId);
    expect(cardA?.myRole).toBe("gm");
  });
});
