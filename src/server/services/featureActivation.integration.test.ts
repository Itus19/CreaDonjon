import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { activateFeature } = await import("./featureActivation");
const { resolveCharacterActionContext } = await import("./characterActions");
const { getEntityRuntimeState } = await import("./runtimeState");
const { applyResolvedEffects } = await import("./targetedRoll");
const { breakConcentration } = await import("./concentration");
const { createRulesetVariant } = await import("./rules");
const { checkSheetActionAccess } = await import("./sheetActionAccess");
const { insertFeatureEffect } = await import("../repos/activeEffects");
const { effectToRow, instantiateDurableEffect } = await import("../../core/rules/durableEffects");

/**
 * V3.1-130 (ADR 0060 §5, ADR 0073) — jouer une règle contre la base réelle :
 * un Paladin 9 dont la variante déclare le Conduit divin (ressource) et
 * Abjuration d'ennemis (activation), trois gobelins en combat. Monde,
 * variante, combat et effets jetables.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

const EFFRAYE = {
  id: "frightened-abjure",
  label: { fr: "Effrayé (Abjuration)" },
  conditions: ["frightened"],
  modifiers: [],
  duration: { unit: "minute", amount: 1 },
  concentration: false,
  ends_on: [{ event: "damage_taken", subject: "bearer" }],
  token: null,
};

describe.skipIf(!hasCreds)("activer une règle (V3.1-130, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let joueuse: ReusableAccount;
  let autre: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let variantId: string;
  let paladinId: string;
  let combatId: string;
  let seanceId: string;
  const gobelins: string[] = [];
  const client = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;

  async function surcharge(entryKey: string, blockType: string, data: unknown) {
    const { error } = await client(gm).rpc("upsert_ruleset_override", {
      p_ruleset_id: variantId,
      p_entry_key: entryKey,
      p_block_type: blockType,
      p_action: "add_block",
      p_payload: { block_type: blockType, display: { label: blockType, layout: "key_values" }, data, display_order: 900 } as unknown as Json,
      p_patch: null as unknown as Json,
      p_note: "test V3.1-130",
    });
    if (error) throw new Error(error.message);
  }

  const effetsDe = async (colonne: "combat_participant_id" | "entity_id", id: string) =>
    (await admin.from("entity_active_effects").select("id, label, payload").eq(colonne, id).eq("source_kind", "feature")).data ?? [];
  const etatsDe = async (participantId: string) =>
    ((await admin.from("combat_participants").select("conditions").eq("id", participantId).single()).data?.conditions as string[]) ?? [];

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse, autre] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player"), getReusableTestAccount(admin, "playerB")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const variante = await createRulesetVariant(client(gm), { name: "Variante de test règles jouables", parentRulesetId: official!.id });
    variantId = variante!.id;

    await surcharge("paladin-channel-divinity", "resources", {
      resources: [{ key: "channel-divinity", label: { fr: "Conduit divin" }, max: { op: "ref", name: "column.class_specific_channel_divinity_charges" }, recharge: "short_rest_one" }],
    });
    await surcharge("paladin-abjure-foes", "activation", {
      activations: [
        {
          id: "abjure",
          label: { fr: "Abjuration d'ennemis" },
          cost: { action: "magic", resources: [{ key: "channel-divinity", amount: { op: "num", value: 1 } }] },
          targets: { kind: "creature", count: { op: "max", args: [{ op: "num", value: 1 }, { op: "ref", name: "ability.cha" }] } },
          effects: [{ action: "saving_throw", who: "target", ability: "wis", dc: { op: "ref", name: "spell_save_dc" }, on_fail: [{ action: "apply_effect", who: "target", effect: "frightened-abjure" }] }],
          variants: null,
        },
        {
          id: "veille",
          label: { fr: "Veille sacrée (test)" },
          cost: { action: "bonus", resources: [] },
          targets: { kind: "self" },
          effects: [{ action: "apply_effect", who: "self", effect: "veille" }],
          variants: null,
        },
      ],
      durable_effects: [
        EFFRAYE,
        { id: "veille", label: { fr: "Veille sacrée" }, conditions: [], modifiers: [{ target: "ac", op: "add", value: 1 }], duration: { unit: "minute", amount: 10 }, concentration: true, ends_on: [], token: null },
      ],
    });

    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test règles jouables", slug: `integration-test-activation-${Date.now()}`, owner_id: gm.id, default_ruleset_id: variantId })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: variantId, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: joueuse.id, role: "player" },
      { campaign_id: campaignId, user_id: autre.id, role: "player" },
    ]);

    const { data: pj } = await admin.from("entities").insert({ world_id: worldId, slug: "aldric", name: "Aldric", entity_kind: "character", created_by: gm.id }).select("id").single();
    paladinId = pj!.id;
    const { error: blocError } = await admin.from("blocks").insert({
      entity_id: paladinId,
      block_type: "character",
      display: { label: "Personnage", layout: "character" },
      created_by: gm.id,
      data: {
        __v: 1,
        species: { kind: "rule", key: "human" },
        background: null,
        classes: [{ class: { kind: "rule", key: "paladin" }, level: 9, subclass: null }],
        abilities: { method: "manual", base: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 16 } },
        choices: {},
        hp_method: "fixed",
        portrait_asset_id: null,
      },
    });
    if (blocError) throw new Error(blocError.message);
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: paladinId, user_id: joueuse.id, is_pc: true });

    const { data: seance } = await admin.from("sessions").insert({ campaign_id: campaignId, started_at: new Date().toISOString() }).select("id").single();
    seanceId = seance!.id;
    const { data: combat } = await admin.from("combats").insert({ campaign_id: campaignId, name: "Embuscade", status: "running", session_id: seance!.id, round: 1, turn_index: 0 }).select("id").single();
    combatId = combat!.id;
    const { data: lignes } = await admin
      .from("combat_participants")
      .insert([
        { combat_id: combatId, source_kind: "entity", entity_id: paladinId, label: "Aldric", initiative: 20, display_order: 0, hp_max: 80, hp_current: 80 },
        ...[1, 2, 3].map((n) => ({ combat_id: combatId, source_kind: "statblock", rule_key: "goblin-warrior", label: `Gobelin ${n}`, initiative: 10 - n, display_order: n, hp_max: 10, hp_current: 10 })),
      ])
      .select("id, label");
    for (const n of [1, 2, 3]) gobelins.push(lignes!.find((l) => l.label === `Gobelin ${n}`)!.id);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    if (variantId) await admin.from("rulesets").delete().eq("id", variantId);
  });

  it("Abjuration d'ennemis : 1 Conduit divin consommé, une sauvegarde par cible, Effrayé rangé PAR INSTANCE sur les échecs ; tout se relit", async () => {
    const avant = await resolveCharacterActionContext(client(gm), paladinId, campaignId, "fr");
    expect(avant?.sheet.resources.find((r) => r.key === "channel-divinity")?.max).toBe(2);

    const r = await activateFeature(client(gm), {
      entityId: paladinId, campaignId, ruleKey: "paladin-abjure-foes", activationId: "abjure", variantId: null,
      targetParticipantIds: [gobelins[0], gobelins[1]], callerId: gm.id, callerIsGm: true, locale: "fr",
    });
    if (!r.ok) throw new Error(r.reason);
    expect(r.used).toEqual({ "channel-divinity": 1 });

    // Relu après coup : l'usage dans l'état de jeu, et un effet par gobelin effrayé (et seulement eux).
    expect((await getEntityRuntimeState(client(gm), paladinId, campaignId)).resources["channel-divinity"]).toBe(1);
    for (const g of [gobelins[0], gobelins[1]]) {
      const effraye = (await etatsDe(g)).includes("frightened");
      expect((await effetsDe("combat_participant_id", g)).length).toBe(effraye ? 1 : 0);
    }
    expect(await effetsDe("combat_participant_id", gobelins[2])).toEqual([]);
    // Le journal porte l'application : les phrases des joueurs à l'événement, les jets (chiffres) au détail du MJ (ADR 0070).
    const { data: evts } = await admin.from("session_events").select("id").eq("session_id", seanceId).eq("kind", "rule_application").order("seq", { ascending: false }).limit(1);
    const { data: details } = await admin.from("session_event_gm_details").select("payload").eq("event_id", evts![0].id);
    expect(JSON.stringify(details)).toMatch(/Sauvegarde WIS contre DD 15/);
  });

  it("une quatrième cible est refusée, et sans Conduit divin restant l'activation l'est aussi, sans rien écrire", async () => {
    const base = { entityId: paladinId, campaignId, ruleKey: "paladin-abjure-foes", activationId: "abjure", variantId: null, callerId: gm.id, callerIsGm: true, locale: "fr" as const };
    expect(await activateFeature(client(gm), { ...base, targetParticipantIds: [...gobelins, gobelins[0]] })).toMatchObject({ ok: false, reason: "too_many_targets" });
    await admin.from("entity_runtime_state").update({ state: { ...(await getEntityRuntimeState(client(gm), paladinId, campaignId)), resources: { "channel-divinity": 2 } } as unknown as Json }).eq("entity_id", paladinId).eq("campaign_id", campaignId);
    expect(await activateFeature(client(gm), { ...base, targetParticipantIds: [gobelins[2]] })).toMatchObject({ ok: false, reason: "not_enough_resource" });
    expect(await effetsDe("combat_participant_id", gobelins[2])).toEqual([]);
  });

  it("l'Effrayé disparaît dès que son porteur subit des dégâts, état compris", async () => {
    const cible = gobelins[2];
    // Un Effrayé posé à coup sûr (les sauvegardes ci-dessus sont tirées par le serveur).
    const e = instantiateDurableEffect(EFFRAYE as never, { bearer: `participant:${cible}`, source: paladinId, activationId: "abjure", round: 1, currentTurn: paladinId });
    const ligne = effectToRow(e, "paladin-abjure-foes");
    await insertFeatureEffect(client(gm), { campaignId, bearer: { participantId: cible }, label: ligne.label, sourceKey: ligne.source_key, modifiers: ligne.modifiers as unknown as Json, duration: ligne.duration as unknown as Json, payload: ligne.payload as unknown as Json });
    await admin.from("combat_participants").update({ conditions: ["frightened"] }).eq("id", cible);

    await applyResolvedEffects(client(gm), {
      campaignId, callerId: gm.id, actor: null, scene: null, spend: null,
      effects: [{ action: "deal_damage", who: `participant:${cible}`, amount: 3 }],
      note: "test", fromEventId: null, combatId, gmJournal: true,
    });
    expect(await effetsDe("combat_participant_id", cible)).toEqual([]);
    expect(await etatsDe(cible)).not.toContain("frightened");
  });

  it("un effet de concentration compte sur la fiche, puis disparaît quand la concentration est rompue", async () => {
    const r = await activateFeature(client(gm), {
      entityId: paladinId, campaignId, ruleKey: "paladin-abjure-foes", activationId: "veille", variantId: null,
      targetParticipantIds: [], callerId: gm.id, callerIsGm: true, locale: "fr",
    });
    if (!r.ok) throw new Error(r.reason);
    expect(await effetsDe("entity_id", paladinId)).toHaveLength(1);
    expect((await getEntityRuntimeState(client(gm), paladinId, campaignId)).concentration?.label).toBe("Veille sacrée (test)");
    const fiche = await resolveCharacterActionContext(client(gm), paladinId, campaignId, "fr");
    const sansEffet = fiche!.sheet.ac.value - 1;
    expect(fiche!.sheet.ac.sources.some((s) => s.label === "Veille sacrée")).toBe(true);

    await breakConcentration(client(gm), { entityId: paladinId, campaignId, actorUserId: gm.id });
    expect(await effetsDe("entity_id", paladinId)).toEqual([]);
    expect((await resolveCharacterActionContext(client(gm), paladinId, campaignId, "fr"))!.sheet.ac.value).toBe(sansEffet);
  });

  it("un joueur sans droit sur la fiche est refusé ; il n'écrit pas non plus d'effet sur une instance par l'API", async () => {
    const acces = await checkSheetActionAccess(client(autre), { userId: autre.id, entityId: paladinId, campaignId });
    expect(acces.access).toBe("forbidden");
    const { error } = await client(autre).from("entity_active_effects").insert({
      campaign_id: campaignId, combat_participant_id: gobelins[0], source_kind: "feature", label: "intrus", payload: {},
    });
    expect(error).not.toBeNull();
    // La propriétaire du PJ, elle, a le droit d'agir sur sa fiche.
    expect((await checkSheetActionAccess(client(joueuse), { userId: joueuse.id, entityId: paladinId, campaignId })).access).not.toBe("forbidden");
  });
});
