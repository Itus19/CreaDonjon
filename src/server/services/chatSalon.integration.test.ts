import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-22 (ADR 0038) — le salon de table et les fils privés, contre la base
 * réelle : un salon (`thread_user_id` nul) lisible et écrivable par les
 * membres de la campagne, jamais par un compte hors campagne ; un joueur ne
 * lit jamais le fil privé d'un autre ; la lecture du salon se note.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("salon de table et fils privés (V3.1-22, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let joueuse: ReusableAccount;
  let autre: ReusableAccount;
  let etranger: ReusableAccount;
  let worldId: string;
  let campaignId: string;

  const client = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;
  const lire = (a: ReusableAccount) => client(a).from("campaign_chat_messages").select("body, thread_user_id").eq("campaign_id", campaignId);

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse, autre, etranger] = await Promise.all([
      getReusableTestAccount(admin, "gm"),
      getReusableTestAccount(admin, "player"),
      getReusableTestAccount(admin, "playerB"),
      getReusableTestAccount(admin, "outsider"),
    ]);
    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test salon", slug: `integration-test-chat-salon-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: joueuse.id, role: "player" },
      { campaign_id: campaignId, user_id: autre.id, role: "player" },
    ]);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("le salon : chaque membre y écrit et le lit ; un compte hors campagne, ni l'un ni l'autre", async () => {
    expect((await client(joueuse).from("campaign_chat_messages").insert({ campaign_id: campaignId, sender_id: joueuse.id, thread_user_id: null, body: "Bonjour la table" })).error).toBeNull();
    expect((await client(gm).from("campaign_chat_messages").insert({ campaign_id: campaignId, sender_id: gm.id, thread_user_id: null, body: "Bienvenue" })).error).toBeNull();
    expect((await client(etranger).from("campaign_chat_messages").insert({ campaign_id: campaignId, sender_id: etranger.id, thread_user_id: null, body: "intrus" })).error).not.toBeNull();
    // Au nom d'un autre : refusé.
    expect((await client(autre).from("campaign_chat_messages").insert({ campaign_id: campaignId, sender_id: joueuse.id, thread_user_id: null, body: "usurpé" })).error).not.toBeNull();

    const salon = (await lire(autre)).data ?? [];
    expect(salon.filter((m) => m.thread_user_id === null).map((m) => m.body).sort()).toEqual(["Bienvenue", "Bonjour la table"]);
    expect((await lire(etranger)).data ?? []).toEqual([]);
  });

  it("un joueur ne lit jamais le fil privé d'un autre, ni n'y écrit", async () => {
    expect((await client(joueuse).from("campaign_chat_messages").insert({ campaign_id: campaignId, sender_id: joueuse.id, thread_user_id: joueuse.id, body: "Secret pour le MJ" })).error).toBeNull();
    expect((await client(autre).from("campaign_chat_messages").insert({ campaign_id: campaignId, sender_id: autre.id, thread_user_id: joueuse.id, body: "intrusion" })).error).not.toBeNull();

    const vuParAutre = (await lire(autre)).data ?? [];
    expect(vuParAutre.some((m) => m.thread_user_id === joueuse.id)).toBe(false);
    const vuParMj = (await lire(gm)).data ?? [];
    expect(vuParMj.some((m) => m.body === "Secret pour le MJ")).toBe(true);
  });

  it("la lecture du salon se note une fois par lecteur (fil nul)", async () => {
    const noter = () =>
      client(joueuse)
        .from("campaign_chat_reads")
        .upsert({ campaign_id: campaignId, user_id: joueuse.id, thread_user_id: null, last_read_at: new Date().toISOString() }, { onConflict: "campaign_id,user_id,thread_user_id" });
    expect((await noter()).error).toBeNull();
    expect((await noter()).error).toBeNull();
    const { data } = await client(joueuse).from("campaign_chat_reads").select("thread_user_id").eq("campaign_id", campaignId).is("thread_user_id", null);
    expect(data).toHaveLength(1);
  });
});
