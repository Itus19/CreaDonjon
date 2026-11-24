import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

/**
 * ADR 0103 — le jeu à distance contre la base réelle : la visibilité d'un
 * message (`session_events.visible_to`), la voix du MJ réservée au MJ, un
 * message jamais signé du compte d'un autre, le DD caché lu du MJ seul, la
 * réponse à une demande de jet par le joueur visé et une seule fois, le
 * dernier lu de chacun pour lui seul. Mêmes contrôles que la vérification
 * faite sur une base Postgres locale le 23 nov.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("jeu à distance : fil, demandes de jet, dernier lu (ADR 0103, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let lyra: ReusableAccount;
  let corwin: ReusableAccount;
  let etranger: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let sessionId: string;
  let requestId: string;

  const client = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;
  const textes = async (a: ReusableAccount) => {
    const { data } = await client(a).from("session_events").select("payload").eq("session_id", sessionId);
    return (data ?? []).map((e) => (e.payload as { text?: string }).text ?? "");
  };
  const ecrire = async (a: ReusableAccount, ligne: { kind: string; actor: string; actor_user_id: string | null; text: string; visible_to?: string[] | null }) => {
    const { data: seq } = await client(a).rpc("next_session_event_seq", { p_session: sessionId });
    return client(a)
      .from("session_events")
      .insert({ session_id: sessionId, seq: seq as number, kind: ligne.kind, actor: ligne.actor, actor_user_id: ligne.actor_user_id, payload: { text: ligne.text }, visible_to: ligne.visible_to ?? null })
      .select("id")
      .single();
  };

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, lyra, corwin, etranger] = await Promise.all([
      getReusableTestAccount(admin, "gm"),
      getReusableTestAccount(admin, "player"),
      getReusableTestAccount(admin, "playerB"),
      getReusableTestAccount(admin, "outsider"),
    ]);
    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test jeu à distance", slug: `integration-test-distance-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: lyra.id, role: "player" },
      { campaign_id: campaignId, user_id: corwin.id, role: "player" },
    ]);
    const { data: session } = await admin.from("sessions").insert({ campaign_id: campaignId }).select("id").single();
    sessionId = session!.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("un secret du MJ ne se lit que par sa destinataire ; un mot au MJ, par le MJ seul", async () => {
    expect((await ecrire(gm, { kind: "narration", actor: "gm", actor_user_id: gm.id, text: "public" })).error).toBeNull();
    expect((await ecrire(gm, { kind: "narration", actor: "gm", actor_user_id: gm.id, text: "secret Lyra", visible_to: [lyra.id] })).error).toBeNull();
    expect((await ecrire(lyra, { kind: "player_action", actor: "player", actor_user_id: lyra.id, text: "au MJ seul", visible_to: [] })).error).toBeNull();

    expect((await textes(lyra)).sort()).toEqual(["au MJ seul", "public", "secret Lyra"]);
    expect(await textes(corwin)).toEqual(["public"]);
    expect((await textes(gm)).sort()).toEqual(["au MJ seul", "public", "secret Lyra"]);
    expect(await textes(etranger)).toEqual([]);
  });

  it("refuse la voix du MJ à une joueuse, un message signé d'un autre, un secret entre joueuses", async () => {
    expect((await ecrire(lyra, { kind: "narration", actor: "gm", actor_user_id: lyra.id, text: "usurpé" })).error).not.toBeNull();
    expect((await ecrire(lyra, { kind: "player_action", actor: "player", actor_user_id: corwin.id, text: "usurpé" })).error).not.toBeNull();
    expect((await ecrire(lyra, { kind: "player_action", actor: "player", actor_user_id: lyra.id, text: "psst", visible_to: [corwin.id] })).error).not.toBeNull();
    // Un événement « gm » non narratif reste ouvert (sauvegarde refaite en fin de tour, écrite au nom du joueur).
    expect((await ecrire(lyra, { kind: "rule_application", actor: "gm", actor_user_id: lyra.id, text: "JS refait" })).error).toBeNull();
  });

  it("la demande de jet : créée par le MJ, DD caché pour lui seul, répondue une fois par la joueuse visée", async () => {
    const { data: demande, error } = await client(gm)
      .from("roll_requests")
      .insert({ campaign_id: campaignId, session_id: sessionId, target_user_id: lyra.id, check_kind: "skill", check_key: "acrobatics", label: "Acrobaties" })
      .select("id")
      .single();
    expect(error).toBeNull();
    requestId = demande!.id;
    expect((await client(gm).from("roll_request_gm_details").insert({ request_id: requestId, dc: 15 })).error).toBeNull();
    expect((await client(lyra).from("roll_requests").insert({ campaign_id: campaignId, session_id: sessionId, target_user_id: corwin.id, check_kind: "skill", check_key: "x", label: "x" })).error).not.toBeNull();

    expect((await client(lyra).from("roll_requests").select("id").eq("id", requestId)).data).toHaveLength(1);
    expect((await client(lyra).from("roll_request_gm_details").select("dc").eq("request_id", requestId)).data).toEqual([]);
    expect((await client(gm).from("roll_request_gm_details").select("dc").eq("request_id", requestId)).data).toEqual([{ dc: 15 }]);

    const repondre = (a: ReusableAccount) => client(a).rpc("answer_roll_request", { p_request: requestId, p_natural: 14, p_total: 21, p_by_hand: true, p_answer_event: null });
    expect((await repondre(corwin)).data).toBeNull();
    expect((await repondre(lyra)).data).not.toBeNull();
    expect((await repondre(lyra)).data).toBeNull();
  });

  it("le dernier lu : chacun le sien, jamais celui d'un autre", async () => {
    expect((await client(lyra).from("session_reads").upsert({ session_id: sessionId, user_id: lyra.id, last_seq: 3 }, { onConflict: "session_id,user_id" })).error).toBeNull();
    expect((await client(lyra).from("session_reads").insert({ session_id: sessionId, user_id: corwin.id, last_seq: 3 })).error).not.toBeNull();
    expect((await client(corwin).from("session_reads").select("user_id").eq("session_id", sessionId)).data).toEqual([]);
  });
});
