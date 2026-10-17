import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPlayerCombatView } from "./playerCombatView";
import { getCombatDetail } from "./combats";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-102 (ADR 0040) — l'initiative vue par une joueuse, contre la vraie
 * base : ni PV, ni CA, ni bestiaire, ni fiche d'origine d'un adversaire ; le
 * même tour en cours que l'écran du MJ ; refus pour un non-membre ; et le
 * combat « touché » quand un participant change (signal temps réel).
 * Comptes du groupe fixe (docs/TESTS.md §2), monde supprimé à la fin.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("vue d'initiative des joueurs (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let gmClient: SupabaseClient;
  let playerClient: SupabaseClient;
  let outsiderClient: SupabaseClient;
  let worldId: string;
  let campaignId: string;
  let combatId: string;
  let npcEntityId: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const [gm, player, outsider] = await Promise.all([
      getReusableTestAccount(admin, "gm"),
      getReusableTestAccount(admin, "player"),
      getReusableTestAccount(admin, "outsider"),
    ]);
    gmClient = gm.client;
    playerClient = player.client;
    outsiderClient = outsider.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test initiative joueurs", slug: `integration-test-combat-view-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: official, error: officialError } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel");
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test initiative", ruleset_id: official.id, mode: "campaign" })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "creation campagne echouee");
    campaignId = campaign.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: player.id, role: "player" },
    ]);

    const { data: entities, error: entitiesError } = await admin
      .from("entities")
      .insert([
        { world_id: worldId, slug: "naivara", name: "Naivara", entity_kind: "character", created_by: gm.id },
        { world_id: worldId, slug: "vargas", name: "Vargas le Traître", entity_kind: "character", created_by: gm.id },
      ])
      .select("id, slug");
    if (entitiesError || !entities) throw new Error(entitiesError?.message ?? "creation entites echouee");
    const pcEntityId = entities.find((e) => e.slug === "naivara")!.id;
    npcEntityId = entities.find((e) => e.slug === "vargas")!.id;
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: pcEntityId, user_id: player.id, is_pc: true });

    const { data: combat, error: combatError } = await admin
      .from("combats")
      .insert({ campaign_id: campaignId, name: "Embuscade", status: "running", round: 1, turn_index: 1 })
      .select("id")
      .single();
    if (combatError || !combat) throw new Error(combatError?.message ?? "creation combat echouee");
    combatId = combat.id;

    const { data: participants, error: participantsError } = await admin
      .from("combat_participants")
      // Toutes les colonnes sur chaque ligne : en insertion groupée, une colonne absente vaut null, pas sa valeur par défaut.
      .insert([
        { combat_id: combatId, source_kind: "entity", entity_id: pcEntityId, rule_key: null, label: "Naivara", initiative: 18, ac: 14, hp_max: 15, hp_current: 12, temp_hp: 3, is_ally: false, conditions: [], display_order: 1000 },
        { combat_id: combatId, source_kind: "statblock", entity_id: null, rule_key: "goblin", label: "Gobelin 1", initiative: 12, ac: 15, hp_max: 7, hp_current: 3, temp_hp: 0, is_ally: false, conditions: ["Prone"], display_order: 2000 },
        { combat_id: combatId, source_kind: "entity", entity_id: npcEntityId, rule_key: null, label: "Silhouette encapuchonnée", initiative: 12, ac: 17, hp_max: 20, hp_current: 11, temp_hp: 0, is_ally: false, conditions: [], display_order: 1500 },
        { combat_id: combatId, source_kind: "custom", entity_id: null, rule_key: null, label: "Garde allié", initiative: 5, ac: 13, hp_max: 10, hp_current: 0, temp_hp: 0, is_ally: true, conditions: [], display_order: 3000 },
        { combat_id: combatId, source_kind: "statblock", entity_id: null, rule_key: "ogre", label: "Ogre", initiative: 3, ac: 11, hp_max: 59, hp_current: 59, temp_hp: 0, is_ally: false, conditions: [], display_order: 4000 },
      ])
      .select("id, label");
    if (participantsError || !participants) throw new Error(participantsError?.message ?? "creation participants echouee");
    for (const p of participants) ids[p.label] = p.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("une joueuse voit l'ordre, le tour et les états, jamais les PV, la CA ou l'origine d'un adversaire", async () => {
    const view = await getPlayerCombatView(playerClient, campaignId);
    expect(view.kind).toBe("ok");
    if (view.kind !== "ok") return;

    const byLabel = new Map(view.participants.map((p) => [p.label, p]));
    expect(byLabel.get("Naivara")).toMatchObject({ side: "ally", hp: { current: 12, max: 15, temp: 3 }, wound: null });
    expect(byLabel.get("Garde allié")).toMatchObject({ side: "ally", hp: { current: 0, max: 10, temp: 0 } });
    expect(byLabel.get("Gobelin 1")).toMatchObject({ side: "enemy", hp: null, wound: "bloodied", entityId: null, conditions: ["Prone"] });
    expect(byLabel.get("Silhouette encapuchonnée")).toMatchObject({ side: "enemy", hp: null, wound: "hurt", entityId: null });
    expect(byLabel.get("Ogre")).toMatchObject({ wound: "unhurt" });

    // Rien de ce qui part vers la joueuse ne porte un secret d'adversaire.
    const sent = JSON.stringify(view);
    expect(sent).not.toContain("goblin");
    expect(sent).not.toContain("ogre\"");
    expect(sent).not.toContain("Vargas");
    expect(sent).not.toContain(npcEntityId);
    expect(sent).not.toMatch(/"ac"/);
    expect(sent).not.toMatch(/"hp_?[cC]urrent":\s*(3|11|59)\b/);
  });

  it("le tour en cours désigne le même participant que l'écran du MJ", async () => {
    const view = await getPlayerCombatView(playerClient, campaignId);
    const detail = await getCombatDetail(gmClient, combatId);
    if (view.kind !== "ok" || !detail) throw new Error("vue ou detail introuvable");
    expect(view.participants.map((p) => p.id)).toEqual(detail.participants.map((p) => p.id));
    const current = view.participants.filter((p) => p.isCurrent);
    expect(current.map((p) => p.id)).toEqual([detail.participants[detail.combat.turn_index].id]);
  });

  it("un non-membre reçoit un refus, y compris en appelant la fonction directement", async () => {
    expect((await getPlayerCombatView(outsiderClient, campaignId)).kind).toBe("forbidden");
    const { data, error } = await outsiderClient.rpc("combat_player_view", { p_combat: combatId });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("changer un participant touche le combat (signal temps réel des joueurs)", async () => {
    const { data: before } = await admin.from("combats").select("updated_at").eq("id", combatId).single();
    const { error } = await gmClient.from("combat_participants").update({ hp_current: 2 }).eq("id", ids["Gobelin 1"]);
    expect(error).toBeNull();
    const { data: after } = await admin.from("combats").select("updated_at").eq("id", combatId).single();
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(new Date(before!.updated_at).getTime());
  });
});
