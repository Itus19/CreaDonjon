import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createEntity } from "./entities";
import { createBlock } from "./blocks";
import { listLinkedWorldviewComparisons, searchWorldviewComparisons } from "./worldviewComparisons";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-70 — « Comparer avec » (règle 5) : les convictions d'une faction ne
 * partent vers un lecteur que si SON bloc Convictions lui est visible. Un
 * bloc `gm` n'est proposé qu'au MJ ; passé à `players`, le joueur le voit.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("comparaison des convictions (integration, base reelle)", () => {
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
      .insert({ name: "Monde de test convictions", slug: `integration-test-conv-${Date.now()}`, owner_id: ownerId })
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

  it("une faction aux convictions `gm` n'est proposée qu'au MJ, puis au joueur une fois passées à `players`", async () => {
    const personnage = await createEntity(ownerClient, { worldId, createdBy: ownerId, name: "Bram", entityKind: "character", aliases: [] });
    const faction = await createEntity(ownerClient, { worldId, createdBy: ownerId, name: "Ordre du Corbeau", entityKind: "faction", aliases: [] });

    const { error: relationError } = await admin.from("relations").insert({
      world_id: worldId,
      source_entity_id: personnage.id,
      target_entity_id: faction.id,
      relation_type: "member_of",
      visibility_level: "public",
      visibility_scope_id: null,
      created_by: ownerId,
    });
    if (relationError) throw new Error(relationError.message);

    const bloc = await createBlock(ownerClient, {
      entityId: faction.id,
      blockType: "worldview",
      label: "Convictions",
      visibilityLevel: "gm",
      visibilityScopeId: null,
      createdBy: ownerId,
    });
    if (!bloc.ok) throw new Error("creation bloc convictions refusee");
    const { error: dataError } = await admin
      .from("blocks")
      .update({ data: { __v: 1, poles: [{ key: "order_freedom", value: -60 }], priority: [] } })
      .eq("id", bloc.block.id);
    if (dataError) throw new Error(dataError.message);

    const params = { worldId, entityId: personnage.id };

    const vuMj = await listLinkedWorldviewComparisons(ownerClient, { ...params, userId: ownerId });
    expect(vuMj).toEqual([{ entityId: faction.id, name: "Ordre du Corbeau", slug: faction.slug, poles: [{ key: "order_freedom", value: -60 }] }]);

    // Règle 5 : ni par la relation, ni par la recherche « Autre… ».
    expect(await listLinkedWorldviewComparisons(playerClient, { ...params, userId: playerId })).toEqual([]);
    expect(await searchWorldviewComparisons(playerClient, { ...params, userId: playerId, query: "Corbeau" })).toEqual([]);

    const { error: visError } = await admin.from("blocks").update({ visibility_level: "players" }).eq("id", bloc.block.id);
    if (visError) throw new Error(visError.message);

    const vuJoueur = await listLinkedWorldviewComparisons(playerClient, { ...params, userId: playerId });
    expect(vuJoueur.map((c) => c.entityId)).toEqual([faction.id]);
    const cherche = await searchWorldviewComparisons(playerClient, { ...params, userId: playerId, query: "Corbeau" });
    expect(cherche.map((c) => c.entityId)).toEqual([faction.id]);
  });
});
