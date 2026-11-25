import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { drawPriceListForBlock, drawPriceListForScene } from "./priceListDraw";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import { cleanupCreated } from "../testUtils/cleanupCreated";

/**
 * V3.2-9 — « Tirer la carte » : la porte du tirage (docs/SECURITE.md §2).
 * Une joueuse qui VOIT le bloc mais ne peut pas modifier la fiche est
 * refusée ; un compte hors du monde ne trouve rien ; la propriétaire passe
 * la porte et reçoit le motif honnête d'un monde sans générateurs.
 *
 * V3.2-10 — « Tirer la carte du lieu » depuis le solo : sans scène, le motif
 * le dit ; une joueuse sans droit d'écriture sur le lieu est refusée ; un lieu
 * qui a déjà une carte la garde, rien n'est réécrit.
 *
 * Coût (docs/QUOTAS.md T1-T2) : un monde, une campagne, une scène, une fiche,
 * un bloc, six appels.
 * Se saute sans `.env.local`.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("tirage de la carte d'un lieu (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let owner: { id: string; client: SupabaseClient };
  let player: { id: string; client: SupabaseClient };
  let outsider: { id: string; client: SupabaseClient };
  let worldId: string;
  let blockId: string;
  let locationId: string;
  let campaignId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    owner = await getReusableTestAccount(admin, "owner");
    player = await getReusableTestAccount(admin, "player");
    outsider = await getReusableTestAccount(admin, "outsider");

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — carte", slug: `test-carte-${Date.now()}`, owner_id: owner.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;
    const { error: memberError } = await admin.from("world_members").insert({ world_id: worldId, user_id: player.id, role: "viewer" });
    if (memberError) throw new Error(memberError.message);

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: `fanal-${Date.now()}`, name: "Le Fanal", entity_kind: "location", created_by: owner.id })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation fiche echouee");
    locationId = entity.id;
    const { data: block, error: blockError } = await admin
      .from("blocks")
      .insert({
        entity_id: entity.id,
        block_type: "price_list",
        display: { label: "Carte et tarifs", layout: "table" },
        visibility_level: "public",
        created_by: owner.id,
        data: { __v: 1, wealth: null, seed: null, offers: [] },
      })
      .select("id")
      .single();
    if (blockError || !block) throw new Error(blockError?.message ?? "creation bloc echouee");
    blockId = block.id;

    const { data: official, error: officialError } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test — carte", ruleset_id: official.id, mode: "solo" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;
    const { error: membersError } = await admin.from("campaign_members").insert([{ campaign_id: campaignId, user_id: player.id, role: "player" }]);
    if (membersError) throw new Error(membersError.message);
  });

  afterAll(async () => {
    if (worldId) await cleanupCreated(admin, { worldIds: [worldId] });
  });

  it("refuse une joueuse qui voit le bloc sans pouvoir modifier la fiche", async () => {
    const result = await drawPriceListForBlock(player.client, { blockId, userId: player.id, locale: "fr" });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("ne montre rien à un compte hors du monde", async () => {
    const result = await drawPriceListForBlock(outsider.client, { blockId, userId: outsider.id, locale: "fr" });
    expect(result).toEqual({ error: "not_found" });
  });

  it("laisse passer la propriétaire, qui apprend que le monde n'a pas de générateurs", async () => {
    const result = await drawPriceListForBlock(owner.client, { blockId, userId: owner.id, locale: "fr" });
    expect(result).toEqual({ error: "no_generators" });
  });

  it("solo : sans scène posée, le motif le dit", async () => {
    const result = await drawPriceListForScene(owner.client, { campaignId, worldId, userId: owner.id, locale: "fr" });
    expect(result).toEqual({ error: "no_scene" });
  });

  it("solo : refuse une joueuse sans droit d'écriture sur le lieu, et garde la carte existante", async () => {
    const state = {
      __v: 4,
      locationId,
      present: [],
      time: { day: 1, hour: 20, minute: 0 },
      lighting: "dim",
      activeCombatId: null,
      recentEvents: [],
      budgets: {},
      sketches: [],
      weather: null,
    };
    const { error: sceneError } = await admin.from("scene_states").upsert({ campaign_id: campaignId, state }, { onConflict: "campaign_id" });
    if (sceneError) throw new Error(sceneError.message);

    expect(await drawPriceListForScene(player.client, { campaignId, worldId, userId: player.id, locale: "fr" })).toEqual({ error: "forbidden" });
    expect(await drawPriceListForScene(owner.client, { campaignId, worldId, userId: owner.id, locale: "fr" })).toMatchObject({ created: false, priceList: { offers: [] } });
  });
});
