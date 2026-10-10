import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import { checkSheetActionAccess } from "./sheetActionAccess";
import { writeTableSettings } from "./tableSettings";

/**
 * V3.1-108 (ADR 0043) — sur la vraie base : une joueuse n'ecrit plus l'etat
 * de jeu d'une autre fiche (RLS `can_edit_entity`), le MJ l'ecrit toujours ;
 * et la porte des actions de fiche applique les interrupteurs de la table.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("etat de jeu ecrit par qui peut editer la fiche (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let gm: { id: string; client: SupabaseClient };
  let player: { id: string; client: SupabaseClient };
  let playerB: { id: string; client: SupabaseClient };
  let worldId: string;
  let campaignId: string;
  let pcA: string;
  let pcB: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, player, playerB] = await Promise.all([
      getReusableTestAccount(admin, "gm"),
      getReusableTestAccount(admin, "player"),
      getReusableTestAccount(admin, "playerB"),
    ]);

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test etat de jeu", slug: `integration-test-runtime-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: official, error: officialError } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test etat de jeu", ruleset_id: official.id, mode: "campaign", gm_user_id: gm.id })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;

    const { error: membersError } = await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: player.id, role: "player" },
      { campaign_id: campaignId, user_id: playerB.id, role: "player" },
    ]);
    if (membersError) throw new Error(membersError.message);

    const { data: pcs, error: pcsError } = await admin
      .from("entities")
      .insert([
        { world_id: worldId, slug: "pj-a", name: "PJ A", entity_kind: "character", created_by: gm.id },
        { world_id: worldId, slug: "pj-b", name: "PJ B", entity_kind: "character", created_by: gm.id },
      ])
      .select("id, slug");
    if (pcsError || !pcs) throw new Error(pcsError?.message ?? "creation fiches echouee");
    pcA = pcs.find((p) => p.slug === "pj-a")!.id;
    pcB = pcs.find((p) => p.slug === "pj-b")!.id;

    const { error: claimError } = await admin.from("campaign_characters").insert([
      { campaign_id: campaignId, entity_id: pcA, user_id: player.id, is_pc: true },
      { campaign_id: campaignId, entity_id: pcB, user_id: playerB.id, is_pc: true },
    ]);
    if (claimError) throw new Error(claimError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("une joueuse ecrit l'etat de sa fiche, pas celui d'une autre", async () => {
    const { error: ownError } = await player.client
      .from("entity_runtime_state")
      .insert({ entity_id: pcA, campaign_id: campaignId, state: { hp: { current: 9, temp: 0 } } });
    expect(ownError).toBeNull();

    const { error: otherError } = await player.client
      .from("entity_runtime_state")
      .insert({ entity_id: pcB, campaign_id: campaignId, state: { hp: { current: 0, temp: 0 } } });
    expect(otherError).not.toBeNull();
    const { data: rows } = await admin.from("entity_runtime_state").select("id").eq("entity_id", pcB);
    expect(rows).toEqual([]);
  });

  it("le MJ ecrit l'etat de n'importe quelle fiche du monde", async () => {
    const { error } = await gm.client
      .from("entity_runtime_state")
      .insert({ entity_id: pcB, campaign_id: campaignId, state: { hp: { current: 4, temp: 0 } } });
    expect(error).toBeNull();
    await player.client.from("entity_runtime_state").update({ state: { hp: { current: 0, temp: 0 } } }).eq("entity_id", pcB);
    const { data: row } = await admin.from("entity_runtime_state").select("state").eq("entity_id", pcB).single();
    expect(row?.state).toEqual({ hp: { current: 4, temp: 0 } });
  });

  it("la porte des actions : fiche d'une autre refusee, campagne inconnue introuvable", async () => {
    expect((await checkSheetActionAccess(player.client, { userId: player.id, entityId: pcB, campaignId })).access).toBe("forbidden");
    const unknownCampaign = "00000000-0000-4000-8000-000000000000";
    expect((await checkSheetActionAccess(player.client, { userId: player.id, entityId: pcA, campaignId: unknownCampaign })).access).toBe("not_found");
  });

  it("les interrupteurs : inspiration au MJ par defaut, PV coupes par le MJ, le MJ jamais concerne", async () => {
    const check = (who: { id: string; client: SupabaseClient }, field: "hp" | "inspiration") =>
      checkSheetActionAccess(who.client, { userId: who.id, entityId: pcA, campaignId, field }).then((r) => r.access);
    expect(await check(player, "inspiration")).toBe("switch_off");
    expect(await check(player, "hp")).toBe("ok");
    expect(await check(gm, "inspiration")).toBe("ok");

    expect(await writeTableSettings(player.client, { userId: player.id, campaignId, patch: { player_can_edit: { hp: true } } })).toBe("forbidden");
    const written = await writeTableSettings(gm.client, { userId: gm.id, campaignId, patch: { player_can_edit: { hp: false } } });
    expect(written).not.toBe("forbidden");
    expect(await check(player, "hp")).toBe("switch_off");
    expect(await check(gm, "hp")).toBe("ok");
  });
});
