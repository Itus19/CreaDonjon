import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { pauseCombat, restartCombat, resumeCombat } from "./combats";
import { getPlayerCombatView } from "./playerCombatView";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-38 — « Quitter le combat » suspend sans rien perdre ; « Reprendre tel
 * quel » rend le même round et le même tour ; « Recommencer » efface les
 * initiatives et revient aux jets. Un combat suspendu n'est plus en cours
 * pour les joueuses.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("suspendre, reprendre, recommencer un combat (V3.1-38, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let player: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let combatId: string;
  let pcEntityId: string;

  const typed = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;
  const lire = async () => {
    const { data } = await admin.from("combats").select("status, round, turn_index").eq("id", combatId).single();
    return data;
  };

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, player] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test suspension", slug: `integration-test-combat-pause-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id })
      .select("id")
      .single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: player.id, role: "player" },
    ]);
    const { data: combat } = await admin
      .from("combats")
      .insert({ campaign_id: campaignId, name: "Embuscade", status: "running", round: 3, turn_index: 1 })
      .select("id")
      .single();
    combatId = combat!.id;
    await admin.from("combat_participants").insert([
      { combat_id: combatId, source_kind: "custom", label: "Gobelin", initiative: 14, ac: 13, hp_max: 7, hp_current: 4, display_order: 0 },
      { combat_id: combatId, source_kind: "custom", label: "Loup", initiative: 9, ac: 12, hp_max: 11, hp_current: 11, display_order: 1 },
    ]);
    const { data: pc } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "naivara", name: "Naivara", entity_kind: "character", created_by: gm.id })
      .select("id")
      .single();
    pcEntityId = pc!.id;
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: pcEntityId, user_id: player.id, is_pc: true });
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("une joueuse ne peut pas suspendre", async () => {
    await expect(pauseCombat(typed(player), { combatId, actorUserId: player.id })).rejects.toThrow();
    expect(await lire()).toEqual({ status: "running", round: 3, turn_index: 1 });
  });

  it("suspendre garde round et tour, et la joueuse ne voit plus de combat en cours", async () => {
    expect((await pauseCombat(typed(gm), { combatId, actorUserId: gm.id }))?.status).toBe("paused");
    expect(await lire()).toEqual({ status: "paused", round: 3, turn_index: 1 });
    expect((await getPlayerCombatView(typed(player), campaignId)).kind).toBe("none");
    expect(await pauseCombat(typed(gm), { combatId, actorUserId: gm.id })).toBeNull();
  });

  it("reprendre tel quel : même round, même tour, PV intacts", async () => {
    expect((await resumeCombat(typed(gm), { combatId, actorUserId: gm.id }))?.status).toBe("running");
    expect(await lire()).toEqual({ status: "running", round: 3, turn_index: 1 });
    const { data } = await admin.from("combat_participants").select("label, hp_current, initiative").eq("combat_id", combatId).order("display_order");
    expect(data).toEqual([
      { label: "Gobelin", hp_current: 4, initiative: 14 },
      { label: "Loup", hp_current: 11, initiative: 9 },
    ]);
    expect(await resumeCombat(typed(gm), { combatId, actorUserId: gm.id })).toBeNull();
  });

  it("recommencer : initiatives effacées, retour aux jets au round 0, PV gardés", async () => {
    await pauseCombat(typed(gm), { combatId, actorUserId: gm.id });
    expect((await restartCombat(typed(gm), { combatId, actorUserId: gm.id }))?.status).toBe("rolling");
    expect(await lire()).toEqual({ status: "rolling", round: 0, turn_index: 0 });
    const { data } = await admin.from("combat_participants").select("hp_current, initiative").eq("combat_id", combatId).order("display_order");
    expect(data).toEqual([
      { hp_current: 4, initiative: null },
      { hp_current: 11, initiative: null },
    ]);
  });

  it("les PV et les états posés sur la fiche de la joueuse se voient dans l'initiative du MJ", async () => {
    const { data: combat2 } = await admin
      .from("combats")
      .insert({ campaign_id: campaignId, name: "Second combat", status: "running", round: 1, turn_index: 0 })
      .select("id")
      .single();
    const { data: termine } = await admin
      .from("combats")
      .insert({ campaign_id: campaignId, name: "Ancien combat", status: "ended", round: 4, turn_index: 0 })
      .select("id")
      .single();
    await admin.from("combat_participants").insert([
      { combat_id: combat2!.id, source_kind: "entity", entity_id: pcEntityId, label: "Naivara", initiative: 12, ac: 15, hp_max: 20, hp_current: 20, display_order: 0 },
      { combat_id: termine!.id, source_kind: "entity", entity_id: pcEntityId, label: "Naivara", initiative: 12, ac: 15, hp_max: 20, hp_current: 20, display_order: 0 },
    ]);

    // La joueuse écrit l'état de jeu de SA fiche (RLS can_edit_entity), comme le font les routes de la fiche.
    const state = { hp: { current: 13, temp: 5 }, hit_dice: {}, exhaustion: 0, conditions: ["prone"] };
    const { error } = await typed(player).from("entity_runtime_state").insert({ entity_id: pcEntityId, campaign_id: campaignId, state });
    expect(error).toBeNull();

    const lignes = async (id: string) => {
      const { data } = await admin.from("combat_participants").select("hp_current, temp_hp, conditions").eq("combat_id", id).single();
      return data;
    };
    expect(await lignes(combat2!.id)).toEqual({ hp_current: 13, temp_hp: 5, conditions: ["prone"] });
    // Un combat terminé garde son histoire.
    expect(await lignes(termine!.id)).toEqual({ hp_current: 20, temp_hp: 0, conditions: [] });
  });
});
