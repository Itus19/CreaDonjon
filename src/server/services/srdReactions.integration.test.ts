import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { resolveTargetedRoll } = await import("./targetedRoll");
const { answerRollWindow, resumeRollWindow: resumeAny } = await import("./rollWindowResume");
/** Les fenêtres de ce test viennent de jets ciblés : on lit leur résultat. */
async function resumeRollWindow(...args: Parameters<typeof resumeAny>) {
  const r = await resumeAny(...args);
  if (r.origin !== "targeted") throw new Error(`origine inattendue : ${r.origin}`);
  return r.result;
}
const { resolveCharacterActionContext } = await import("./characterActions");
const { getRuleEntryForWorld } = await import("./rules");

/**
 * V3.1-162 — les réactions du SRD, contre la base réelle APRÈS réimport, sur
 * l'officiel sans variante : Esquive instinctive et Attaque sournoise d'une
 * Roublarde 5 en combat contre un gobelin. Monde jetable, comptes réutilisés.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && process.env.ENGINE_SIGNING_KEY);

describe.skipIf(!hasCreds)("les réactions du SRD (V3.1-162, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let joueuse: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let combatId: string;
  let lia: string;
  let liaLigne: string;
  let gobelin: string;
  let nomCimeterre: string;
  const client = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;

  async function personnage(slug: string, data: Record<string, unknown>) {
    const { data: e } = await admin.from("entities").insert({ world_id: worldId, slug, name: slug, entity_kind: "character", created_by: gm.id }).select("id").single();
    const { error } = await admin.from("blocks").insert({
      entity_id: e!.id,
      block_type: "character",
      display: { label: "Personnage", layout: "character" },
      created_by: gm.id,
      data: { __v: 1, background: null, abilities: { method: "manual", base: { str: 10, dex: 16, con: 14, int: 12, wis: 10, cha: 14 } }, choices: {}, hp_method: "fixed", portrait_asset_id: null, ...data } as unknown as Json,
    });
    if (error) throw new Error(error.message);
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: e!.id, user_id: joueuse.id, is_pc: true });
    return e!.id;
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test réactions SRD", slug: `integration-test-reactions-srd-${Date.now()}`, owner_id: gm.id, default_ruleset_id: official!.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: joueuse.id, role: "player" },
    ]);
    lia = await personnage("lia", { species: { kind: "rule", key: "human" }, classes: [{ class: { kind: "rule", key: "rogue" }, level: 5, subclass: null }] });
    const { error: ie } = await admin.from("blocks").insert({
      entity_id: lia,
      block_type: "inventory",
      display: { label: "Inventaire", layout: "inventory" },
      created_by: gm.id,
      data: { __v: 1, items: [{ id: "rapiere", ref: { kind: "rule", key: "rapier" }, qty: 1, equipped: true }], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } },
    });
    if (ie) throw new Error(ie.message);
    const { data: seance } = await admin.from("sessions").insert({ campaign_id: campaignId, started_at: new Date().toISOString() }).select("id").single();
    const { data: combat } = await admin.from("combats").insert({ campaign_id: campaignId, name: "Embuscade", status: "running", session_id: seance!.id, round: 1, turn_index: 0 }).select("id").single();
    combatId = combat!.id;
    const { data: lignes } = await admin
      .from("combat_participants")
      .insert([
        { combat_id: combatId, source_kind: "entity", entity_id: lia, label: "Lia", initiative: 20, display_order: 0, hp_max: 100, hp_current: 100, ac: 14 },
        { combat_id: combatId, source_kind: "statblock", rule_key: "goblin-warrior", label: "Gobelin", initiative: 5, display_order: 1, hp_max: 200, hp_current: 200, ac: 15 },
      ])
      .select("id, label");
    liaLigne = lignes!.find((l) => l.label === "Lia")!.id;
    gobelin = lignes!.find((l) => l.label === "Gobelin")!.id;
    const fiche = await getRuleEntryForWorld(client(gm), worldId, "goblin-warrior", "fr");
    const actions = (fiche?.blocks.find((b) => b.blockType === "actions")?.data as { actions?: { name: string; damage?: unknown[] }[] } | undefined)?.actions ?? [];
    nomCimeterre = actions.find((a) => (a.damage?.length ?? 0) > 0)?.name ?? "";
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("la Roublarde 5 porte Esquive instinctive et Attaque sournoise en réaction (fiche calculée)", async () => {
    const ctx = await resolveCharacterActionContext(client(gm), lia, campaignId, "fr");
    const declenchees = ctx!.sheet.features.flatMap((f) => (f.activation?.activations ?? []).filter((a) => a.trigger).map((a) => `${f.key}:${a.id}`));
    expect(declenchees).toEqual(expect.arrayContaining(["rogue-uncanny-dodge:uncanny-dodge", "rogue-sneak-attack:sneak-attack"]));
  });

  it("Esquive instinctive : les dégâts d'un gobelin ouvrent la fenêtre ; « utiliser » divise par deux", async () => {
    const r = await resolveTargetedRoll(client(gm), {
      campaignId, combatId, callerId: gm.id, locale: "fr",
      input: { kind: "damage", actor: { kind: "participant", participantId: gobelin }, action: { kind: "monster_action", name: nomCimeterre }, targetId: liaLigne, advantage: "normal", critical: false, secret: false },
    });
    if (!r.ok || !r.rollWindowId) throw new Error("fenêtre attendue");
    const { data: w } = await admin.from("roll_windows").select("view, choices").eq("id", r.rollWindowId).single();
    expect((w!.choices as { rule_key: string }[]).map((c) => c.rule_key)).toEqual(["rogue-uncanny-dodge"]);
    await answerRollWindow(client(joueuse), { windowId: r.rollWindowId, index: 0, use: true, callerId: joueuse.id, locale: "fr" });
    const repris = await resumeRollWindow(client(gm), { windowId: r.rollWindowId, campaignId, callerId: gm.id, locale: "fr" });
    if (!repris.ok) throw new Error(repris.reason);
    expect(repris.amount).toBe(Math.floor((w!.view as { total: number }).total / 2));
  });

  it("Attaque sournoise : sur ses dégâts, + 3d6 au choix, une fois par tour ; le second jet du tour n'ouvre plus rien", async () => {
    const degats = () =>
      resolveTargetedRoll(client(gm), {
        campaignId, combatId, callerId: gm.id, locale: "fr",
        input: { kind: "damage", actor: { kind: "character", entityId: lia }, action: { kind: "weapon", itemId: "rapiere" }, targetId: gobelin, advantage: "normal", critical: false, secret: false },
      });
    const r = await degats();
    if (!r.ok || !r.rollWindowId) throw new Error(`fenêtre attendue : ${JSON.stringify(r)}`);
    const { data: w } = await admin.from("roll_windows").select("view, choices").eq("id", r.rollWindowId).single();
    expect((w!.choices as { rule_key: string; user_id: string }[])[0]).toMatchObject({ rule_key: "rogue-sneak-attack", user_id: joueuse.id });
    const base = (w!.view as { total: number }).total;
    await answerRollWindow(client(joueuse), { windowId: r.rollWindowId, index: 0, use: true, callerId: joueuse.id, locale: "fr" });
    const repris = await resumeRollWindow(client(gm), { windowId: r.rollWindowId, campaignId, callerId: gm.id, locale: "fr" });
    if (!repris.ok) throw new Error(repris.reason);
    expect(repris.amount).toBeGreaterThanOrEqual(base + 3);
    expect(repris.amount).toBeLessThanOrEqual(base + 18);
    const { data: ligne } = await admin.from("combat_participants").select("turn_usage").eq("id", liaLigne).single();
    // La réaction datée vient de l'Esquive instinctive du test précédent ; Attaque sournoise ne coûte pas de réaction.
    expect(ligne!.turn_usage).toEqual({ reaction_at: "1:0", once: { "rogue-sneak-attack:sneak-attack": "1:0" } });

    const second = await degats();
    if (!second.ok) throw new Error(second.reason);
    expect(second.rollWindowId).toBeNull();
  });

  it("la couverture se lit : Esquive instinctive et Attaque sournoise partielles (perception, conditions), Inflexible et Coup de chance jouables", async () => {
    const etat = async (k: string) => (await getRuleEntryForWorld(client(gm), worldId, k, "fr"))?.coverage?.state;
    expect(await etat("rogue-uncanny-dodge")).toBe("partial");
    expect(await etat("rogue-sneak-attack")).toBe("partial");
    expect(await etat("fighter-indomitable")).toBe("playable");
    expect(await etat("rogue-stroke-of-luck")).toBe("playable");
  });
});
