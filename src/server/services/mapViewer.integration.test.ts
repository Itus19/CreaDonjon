import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createEntity } from "./entities";
import { createBlock } from "./blocks";
import { createMapLayer, listVisibleMapLayers } from "./mapLayers";
import { createMapPin, listVisibleMapPins } from "./mapPins";
import { resolveMapViewer } from "./mapViewer";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-78 — « Voir comme les joueurs » sur une carte : le serveur rend la
 * carte telle qu'il l'envoie à un joueur (aucun élément MJ dans la réponse,
 * ni une punaise publique posée sur une couche MJ — ADR 0017). Réservé au MJ.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("carte vue comme les joueurs (integration, base reelle)", () => {
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
      .insert({ name: "Monde de test carte", slug: `integration-test-carte-${Date.now()}`, owner_id: ownerId })
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

  it("la vue joueurs du MJ ne rend aucun élément MJ ; un joueur ne peut pas la demander", async () => {
    const lieu = await createEntity(ownerClient, { worldId, createdBy: ownerId, name: "Phandaline", entityKind: "location", aliases: [] });
    const bloc = await createBlock(ownerClient, { entityId: lieu.id, blockType: "map", label: "Carte", visibilityLevel: "public", visibilityScopeId: null, createdBy: ownerId });
    if (!bloc.ok) throw new Error("creation bloc carte refusee");
    const blockId = bloc.block.id;

    const couche = async (name: string, visibilityLevel: string) => {
      const r = await createMapLayer(ownerClient, { blockId, name, visibilityLevel, visibilityScopeId: null, createdBy: ownerId });
      if (!r.ok) throw new Error(`couche refusee : ${r.reason}`);
      return r.layer.id;
    };
    const villes = await couche("Villes", "public");
    const secrets = await couche("Secrets du MJ", "gm");
    const punaise = async (label: string, layerId: string, visibilityLevel: string) => {
      const r = await createMapPin(ownerClient, { blockId, x: 0.5, y: 0.5, label, ref: null, size: "medium", layerId, visibilityLevel, visibilityScopeId: null, createdBy: ownerId });
      if (!r.ok) throw new Error(`punaise refusee : ${r.reason}`);
    };
    await punaise("Auberge du Pont", villes, "public");
    await punaise("Trésor", villes, "gm");
    await punaise("Repaire caché", secrets, "public");

    // Sans la vue joueurs, le MJ voit tout.
    const mj = await resolveMapViewer(ownerClient, { worldId, userId: ownerId, vueJoueurs: false });
    if (!mj) throw new Error("lecteur MJ absent");
    expect((await listVisibleMapPins(ownerClient, blockId, mj.viewer)).map((p) => p.label).sort()).toEqual(["Auberge du Pont", "Repaire caché", "Trésor"]);

    // Vue joueurs : ni la punaise MJ, ni la punaise publique d'une couche MJ, ni la couche MJ.
    const vue = await resolveMapViewer(ownerClient, { worldId, userId: ownerId, vueJoueurs: true });
    if (!vue) throw new Error("vue joueurs refusee au MJ");
    expect((await listVisibleMapPins(ownerClient, blockId, vue.viewer)).map((p) => p.label)).toEqual(["Auberge du Pont"]);
    expect((await listVisibleMapLayers(ownerClient, blockId, vue.viewer)).map((c) => c.name)).toEqual(["Villes"]);

    // Et c'est bien ce que reçoit une vraie joueuse.
    const joueuse = await resolveMapViewer(playerClient, { worldId, userId: playerId, vueJoueurs: false });
    if (!joueuse) throw new Error("lecteur joueuse absent");
    expect((await listVisibleMapPins(playerClient, blockId, joueuse.viewer)).map((p) => p.label)).toEqual(["Auberge du Pont"]);

    // Un joueur ne peut pas demander la vue joueurs (elle est faite pour le MJ).
    expect(await resolveMapViewer(playerClient, { worldId, userId: playerId, vueJoueurs: true })).toBeNull();
  });
});
