import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createEntity } from "./entities";
import { createBlock } from "./blocks";
import { addPersonalityEvent } from "./psyche";
import { canReadPoleEvents, canWritePoleBlock, canWritePoleEvent } from "./psycheAccess";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * Souvenirs de Personnalité et de Convictions (`personality_events`) : la
 * RLS ne connaît que l'appartenance au monde. Un joueur ne lit les souvenirs
 * que d'un bloc qu'il voit (règle 5), et n'en écrit que sur une fiche qu'il
 * peut modifier (`canEditEntity`, règle 22).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("gardes des souvenirs de personnalité (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let ownerClient: SupabaseClient;
  let playerClient: SupabaseClient;
  let ownerId: string;
  let playerId: string;
  let worldId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const [owner, player] = await Promise.all([getReusableTestAccount(admin, "owner"), getReusableTestAccount(admin, "player")]);
    ownerId = owner.id;
    ownerClient = owner.client;
    playerId = player.id;
    playerClient = player.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test souvenirs", slug: `integration-test-souv-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    // Le joueur doit appartenir à une campagne du monde pour voir le niveau `players`.
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

    const { error: memberError } = await admin
      .from("campaign_members")
      .insert({ campaign_id: campaign.id, user_id: playerId, role: "player" });
    if (memberError) throw new Error(memberError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("un bloc Personnalité `gm` : ses souvenirs ne se lisent ni ne s'écrivent par un joueur", async () => {
    const bram = await createEntity(ownerClient, { worldId, createdBy: ownerId, name: "Bram", entityKind: "character", aliases: [] });
    // La fiche est visible du joueur (un bloc public), seule la Personnalité est réservée au MJ.
    const texte = await createBlock(ownerClient, { entityId: bram.id, blockType: "text", label: "Description", visibilityLevel: "public", visibilityScopeId: null, createdBy: ownerId });
    if (!texte.ok) throw new Error("creation bloc texte refusee");
    const bloc = await createBlock(ownerClient, { entityId: bram.id, blockType: "personality", label: "Personnalité", visibilityLevel: "gm", visibilityScopeId: null, createdBy: ownerId });
    if (!bloc.ok) throw new Error("creation bloc personnalite refusee");

    const souvenir = await addPersonalityEvent(ownerClient, {
      blockId: bloc.block.id,
      expectedVersion: bloc.block.version,
      summary: "A trahi son frère",
      deltas: { curiosity_caution: 20 },
      occurredAtIngame: null,
      origin: "gm",
      actorUserId: ownerId,
    });
    if (!souvenir.ok) throw new Error(`souvenir refuse : ${souvenir.reason}`);

    const lire = { entityId: bram.id, blockType: "personality" as const };
    expect(await canReadPoleEvents(ownerClient, { ...lire, userId: ownerId })).toBe(true);
    expect(await canReadPoleEvents(playerClient, { ...lire, userId: playerId })).toBe(false);
    // Aucun bloc Convictions : rien à lire de ce côté non plus.
    expect(await canReadPoleEvents(playerClient, { entityId: bram.id, blockType: "worldview", userId: playerId })).toBe(false);

    expect(await canWritePoleBlock(ownerClient, { blockId: bloc.block.id, userId: ownerId })).toBe(true);
    expect(await canWritePoleBlock(playerClient, { blockId: bloc.block.id, userId: playerId })).toBe(false);
    expect(await canWritePoleEvent(ownerClient, { eventId: souvenir.event.id, userId: ownerId })).toBe(true);
    expect(await canWritePoleEvent(playerClient, { eventId: souvenir.event.id, userId: playerId })).toBe(false);

    // Bloc passé aux joueurs : la lecture s'ouvre, l'écriture reste fermée (fiche du MJ).
    const { error: visError } = await admin.from("blocks").update({ visibility_level: "players" }).eq("id", bloc.block.id);
    if (visError) throw new Error(visError.message);
    expect(await canReadPoleEvents(playerClient, { ...lire, userId: playerId })).toBe(true);
    expect(await canWritePoleBlock(playerClient, { blockId: bloc.block.id, userId: playerId })).toBe(false);
  });
});
