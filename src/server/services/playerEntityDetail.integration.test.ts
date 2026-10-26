import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPlayerEntityDetail } from "./playerEntityDetail";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-147 — le repaire d'une fiche de créature, dans la coquille joueur.
 * La table des fiches du monde que lit ce service n'est pas filtrée par
 * joueur (la RLS des entités ne connaît que l'appartenance au monde) : sans
 * le filtre dédié, le nom d'un repaire réservé au MJ partirait au joueur.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("fiche joueur : repaire de créature (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let playerClient: SupabaseClient;
  let ownerId: string;
  let playerId: string;
  let worldId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const [owner, player] = await Promise.all([getReusableTestAccount(admin, "owner"), getReusableTestAccount(admin, "player")]);
    ownerId = owner.id;
    playerId = player.id;
    playerClient = player.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test repaire", slug: `integration-test-repaire-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: official, error: officialError } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    const { error: memberError } = await admin.from("campaign_members").insert({ campaign_id: campaign.id, user_id: playerId, role: "player" });
    if (memberError) throw new Error(memberError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  async function fiche(slug: string, name: string, visibilityLevel: string): Promise<string> {
    const { data, error } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug, name, entity_kind: "location", created_by: ownerId })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "creation fiche echouee");
    const bloc = await admin.from("blocks").insert({
      entity_id: data.id,
      block_type: "text",
      display: { label: "Description", layout: "prose" },
      visibility_level: visibilityLevel,
      display_order: 0,
      created_by: ownerId,
      data: { __v: 1, segments: [] },
    });
    if (bloc.error) throw new Error(bloc.error.message);
    return data.id;
  }

  it("un repaire réservé au MJ ne part pas au joueur ; un repaire visible devient un lien", async () => {
    const visible = await fiche("ruines-de-thundertree", "Ruines de Thundertree", "players");
    const cache = await fiche("antre-secret", "ANTRE_SECRET_147", "gm");

    const { data: creature, error } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "dragon-vert", name: "Dragon vert", entity_kind: "creature", created_by: ownerId })
      .select("id")
      .single();
    if (error || !creature) throw new Error(error?.message ?? "creation creature echouee");
    const statblock = (lairId: string) => ({
      __v: 1,
      size: "Grande",
      creature_type: "dragon",
      ac: { value: 18 },
      hp: { value: 136 },
      speed: "12 m",
      abilities: { str: 21, dex: 12, con: 19, int: 16, wis: 13, cha: 15 },
      traits: [],
      actions: [],
      reactions: [],
      legendary_actions: [],
      lair: { kind: "entity", id: lairId },
    });
    const blocs = await admin.from("blocks").insert([
      { entity_id: creature.id, block_type: "statblock", display: { label: "Repaire visible", layout: "statblock" }, visibility_level: "players", display_order: 0, created_by: ownerId, data: statblock(visible) },
      { entity_id: creature.id, block_type: "statblock", display: { label: "Repaire caché", layout: "statblock" }, visibility_level: "players", display_order: 1, created_by: ownerId, data: statblock(cache) },
    ]);
    if (blocs.error) throw new Error(blocs.error.message);

    const detail = await getPlayerEntityDetail(playerClient, { worldId, entitySlug: "dragon-vert", userId: playerId });
    if (!detail) throw new Error("fiche invisible du joueur");
    type Bloc = { display: { label: string }; data: { lair?: unknown }; lairRef?: { name: string; slug: string } };
    const parLibelle = (label: string) => detail.blocks.find((b) => b.display.label === label) as Bloc | undefined;
    expect(parLibelle("Repaire visible")?.lairRef).toEqual({ name: "Ruines de Thundertree", slug: "ruines-de-thundertree" });
    const blocCache = parLibelle("Repaire caché");
    expect(blocCache).toBeDefined();
    expect(blocCache!.lairRef).toBeUndefined();
    expect(blocCache!.data.lair).toBeUndefined();
    const envoye = JSON.stringify(detail);
    expect(envoye).not.toContain("ANTRE_SECRET_147");
    expect(envoye).not.toContain(cache);
  });
});
