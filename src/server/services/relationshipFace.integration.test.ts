import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createEntity } from "./entities";
import { createBlock } from "./blocks";
import { addAttitudeEvent } from "./psyche";
import { canReadRelationship, canWriteRelationship, getRelationshipFace } from "./relationshipFace";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-71 — « ⇄ Voir l'autre sens » (règle 5) : le bloc Relation de la cible
 * envers la fiche ne part vers un lecteur que s'il lui est visible ; sans
 * bloc visible, ni valeurs ni souvenirs. « Créer ce bloc » suit
 * `canEditEntity`. Une cible invisible ne livre pas son nom.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("face-à-face du bloc Relation (integration, base reelle)", () => {
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
      .insert({ name: "Monde de test relation", slug: `integration-test-rel-${Date.now()}`, owner_id: ownerId })
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

  it("le bloc inverse `gm` ne part qu'au MJ ; ses souvenirs sont comptés ; la cible cachée reste muette", async () => {
    const sildar = await createEntity(ownerClient, { worldId, createdBy: ownerId, name: "Sildar", entityKind: "character", aliases: [] });
    const gundren = await createEntity(ownerClient, { worldId, createdBy: ownerId, name: "Gundren", entityKind: "character", aliases: [] });

    // Une fiche est visible d'un joueur si au moins un de ses blocs l'est (`listPlayerVisibleEntityIds`).
    const blocsPublics: string[] = [];
    for (const fiche of [sildar, gundren]) {
      const texte = await createBlock(ownerClient, { entityId: fiche.id, blockType: "text", label: "Description", visibilityLevel: "public", visibilityScopeId: null, createdBy: ownerId });
      if (!texte.ok) throw new Error("creation bloc texte refusee");
      blocsPublics.push(texte.block.id);
    }

    // Gundren envers Sildar : un bloc réservé au MJ.
    const bloc = await createBlock(ownerClient, {
      entityId: gundren.id,
      blockType: "relationship",
      label: "Envers Sildar",
      visibilityLevel: "gm",
      visibilityScopeId: null,
      createdBy: ownerId,
    });
    if (!bloc.ok) throw new Error("creation bloc relation refusee");
    const { error: dataError } = await admin
      .from("blocks")
      .update({ data: { __v: 1, target: { kind: "entity", id: sildar.id }, knownAs: "un vieil ami", historyVisible: 20 } })
      .eq("id", bloc.block.id);
    if (dataError) throw new Error(dataError.message);

    const souvenir = await addAttitudeEvent(ownerClient, {
      sourceEntityId: gundren.id,
      targetEntityId: sildar.id,
      summary: "A payé sa rançon",
      deltas: { trust_distrust: 35 },
      occurredAtIngame: null,
      origin: "gm",
    });
    if (!souvenir.ok) throw new Error(`souvenir refuse : ${souvenir.reason}`);

    const sens = { sourceEntityId: gundren.id, targetEntityId: sildar.id };

    const vuMj = await getRelationshipFace(ownerClient, { ...sens, userId: ownerId });
    expect(vuMj?.block).toEqual({ id: bloc.block.id, knownAs: "un vieil ami" });
    expect(vuMj?.souvenirs.count).toBe(1);
    expect(vuMj?.axes.trust_distrust).toBeGreaterThan(0);
    expect(vuMj?.canEditSource).toBe(true);

    // Règle 5 : ni le bloc, ni les valeurs, ni les souvenirs ; et pas le droit de créer.
    const vuJoueur = await getRelationshipFace(playerClient, { ...sens, userId: playerId });
    expect(vuJoueur?.block).toBeNull();
    expect(vuJoueur?.axes).toEqual({});
    expect(vuJoueur?.souvenirs).toEqual({ count: 0, last: null });
    expect(vuJoueur?.canEditSource).toBe(false);
    expect(vuJoueur?.target?.name).toBe("Sildar");
    // Les routes `attitudes/[targetId]` et `…/events` suivent le même garde.
    expect(await canReadRelationship(playerClient, { ...sens, userId: playerId })).toBe(false);
    expect(await canReadRelationship(ownerClient, { ...sens, userId: ownerId })).toBe(true);
    // Écrire un souvenir : seulement qui peut écrire sur la fiche source.
    expect(await canWriteRelationship(playerClient, { sourceEntityId: gundren.id, userId: playerId })).toBe(false);
    expect(await canWriteRelationship(ownerClient, { sourceEntityId: gundren.id, userId: ownerId })).toBe(true);

    const { error: visError } = await admin.from("blocks").update({ visibility_level: "players" }).eq("id", bloc.block.id);
    if (visError) throw new Error(visError.message);
    const vuJoueurApres = await getRelationshipFace(playerClient, { ...sens, userId: playerId });
    expect(vuJoueurApres?.block?.id).toBe(bloc.block.id);
    expect(vuJoueurApres?.souvenirs.count).toBe(1);
    expect(await canReadRelationship(playerClient, { ...sens, userId: playerId })).toBe(true);

    // Une cible cachée au joueur : ni son nom ni rien d'elle.
    const { error: cacheError } = await admin.from("blocks").update({ visibility_level: "gm" }).eq("id", blocsPublics[0]);
    if (cacheError) throw new Error(cacheError.message);
    const cibleCachee = await getRelationshipFace(playerClient, { ...sens, userId: playerId });
    expect(cibleCachee?.target).toBeNull();
    expect(cibleCachee?.axes).toEqual({});
    expect(cibleCachee?.souvenirs.count).toBe(0);
    expect(await canReadRelationship(playerClient, { ...sens, userId: playerId })).toBe(false);
  });
});
