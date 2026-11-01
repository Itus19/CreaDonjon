import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { getPlayerStats } = await import("./playerStats");

/**
 * V3.1-91 — `getPlayerStats` contre la base réelle : le personnage de la
 * joueuse qui appelle, ses jets publics seulement, la moyenne de la table,
 * et « Dernière séance ». Monde jetable ; jets insérés par le service role.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("statistiques du joueur (V3.1-91, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let joueuse: ReusableAccount;
  let autre: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let sienne: string;
  let bram: string;

  const stats = (a: ReusableAccount, scope: "campaign" | "last_session" = "campaign") =>
    getPlayerStats(a.client as unknown as SupabaseClient<Database>, { campaignId, userId: a.id, scope });

  async function jets(entityId: string, faces: number[], p: { sessionId: string; visibility?: string; at: Date; kind?: string; result?: number }) {
    const rows = faces.map((n, i) => ({
      campaign_id: campaignId,
      session_id: p.sessionId,
      entity_id: entityId,
      expression: "1d20",
      ast: {},
      context: {},
      result: p.result ?? n,
      detail: { kind: p.kind ?? "check", what: "Perception", naturalD20: n },
      rolled_by: "player",
      visibility_level: p.visibility ?? "public",
      created_at: new Date(p.at.getTime() + i * 1000).toISOString(),
    }));
    const { error } = await admin.from("dice_rolls").insert(rows);
    if (error) throw new Error(error.message);
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse, autre] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player"), getReusableTestAccount(admin, "playerB")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test stats", slug: `integration-test-player-stats-${Date.now()}`, owner_id: gm.id })
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
    const { data: pcs } = await admin
      .from("entities")
      .insert([
        { world_id: worldId, slug: "sienne", name: "Sienne", entity_kind: "character", created_by: gm.id },
        { world_id: worldId, slug: "bram", name: "Bram", entity_kind: "character", created_by: gm.id },
      ])
      .select("id, slug");
    sienne = pcs!.find((e) => e.slug === "sienne")!.id;
    bram = pcs!.find((e) => e.slug === "bram")!.id;
    await admin.from("campaign_characters").insert([
      { campaign_id: campaignId, entity_id: sienne, user_id: joueuse.id, is_pc: true },
      { campaign_id: campaignId, entity_id: bram, user_id: autre.id, is_pc: true },
    ]);

    const { data: s1 } = await admin.from("sessions").insert({ campaign_id: campaignId, started_at: "2026-10-20T18:00:00Z" }).select("id").single();
    const { data: s2 } = await admin.from("sessions").insert({ campaign_id: campaignId, started_at: "2026-10-27T18:00:00Z" }).select("id").single();
    // Séance 1 : Sienne 20, 20, 1, 5, 9 ; Bram 20, 1, 1.
    await jets(sienne, [20, 20, 1, 5, 9], { sessionId: s1!.id, at: new Date("2026-10-20T19:00:00Z") });
    await jets(bram, [20, 1, 1], { sessionId: s1!.id, at: new Date("2026-10-20T19:00:00Z") });
    // Séance 2 : Sienne 12, 13, 14, 15, 16, 17.
    await jets(sienne, [12, 13, 14, 15, 16, 17], { sessionId: s2!.id, at: new Date("2026-10-27T19:00:00Z") });
    // Secrets de Sienne (roller) et cachés (gm) : jamais comptés, même par elle.
    await jets(sienne, [20, 20, 20], { sessionId: s2!.id, at: new Date("2026-10-27T20:00:00Z"), visibility: "roller" });
    await jets(sienne, [1, 1], { sessionId: s2!.id, at: new Date("2026-10-27T21:00:00Z"), visibility: "gm" });
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("toute la campagne : ses jets publics seulement ; 1 et 20 égaux à leurs colonnes ; titres d'après la table", async () => {
    const vue = await stats(joueuse);
    if (vue.status !== "ok") throw new Error(vue.status);
    expect(vue.histogram.total).toBe(11);
    expect(vue.histogram.counts[19]).toBe(2);
    expect(vue.histogram.counts[0]).toBe(1);
    // Table : Sienne 2 × 20, Bram 1 × 20 → moyenne 1,5 ; 2 ÷ 1,5 ≈ 1,33 → « Béni des dés ».
    const chance = vue.titles.find((t) => t.family === "luck");
    expect(chance?.tier?.name).toBe("Béni des dés");
  });

  it("dernière séance : seulement ses jets de la séance la plus récente", async () => {
    const vue = await stats(joueuse, "last_session");
    if (vue.status !== "ok") throw new Error(vue.status);
    expect(vue.histogram.total).toBe(6);
    expect(vue.histogram.counts[19]).toBe(0);
    expect(vue.average).toBe(14.5);
  });

  it("chacune ne voit que son personnage ; le MJ, sans personnage réclamé, n'a pas de statistiques", async () => {
    const deBram = await stats(autre);
    if (deBram.status !== "ok") throw new Error(deBram.status);
    expect(deBram.histogram.total).toBe(3);
    expect(deBram.histogram.tooFew).toBe(true);
    expect(deBram.titles).toEqual([]);
    expect(await stats(gm)).toEqual({ status: "no_character" });
  });
});
