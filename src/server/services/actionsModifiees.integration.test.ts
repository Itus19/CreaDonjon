import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { activateFeature } = await import("./featureActivation");
const { resolveTargetedRoll } = await import("./targetedRoll");
const { answerRollWindow, resumeRollWindow } = await import("./rollWindowResume");
const { getEntityRuntimeState } = await import("./runtimeState");
const { createRulesetVariant, getRuleEntryForWorld } = await import("./rules");

/**
 * V3.1-165 (ADR 0076) — les actions modifiées contre la base réelle : un sort
 * joué par son activation (emplacement, `slot.level`, concentration), le
 * budget du tour compté (Attaque supplémentaire, écrite par la joueuse en
 * changement signé), Bouclier en réaction (emplacement dépensé à la reprise).
 * Les activations des sorts sont posées sur une variante jetable.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && process.env.ENGINE_SIGNING_KEY);

const num = (value: number) => ({ op: "num", value });
const ref = (name: string) => ({ op: "ref", name });

describe.skipIf(!hasCreds)("les actions modifiées (V3.1-165, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let joueuse: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let variantId: string;
  let combatId: string;
  const ids: Record<string, string> = {};
  const lignes: Record<string, string> = {};
  let nomCimeterre = "";
  const client = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;

  async function surcharge(entryKey: string, blockType: string, data: unknown) {
    const { error } = await client(gm).rpc("upsert_ruleset_override", {
      p_ruleset_id: variantId, p_entry_key: entryKey, p_block_type: blockType, p_action: "add_block",
      p_payload: { block_type: blockType, display: { label: blockType, layout: "key_values" }, data, display_order: 900 } as unknown as Json,
      p_patch: null as unknown as Json, p_note: "test V3.1-165",
    });
    if (error) throw new Error(error.message);
  }

  async function personnage(slug: string, classe: string, niveau: number, extra: { known?: string[]; ability?: string; arme?: boolean } = {}) {
    const { data: e } = await admin.from("entities").insert({ world_id: worldId, slug, name: slug, entity_kind: "character", created_by: gm.id }).select("id").single();
    const blocs: Database["public"]["Tables"]["blocks"]["Insert"][] = [
      {
        entity_id: e!.id, block_type: "character", display: { label: "Personnage", layout: "character" }, created_by: gm.id, visibility_level: "players",
        data: { __v: 1, species: { kind: "rule", key: "human" }, background: null, classes: [{ class: { kind: "rule", key: classe }, level: niveau, subclass: null }], abilities: { method: "manual", base: { str: 16, dex: 12, con: 14, int: 14, wis: 16, cha: 10 } }, choices: {}, hp_method: "fixed", portrait_asset_id: null } as unknown as Json,
      },
    ];
    if (extra.known) {
      blocs.push({
        entity_id: e!.id, block_type: "spellcasting", display: { label: "Incantation", layout: "spellcasting" }, created_by: gm.id, visibility_level: "players",
        data: { __v: 1, sources: [{ class: classe, ability: extra.ability ?? "wis" }], known: extra.known.map((k) => ({ ref: { kind: "rule", key: k }, origin: "granted" })), prepared: [], slot_override: null } as unknown as Json,
      });
    }
    if (extra.arme) {
      blocs.push({
        entity_id: e!.id, block_type: "inventory", display: { label: "Inventaire", layout: "inventory" }, created_by: gm.id, visibility_level: "players",
        data: { __v: 1, items: [{ id: "epee", ref: { kind: "rule", key: "longsword" }, qty: 1, equipped: true }], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } } as unknown as Json,
      });
    }
    const { error } = await admin.from("blocks").insert(blocs);
    if (error) throw new Error(error.message);
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: e!.id, user_id: joueuse.id, is_pc: true });
    ids[slug] = e!.id;
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    variantId = (await createRulesetVariant(client(gm), { name: "Variante de test actions modifiées", parentRulesetId: official!.id }))!.id;
    // Un sort de concentration dont le nombre de cibles monte avec l'emplacement (donnée de TEST, pas le SRD).
    await surcharge("shield-of-faith", "activation", {
      activations: [{ id: "cast", label: { fr: "Bouclier de la foi (test)" }, cost: { action: "bonus", resources: [], slot: { level: 1 } }, targets: { kind: "ally", count: { op: "sub", args: [{ op: "add", args: [num(3), ref("slot.level")] }, num(1)] } }, effects: [{ action: "apply_effect", who: "target", effect: "sof" }], variants: null }],
      durable_effects: [{ id: "sof", label: { fr: "Bouclier de la foi" }, conditions: [], modifiers: [{ target: "ac", op: "add", value: 2 }], duration: { unit: "minute", amount: 10 }, concentration: true, ends_on: [], token: null }],
    });
    await surcharge("shield", "activation", {
      activations: [{
        id: "shield", label: { fr: "Bouclier" }, cost: { action: "reaction", resources: [], slot: { level: 1 } }, targets: { kind: "self" },
        effects: [{ action: "apply_effect", who: "self", effect: "shielded" }], variants: null,
        trigger: { on: "roll", roll: "attack", subject: "attack_against_self", when: "hit" }, roll_operations: [{ op: "ac_bonus", value: num(5) }],
      }],
      durable_effects: [{ id: "shielded", label: { fr: "Bouclier" }, conditions: [], modifiers: [{ target: "ac", op: "add", value: 5 }], duration: { unit: "round", amount: 1 }, concentration: false, ends_on: [], token: null }],
    });
    await surcharge("extra-attack", "modifiers", { modifiers: [{ target: "attacks_per_action", op: "set", value: 2 }] });

    const { data: world, error } = await admin.from("worlds").insert({ name: "Monde de test actions modifiées", slug: `integration-test-actions-${Date.now()}`, owner_id: gm.id, default_ruleset_id: variantId }).select("id").single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: variantId, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([{ campaign_id: campaignId, user_id: gm.id, role: "gm" }, { campaign_id: campaignId, user_id: joueuse.id, role: "player" }]);
    await personnage("clerc", "cleric", 3, { known: ["shield-of-faith"] });
    await personnage("brom", "fighter", 5, { arme: true });
    await personnage("mage", "wizard", 1, { known: ["shield"], ability: "int" });
    const { data: seance } = await admin.from("sessions").insert({ campaign_id: campaignId, started_at: new Date().toISOString() }).select("id").single();
    const { data: combat } = await admin.from("combats").insert({ campaign_id: campaignId, name: "Embuscade", status: "running", session_id: seance!.id, round: 1, turn_index: 1 }).select("id").single();
    combatId = combat!.id;
    const { data: rows } = await admin
      .from("combat_participants")
      .insert([
        { combat_id: combatId, source_kind: "entity", entity_id: ids.clerc, label: "Clerc", initiative: 20, display_order: 0, hp_max: 30, hp_current: 30, ac: 16, is_ally: false, rule_key: null },
        { combat_id: combatId, source_kind: "entity", entity_id: ids.brom, label: "Brom", initiative: 18, display_order: 1, hp_max: 50, hp_current: 50, ac: 18, is_ally: false, rule_key: null },
        { combat_id: combatId, source_kind: "entity", entity_id: ids.mage, label: "Mage", initiative: 16, display_order: 2, hp_max: 200, hp_current: 200, ac: 12, is_ally: false, rule_key: null },
        ...[1, 2].map((n) => ({ combat_id: combatId, source_kind: "statblock", rule_key: "goblin-warrior", label: `Allié ${n}`, initiative: 10 - n, display_order: 2 + n, hp_max: 10, hp_current: 10, is_ally: true, ac: 12, entity_id: null })),
        { combat_id: combatId, source_kind: "statblock", rule_key: "goblin-warrior", label: "Gobelin", initiative: 5, display_order: 9, hp_max: 300, hp_current: 300, ac: 1, is_ally: false, entity_id: null },
      ])
      .select("id, label");
    for (const r of rows!) lignes[r.label] = r.id;
    const fiche = await getRuleEntryForWorld(client(gm), worldId, "goblin-warrior", "fr");
    const actions = (fiche?.blocks.find((b) => b.blockType === "actions")?.data as { actions?: { name: string; attack_bonus?: number }[] } | undefined)?.actions ?? [];
    nomCimeterre = actions.find((a) => a.attack_bonus !== undefined)?.name ?? "";
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    if (variantId) await admin.from("rulesets").delete().eq("id", variantId);
  });

  it("un sort joué par son activation : niveau 2, quatre cibles, emplacement de niveau 2 dépensé, concentration ; une cinquième cible est refusée", async () => {
    const base = { entityId: ids.clerc, campaignId, ruleKey: "shield-of-faith", activationId: "cast", variantId: null, callerId: gm.id, callerIsGm: true, locale: "fr" as const };
    const cinq = [lignes.Brom, lignes.Mage, lignes["Allié 1"], lignes["Allié 2"], lignes.Clerc];
    expect(await activateFeature(client(gm), { ...base, targetParticipantIds: cinq, spell: { slotLevel: 2 } })).toMatchObject({ ok: false, reason: "too_many_targets" });
    const r = await activateFeature(client(gm), { ...base, targetParticipantIds: cinq.slice(0, 4), spell: { slotLevel: 2 } });
    if (!r.ok) throw new Error(r.reason);
    expect(r.applied).toHaveLength(4);
    const etat = await getEntityRuntimeState(client(gm), ids.clerc, campaignId);
    expect(etat.spell_slots_used["2"]).toBe(1);
    expect(etat.concentration).toBeTruthy();
    // Action bonus dépensée sur le budget du tour du Clerc.
    const { data: ligne } = await admin.from("combat_participants").select("turn_usage").eq("id", lignes.Clerc).single();
    expect((ligne!.turn_usage as { budget?: { bonus: number } }).budget?.bonus).toBe(0);
  });

  it("la fiche du Guerrier 5 compte deux attaques par action", async () => {
    const { resolveCharacterActionContext } = await import("./characterActions");
    const ctx = await resolveCharacterActionContext(client(gm), ids.brom, campaignId, "fr");
    const extra = ctx!.sheet.features.find((f) => f.key === "extra-attack");
    expect({ present: Boolean(extra), modificateurs: extra?.modifiers.map((m) => m.target), attaques: ctx!.sheet.attacksPerAction }).toEqual({ present: true, modificateurs: ["attacks_per_action"], attaques: 2 });
  });

  it("Attaque supplémentaire, par la joueuse (changement signé) : deux attaques pour une action, la troisième est signalée", async () => {
    const attaque = () =>
      resolveTargetedRoll(client(joueuse), {
        campaignId, combatId, callerId: joueuse.id, locale: "fr", callerIsGm: false,
        input: { kind: "attack", actor: { kind: "character", entityId: ids.brom }, action: { kind: "weapon", itemId: "epee" }, targetId: lignes.Gobelin, advantage: "normal", critical: false, secret: false },
      });
    const un = await attaque();
    const deux = await attaque();
    const trois = await attaque();
    for (const r of [un, deux, trois]) if (!r.ok) throw new Error(r.reason);
    const indices = [un, deux, trois].map((r) => (r.ok ? r.hints.some((h) => h.includes("n'a plus d'attaque")) : null));
    expect(indices).toEqual([false, false, true]);
    const { data: ligne } = await admin.from("combat_participants").select("turn_usage").eq("id", lignes.Brom).single();
    expect((ligne!.turn_usage as { budget?: unknown }).budget).toMatchObject({ at: "1:1", action: -1, attacks: 0 });
  });

  it("Bouclier : un gobelin touche le Mage ; « utiliser » ajoute 5 à sa CA contre ce jet et dépense l'emplacement de niveau 1", async () => {
    let fenetre: string | null = null;
    let total = 0;
    for (let i = 0; i < 8 && !fenetre; i++) {
      const r = await resolveTargetedRoll(client(gm), {
        campaignId, combatId, callerId: gm.id, locale: "fr",
        input: { kind: "attack", actor: { kind: "participant", participantId: lignes.Gobelin }, action: { kind: "monster_action", name: nomCimeterre }, targetId: lignes.Mage, advantage: "normal", critical: false, secret: false },
      });
      if (!r.ok) throw new Error(r.reason);
      fenetre = r.rollWindowId;
    }
    if (!fenetre) throw new Error("aucune touche en 8 attaques");
    const { data: w } = await admin.from("roll_windows").select("view, choices").eq("id", fenetre).single();
    expect((w!.choices as { rule_key: string }[]).map((c) => c.rule_key)).toEqual(["shield"]);
    total = (w!.view as { total: number }).total;
    await answerRollWindow(client(joueuse), { windowId: fenetre, index: 0, use: true, callerId: joueuse.id, locale: "fr" });
    const repris = await resumeRollWindow(client(gm), { windowId: fenetre, campaignId, callerId: gm.id, locale: "fr" });
    if (repris.origin !== "targeted" || !repris.result.ok) throw new Error("reprise attendue");
    // CA 12 + 5 contre ce jet : un 20 naturel touche toujours ; sinon, raté sous 17.
    const naturel = (w!.view as { natural: number | null }).natural;
    if (naturel !== 20) expect(repris.result.verdict).toBe(total >= 17 ? "hit" : "miss");
    expect((await getEntityRuntimeState(client(gm), ids.mage, campaignId)).spell_slots_used["1"]).toBe(1);
  }, 180000);
});
