import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { resolveTargetedRoll } = await import("./targetedRoll");

/**
 * V3.1-107 (ADR 0069) — « Cibler » au nom d'un joueur, contre la base réelle :
 * lecture signée de la cible, dégâts seulement avec le jeton d'une attaque
 * qui touche (une fois), écriture signée, et aucune CA ni PV d'adversaire
 * dans la réponse ni dans le journal. Demande la clé du moteur
 * (docs/CLE-MOTEUR.md) ; sans elle, le test se saute.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && process.env.ENGINE_SIGNING_KEY && process.env.ENGINE_SIGNING_KEY_ID);

describe.skipIf(!hasCreds)("cibler côté joueur (V3.1-107, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let player: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let combatId: string;
  let pcEntityId: string;
  let gobelinId: string;

  const joueur = () => player.client as unknown as SupabaseClient<Database>;
  const gobelin = async () => (await admin.from("combat_participants").select("hp_current").eq("id", gobelinId).single()).data?.hp_current;
  const attaque = () =>
    resolveTargetedRoll(joueur(), {
      campaignId,
      combatId,
      callerId: player.id,
      locale: "fr",
      callerIsGm: false,
      input: { kind: "attack", actor: { kind: "character", entityId: pcEntityId }, action: { kind: "weapon", itemId: "i1" }, targetId: gobelinId, advantage: "advantage", critical: false, secret: false },
    });
  const degats = (damageToken?: string) =>
    resolveTargetedRoll(joueur(), {
      campaignId,
      combatId,
      callerId: player.id,
      locale: "fr",
      callerIsGm: false,
      input: {
        kind: "damage",
        actor: { kind: "character", entityId: pcEntityId },
        action: { kind: "weapon", itemId: "i1" },
        targetId: gobelinId,
        advantage: "normal",
        critical: false,
        secret: false,
        ...(damageToken ? { damageToken } : {}),
      },
    });

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, player] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_51").eq("is_official_base", true).limit(1).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test cibler joueur", slug: `integration-test-player-target-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id })
      .select("id")
      .single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: player.id, role: "player" },
    ]);
    const { data: pc } = await admin.from("entities").insert({ world_id: worldId, slug: "brunhild", name: "Brunhild", entity_kind: "character", created_by: gm.id }).select("id").single();
    pcEntityId = pc!.id;
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: pcEntityId, user_id: player.id, is_pc: true });
    await admin.from("blocks").insert([
      {
        entity_id: pcEntityId,
        block_type: "character",
        display: { label: "Personnage", layout: "character" },
        data: {
          __v: 1,
          species: { kind: "rule", key: "dwarf" },
          background: null,
          classes: [{ class: { kind: "rule", key: "fighter" }, level: 1, subclass: null }],
          abilities: { method: "manual", base: { str: 16, dex: 10, con: 12, int: 8, wis: 13, cha: 10 } },
          choices: {},
          hp_method: "fixed",
          portrait_asset_id: null,
        },
        visibility_level: "players",
        created_by: gm.id,
      },
      {
        entity_id: pcEntityId,
        block_type: "inventory",
        display: { label: "Inventaire", layout: "inventory" },
        data: { __v: 1, items: [{ id: "i1", ref: { kind: "rule", key: "shortsword" }, qty: 1, equipped: true }], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } },
        visibility_level: "players",
        created_by: gm.id,
      },
    ]);
    const { data: combat } = await admin.from("combats").insert({ campaign_id: campaignId, name: "Embuscade", status: "running", round: 1, turn_index: 0 }).select("id").single();
    combatId = combat!.id;
    const { data: rows } = await admin
      .from("combat_participants")
      .insert([
        { combat_id: combatId, source_kind: "custom", label: "Gobelin", initiative: 12, ac: 1, hp_max: 30, hp_current: 30, display_order: 0 },
        { combat_id: combatId, source_kind: "entity", entity_id: pcEntityId, label: "Brunhild", initiative: 10, ac: 16, hp_max: 12, hp_current: 12, display_order: 1 },
      ])
      .select("id, label");
    gobelinId = rows!.find((r) => r.label === "Gobelin")!.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("le joueur ne lit pas la cible lui-même : le moteur la lit par une demande signée", async () => {
    expect((await joueur().from("combat_participants").select("ac").eq("id", gobelinId)).data ?? []).toEqual([]);
  });

  it("des dégâts sans jeton sont refusés, rien n'est écrit", async () => {
    expect(await degats()).toMatchObject({ ok: false, reason: "invalid_action" });
    expect(await degats("faux.jeton")).toMatchObject({ ok: false, reason: "invalid_action" });
    expect(await gobelin()).toBe(30);
  });

  it("une attaque qui touche donne un jeton ; les dégâts s'appliquent une fois, sans CA ni PV d'adversaire dans la réponse ni le journal", async () => {
    // CA 1 : seul un 1 naturel rate ; avec l'avantage, presque jamais. On relance au plus cinq fois.
    let jeton: string | undefined;
    for (let i = 0; i < 5 && !jeton; i++) {
      const r = await attaque();
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.facts.join(" ")).not.toMatch(/CA/);
        jeton = r.chained?.token;
      }
    }
    expect(jeton).toBeDefined();

    const r = await degats(jeton);
    expect(r.ok).toBe(true);
    const apres = await gobelin();
    expect(apres).toBeLessThan(30);
    if (r.ok) {
      expect(r.changes.join(" ")).not.toMatch(/PV/);
      expect(r.changes.join(" ")).toMatch(/Gobelin est (blessé|en sang|à terre)/);
    }

    // Le même jeton, rejoué : la base refuse le même nonce, les PV ne bougent plus.
    await expect(degats(jeton)).rejects.toThrow();
    expect(await gobelin()).toBe(apres);

    // Le journal (lisible des joueurs) ne porte que les phrases.
    const { data: sessions } = await admin.from("sessions").select("id").eq("campaign_id", campaignId);
    const { data: evenements } = await admin
      .from("session_events")
      .select("kind, payload")
      .in("session_id", (sessions ?? []).map((x) => x.id))
      .eq("kind", "rule_application")
      .order("seq", { ascending: false })
      .limit(1);
    const payload = evenements?.[0]?.payload as Record<string, unknown> | undefined;
    expect(payload?.changes).toBeUndefined();
    expect(JSON.stringify(payload?.changes_text ?? [])).not.toMatch(/PV/);
  });
});
