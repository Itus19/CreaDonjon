import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";
import { cleanupCreated } from "../testUtils/cleanupCreated";

vi.mock("server-only", () => ({}));
const { executeIntent } = await import("./turnIntent");
const { undoLastSoloTurn } = await import("./turnUndo");
const { getEntityRuntimeState } = await import("./runtimeState");
const { buildFilForSession } = await import("./turnFil");
const { getOrOpenSessionForCampaign } = await import("./sessions");
const { putRuntimeState } = await import("../repos/runtimeState");

/**
 * V3-F2 — annuler un tour du solo, contre la vraie base. Un tour (action libre,
 * sans modèle d'IA) relève l'état d'avant ; ce que le tour écrit ensuite (PV
 * perdus, une découverte, une fiche née automatiquement) est défait ; le
 * journal garde tout et gagne un événement d'annulation ; le fil cache le tour.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("annuler un tour du solo (V3-F2, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let owner: ReusableAccount;
  let outsider: ReusableAccount;
  let worldId: string;
  let worldSlug: string;
  let campaignId: string;
  let entityId: string;
  const client = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [owner, outsider] = await Promise.all([getReusableTestAccount(admin, "owner"), getReusableTestAccount(admin, "outsider")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    worldSlug = `integration-test-annuler-tour-${Date.now()}`;
    const { data: world, error } = await admin.from("worlds").insert({ name: "Monde de test annuler", slug: worldSlug, owner_id: owner.id, default_ruleset_id: official!.id }).select("id").single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Solo", ruleset_id: official!.id, mode: "solo", gm_user_id: owner.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert({ campaign_id: campaignId, user_id: owner.id, role: "gm" });
    const { data: e } = await admin.from("entities").insert({ world_id: worldId, slug: "aela-f2", name: "Aela", entity_kind: "character", created_by: owner.id }).select("id").single();
    entityId = e!.id;
    await admin.from("blocks").insert({
      entity_id: entityId, block_type: "character", display: { label: "Personnage", layout: "character" }, created_by: owner.id, visibility_level: "players",
      data: { __v: 1, species: { kind: "rule", key: "human" }, background: null, classes: [{ class: { kind: "rule", key: "fighter" }, level: 1, subclass: null }], abilities: { method: "manual", base: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 } }, choices: {}, hp_method: "fixed", portrait_asset_id: null } as unknown as Json,
    });
    await admin.from("campaign_characters").insert({ campaign_id: campaignId, entity_id: entityId, user_id: owner.id, is_pc: true });
  }, 120000);

  afterAll(async () => {
    await cleanupCreated(admin, { worldIds: [worldId] });
  });

  it("le tour est défait : PV, découverte et fiche née automatiquement ; le journal garde tout, le fil cache le tour", async () => {
    const avant = await getEntityRuntimeState(client(owner), entityId, campaignId);
    const tour = await executeIntent(client(owner), {
      entityId, campaignId, callerId: owner.id, world: { id: worldId, slug: worldSlug }, locale: "fr",
      text: "Je fouille la cave.", corrected: false, choice: { kind: "free" },
    });
    if ("error" in tour || !tour.eventId) throw new Error("tour attendu");

    // Ce que la suite du tour écrit : des PV perdus, une découverte, une fiche née d'une esquisse (auto_applied).
    await putRuntimeState(client(owner), { entityId, campaignId, state: { ...avant, hp: { ...avant.hp, current: Math.max(0, (avant.hp.current ?? 10) - 4) } } as unknown as Json });
    const { data: pnj } = await admin.from("entities").insert({ world_id: worldId, slug: "rat-geant-f2", name: "Rat géant", entity_kind: "creature", created_by: owner.id }).select("id").single();
    await admin.from("entity_discoveries").insert({ campaign_id: campaignId, entity_id: pnj!.id, user_id: owner.id, detail_level: "known", source_event_id: tour.eventId });
    await admin.from("ai_proposals").insert({ world_id: worldId, campaign_id: campaignId, session_event_id: tour.eventId, kind: "create_entity", target_entity_id: pnj!.id, payload: { name: "Rat géant" }, status: "applied", auto_applied: true, applied_at: new Date().toISOString() });

    // Un compte étranger à la partie ne peut pas annuler.
    expect(await undoLastSoloTurn(client(outsider), { campaignId, callerId: outsider.id })).toMatchObject({ ok: false });

    const r = await undoLastSoloTurn(client(owner), { campaignId, callerId: owner.id });
    if (!r.ok) throw new Error(r.reason);
    expect(r.undoneEventIds).toContain(tour.eventId);
    expect(r.reverted).toMatchObject({ entities: 1, proposals: 1, discoveries: 1, state: true });

    expect((await getEntityRuntimeState(client(owner), entityId, campaignId)).hp).toEqual(avant.hp);
    // Sans état en base au début du tour, l'annulation retire la ligne (la fiche retrouve ses PV pleins), jamais un état à 0 PV.
    expect((await admin.from("entity_runtime_state").select("entity_id").eq("entity_id", entityId).eq("campaign_id", campaignId)).data).toEqual([]);
    expect((await admin.from("entities").select("deleted_at").eq("id", pnj!.id).single()).data?.deleted_at).not.toBeNull();
    expect((await admin.from("entity_discoveries").select("id").eq("source_event_id", tour.eventId)).data).toEqual([]);
    expect((await admin.from("ai_proposals").select("status").eq("session_event_id", tour.eventId).single()).data?.status).toBe("reverted");

    // Le journal n'a rien perdu : l'événement du tour est toujours là, et l'annulation s'ajoute.
    const sessionId = await getOrOpenSessionForCampaign(client(owner), campaignId);
    const { data: journal } = await admin.from("session_events").select("id, kind").eq("session_id", sessionId);
    expect(journal!.some((e) => e.id === tour.eventId)).toBe(true);
    expect(journal!.some((e) => e.kind === "system")).toBe(true);
    expect((await buildFilForSession(client(owner), sessionId)).some((i) => i.id === tour.eventId)).toBe(false);

    // Plus rien à annuler.
    expect(await undoLastSoloTurn(client(owner), { campaignId, callerId: owner.id })).toEqual({ ok: false, reason: "nothing_to_undo" });
  }, 120000);
});
