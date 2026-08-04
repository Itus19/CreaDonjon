import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { applyRuntimeStateChange, getEntityRuntimeState } from "./runtimeState";

/**
 * V1-B3 : sans ce test, rien ne prouve contre une vraie base que (a) le
 * meme personnage a bien un etat distinct par campagne (l'index d'unicite
 * de `entity_runtime_state` porte sur une expression, jamais exerce par un
 * test de schema pur) et que (b) une mutation de jeu ecrit un
 * `session_event` sans jamais toucher `entity_revisions` (specs/wiki-blocs.md
 * §4.5) — les deux sont des garanties inter-tables, invisibles a
 * `npm run test:core`.
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que publicShare.integration.test.ts).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("etat de jeu (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let worldId: string;
  let entityId: string;
  let rulesetId: string;
  let campaignAId: string;
  let campaignBId: string;
  let sessionId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `integration-test-runtime-${Date.now()}@creadonjon.local`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password: `integration-test-${Date.now()}`,
      email_confirm: true,
    });
    if (userError || !userData.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    userId = userData.user.id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test etat de jeu", slug: `integration-test-runtime-${Date.now()}`, owner_id: userId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "bram", name: "Bram", entity_kind: "character", created_by: userId })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    entityId = entity.id;

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");
    rulesetId = official.id;

    const { data: campaignA, error: campaignAError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne A", ruleset_id: rulesetId, mode: "solo" })
      .select("id")
      .single();
    if (campaignAError || !campaignA) throw new Error(campaignAError?.message ?? "creation campagne A echouee");
    campaignAId = campaignA.id;

    const { data: campaignB, error: campaignBError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne B", ruleset_id: rulesetId, mode: "solo" })
      .select("id")
      .single();
    if (campaignBError || !campaignB) throw new Error(campaignBError?.message ?? "creation campagne B echouee");
    campaignBId = campaignB.id;

    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .insert({ campaign_id: campaignAId, title: "Seance de test" })
      .select("id")
      .single();
    if (sessionError || !session) throw new Error(sessionError?.message ?? "creation session echouee");
    sessionId = session.id;
  });

  afterAll(async () => {
    // world_id est en cascade sur entities/campaigns/sessions/session_events/
    // entity_runtime_state (SCHEMA.md §11-§12) : supprimer le monde suffit.
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("le meme personnage a un etat distinct dans deux campagnes, et hors partie", async () => {
    await applyRuntimeStateChange(admin, {
      entityId,
      campaignId: campaignAId,
      patch: { hp: { current: 5, temp: 0 } },
      note: "Touche par un gobelin",
      actor: "gm",
    });
    await applyRuntimeStateChange(admin, {
      entityId,
      campaignId: campaignBId,
      patch: { hp: { current: 20, temp: 0 } },
      note: "Etat initial",
      actor: "gm",
    });

    const stateA = await getEntityRuntimeState(admin, entityId, campaignAId);
    const stateB = await getEntityRuntimeState(admin, entityId, campaignBId);
    const stateOutOfCampaign = await getEntityRuntimeState(admin, entityId, null);

    expect(stateA.hp.current).toBe(5);
    expect(stateB.hp.current).toBe(20);
    expect(stateOutOfCampaign.hp.current).toBe(0); // jamais touche, reste par defaut
  });

  it("une mutation de jeu ecrit un session_event, jamais une entity_revision", async () => {
    await applyRuntimeStateChange(admin, {
      entityId,
      campaignId: campaignAId,
      sessionId,
      patch: { conditions: ["prone"] },
      note: "Bram est projete au sol",
      actor: "gm",
    });

    const { data: events, error: eventsError } = await admin
      .from("session_events")
      .select("kind, actor, payload")
      .eq("session_id", sessionId);
    if (eventsError) throw new Error(eventsError.message);
    expect(events).toHaveLength(1);
    expect(events![0].kind).toBe("world_update");
    expect(events![0].payload).toMatchObject({ entity_id: entityId, note: "Bram est projete au sol" });

    const { data: revisions, error: revisionsError } = await admin
      .from("entity_revisions")
      .select("id")
      .eq("entity_id", entityId);
    if (revisionsError) throw new Error(revisionsError.message);
    expect(revisions).toHaveLength(0);
  });
});
