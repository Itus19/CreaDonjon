import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { proposeIntentRequest } = await import("./turnIntent");
const { playEncashedTurn } = await import("./turnLoop");
const { answerRollWindow } = await import("./rollWindowResume");
const { savePlayableBlocks } = await import("./rulePlayableBlocks");
const { createRulesetVariant } = await import("./rules");
const { getSceneState, putSceneState } = await import("../repos/sceneStates");
const { getEntityRuntimeState } = await import("./runtimeState");
const { emptyScene, enterScene } = await import("@/src/core/rules/scene");

/**
 * V3.1-216 — les réactions dans la boucle du solo : un jet du tour ouvre la
 * fenêtre (le tour n'est PAS joué tant qu'elle est ouverte), la réponse
 * reprend le tour avec le jet modifié, et le budget de la SCÈNE compte la
 * réaction — il n'y a pas de ligne de combat en solo.
 *
 * La règle jouée est une version maison de Coup de chance, dans la variante
 * du monde (règle 18) : « votre réaction » au lieu de rien. L'officielle ne
 * coûte aucune action, et aucune réaction du SRD ne se déclenche aujourd'hui
 * sur son propre jet — c'est la maison qui fait la démonstration, exactement
 * le chemin de l'éditeur de briques (V3.1-132).
 *
 * Monde et variante jetables, comptes réutilisés (docs/TESTS.md).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && process.env.ENGINE_SIGNING_KEY);

const num = (value: number) => ({ op: "num" as const, value });
/** Coup de chance, version maison : un Test d20 raté devient un 20, en y consacrant sa réaction. */
const COUP_DE_CHANCE_MAISON = {
  activations: [
    {
      id: "stroke-of-luck",
      label: { fr: "Coup de chance (maison)" },
      cost: { action: "reaction", resources: [{ key: "stroke-of-luck", amount: num(1) }] },
      targets: { kind: "self" },
      effects: [],
      variants: null,
      trigger: { on: "roll", roll: "d20", subject: "self", when: "failed" },
      roll_operations: [{ op: "set_natural", value: 20 }],
    },
  ],
  durable_effects: [],
};

describe.skipIf(!hasCreds)("une réaction dans le tour solo (V3.1-216, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let worldId: string;
  let worldSlug: string;
  let variantId: string;
  let campaignId: string;
  let entityId: string;
  const client = () => gm.client as unknown as SupabaseClient<Database>;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    gm = await getReusableTestAccount(admin, "gm");
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).limit(1).single();

    worldSlug = `integration-test-solo-reaction-${Date.now()}`;
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test réaction solo", slug: worldSlug, owner_id: gm.id, default_ruleset_id: official!.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;

    // La variante du monde : c'est elle qui portera la règle maison (règle 18).
    const variante = await createRulesetVariant(client(), { name: "Variante de test", parentRulesetId: official!.id });
    if (!variante) throw new Error("variante non créée");
    variantId = variante.id;
    await admin.from("worlds").update({ default_ruleset_id: variantId }).eq("id", worldId);

    const { data: campaign } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne solo", ruleset_id: variantId, mode: "solo", gm_user_id: gm.id })
      .select("id")
      .single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert({ campaign_id: campaignId, user_id: gm.id, role: "gm" });

    const { data: lieu } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "clairiere", name: "Clairière", entity_kind: "location", created_by: gm.id })
      .select("id")
      .single();

    const { data: pj } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "vic", name: "Vic", entity_kind: "character", created_by: gm.id })
      .select("id")
      .single();
    entityId = pj!.id;
    const { error: blocError } = await admin.from("blocks").insert({
      entity_id: entityId,
      block_type: "character",
      display: { label: "Personnage", layout: "character" },
      created_by: gm.id,
      data: {
        __v: 1,
        species: { kind: "rule", key: "human" },
        background: null,
        classes: [{ class: { kind: "rule", key: "rogue" }, level: 20, subclass: null }],
        // FOR 10 : un test de Force à DD 20 rate, sauf 20 naturel — et c'est le naturel qu'on annonce.
        abilities: { method: "manual", base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
        choices: {},
        hp_method: "fixed",
        portrait_asset_id: null,
      } as unknown as Json,
    });
    if (blocError) throw new Error(blocError.message);
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: entityId, user_id: gm.id, is_pc: true });

    // La scène : sans elle, il n'y a pas de budget à décompter.
    await putSceneState(admin as unknown as SupabaseClient<Database>, {
      campaignId,
      state: enterScene(emptyScene(lieu!.id), { entityId, zone: "engaged" }),
      updatedBy: gm.id,
    });

    const enregistre = await savePlayableBlocks(client(), { worldId, entryKey: "rogue-stroke-of-luck", blocks: { activation: COUP_DE_CHANCE_MAISON } });
    if (!enregistre.ok) throw new Error(`règle maison : ${enregistre.reason} ${enregistre.message ?? ""}`);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    if (variantId) await admin.from("rulesets").delete().eq("id", variantId);
  });

  it("un test raté du tour ouvre la fenêtre, la réponse joue le tour avec un 20, et la scène compte la réaction", async () => {
    const commun = { entityId, campaignId, callerId: gm.id, world: { id: worldId, slug: worldSlug }, locale: "fr" as const };
    const pose = await proposeIntentRequest(client(), {
      ...commun,
      text: "je force la porte",
      corrected: false,
      choice: { kind: "ability_check", actionId: "str", targetId: null, advantage: "normal", dc: 20 },
    });
    if ("error" in pose) throw new Error(`pose : ${pose.error}`);

    // Naturel 3 contre DD 20 : raté — Coup de chance se propose.
    const encaisse = await playEncashedTurn(client(), { ...commun, natural: 3, origin: "a_la_main" });
    if (!("window" in encaisse)) throw new Error(`fenêtre attendue : ${JSON.stringify(encaisse)}`);

    // Rien n'a été joué : la demande est toujours posée, le tour n'est pas au journal.
    expect((await getEntityRuntimeState(client(), entityId, campaignId)).pending_request).not.toBeNull();

    const reponse = await answerRollWindow(client(), { windowId: encaisse.window, index: 0, use: true, callerId: gm.id, locale: "fr" });
    if (!reponse.ok || reponse.resumed?.origin !== "solo_turn") throw new Error(`reprise attendue : ${JSON.stringify(reponse)}`);
    const tour = reponse.resumed.result;
    if ("error" in tour || "window" in tour) throw new Error(`tour attendu : ${JSON.stringify(tour)}`);

    // Le jet repris : le 20 du Coup de chance, et la réussite qui en découle.
    const check = tour.record.detail.check as { total: number; verdict: string | null };
    expect(check.total).toBe(20);
    expect(check.verdict).toBe("success");
    // La demande est honorée, l'usage de la règle dépensé.
    const etat = await getEntityRuntimeState(client(), entityId, campaignId);
    expect(etat.pending_request).toBeNull();
    expect(etat.resources["stroke-of-luck"]).toBe(1);

    // Le budget de la scène : le tour a ouvert un budget neuf (action dépensée par le test), la réaction est comptée.
    const scene = await getSceneState(client(), campaignId);
    expect(scene?.budgets[entityId]?.reaction).toBe(0);
    expect(scene?.budgets[entityId]?.action).toBe(0);
  });
});
