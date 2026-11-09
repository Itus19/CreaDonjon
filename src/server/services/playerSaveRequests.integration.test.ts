import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { canonicalJson } from "@/src/core/rules/engineChange";
import { engineSigningKeyFromEnv, signEngineChange } from "./engineSigning";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-200 (ADR 0091) — la demande de sauvegarde d'une joueuse, contre la vraie
 * base : elle ne s'écrit jamais directement ; le changement signé ne vise
 * qu'un participant d'un combat de la campagne nommée ; la base refuse un
 * compte qui répond glissé dans la charge (elle le déduit) ; l'auteur est
 * l'appelant. Comptes du groupe fixe, mondes supprimés à la fin.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY && process.env.ENGINE_SIGNING_KEY_ID);

describe.skipIf(!hasCreds)("sauvegardes demandées par une joueuse (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let gm: { id: string; client: SupabaseClient };
  let player: { id: string; client: SupabaseClient };
  const mondes: string[] = [];
  const campagne: string[] = [];
  const combat: string[] = [];
  const gobelin: string[] = [];

  const demande = (i: number, cible = gobelin[i]) => ({
    kind: "save_request" as const,
    id: randomUUID(),
    request: {
      combat_id: combat[i],
      target_id: cible,
      label: "Injonction · JS Sagesse DD 15",
      ability: "wis" as const,
      dc: 15,
      effect: { on_fail: { damage: 0, conditions: [] }, on_success: { damage: 0, conditions: [] } },
      origin_roll_id: null,
    },
  });
  const appliquer = (client: SupabaseClient, payload: string, signature: string) => client.rpc("apply_engine_change", { p_payload: payload, p_signature: signature });

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, player] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_51").eq("is_official_base", true).limit(1).single();
    for (let i = 0; i < 2; i++) {
      // Une campagne par monde : deux mondes, pour une cible « d'une autre campagne ».
      const { data: world, error: ew } = await admin.from("worlds").insert({ name: `Test sauvegardes joueuse ${i}`, slug: `integration-test-player-saves-${i}-${Date.now()}`, owner_id: gm.id }).select("id").single();
      if (ew || !world) throw new Error(`monde : ${ew?.message}`);
      mondes.push(world.id);
      const { data: c, error: ec } = await admin.from("campaigns").insert({ world_id: world.id, name: `Campagne ${i}`, ruleset_id: official!.id, mode: "campaign" }).select("id").single();
      if (ec || !c) throw new Error(`campagne : ${ec?.message}`);
      campagne.push(c.id);
      await admin.from("campaign_members").insert([
        { campaign_id: c!.id, user_id: gm.id, role: "gm" },
        { campaign_id: c!.id, user_id: player.id, role: "player" },
      ]);
      const { data: cb, error: ecb } = await admin.from("combats").insert({ campaign_id: c!.id, name: "Combat", status: "running", round: 1, turn_index: 0 }).select("id").single();
      if (ecb || !cb) throw new Error(`combat : ${ecb?.message}`);
      combat.push(cb.id);
      const { data: p, error: ep } = await admin
        .from("combat_participants")
        .insert({ combat_id: cb!.id, source_kind: "custom", label: "Gobelin", initiative: 10, ac: 13, hp_max: 7, hp_current: 7, display_order: 0 })
        .select("id")
        .single();
      if (ep || !p) throw new Error(`participant : ${ep?.message}`);
      gobelin.push(p.id);
    }
  });

  afterAll(async () => {
    for (const id of mondes) await admin.from("worlds").delete().eq("id", id);
  });

  it("une joueuse n'insère pas une demande elle-même", async () => {
    const { error } = await player.client.from("save_requests").insert({
      campaign_id: campagne[0],
      combat_id: combat[0],
      target_kind: "participant",
      target_id: gobelin[0],
      label: "100 dégâts",
      ability: "dex",
      dc: 30,
      effect: { on_fail: { damage: 100, conditions: [] }, on_success: { damage: 100, conditions: [] } },
    });
    expect(error).not.toBeNull();
  });

  it("le changement signé crée la demande : l'auteur est la joueuse, le MJ répond pour un monstre", async () => {
    const d = demande(0);
    const { payload, signature } = signEngineChange({ campaignId: campagne[0], changes: [d] }, engineSigningKeyFromEnv());
    const { error } = await appliquer(player.client, payload, signature);
    expect(error).toBeNull();
    const { data } = await admin.from("save_requests").select("author_user_id, target_user_id, campaign_id, status").eq("id", d.id).single();
    expect(data).toEqual({ author_user_id: player.id, target_user_id: null, campaign_id: campagne[0], status: "pending" });
  });

  it("une cible d'une autre campagne est refusée, même signée", async () => {
    const d = { ...demande(1), request: { ...demande(1).request } };
    const { payload, signature } = signEngineChange({ campaignId: campagne[0], changes: [d] }, engineSigningKeyFromEnv());
    const { error } = await appliquer(player.client, payload, signature);
    expect(error).not.toBeNull();
    const { data } = await admin.from("save_requests").select("id").eq("id", d.id);
    expect(data).toEqual([]);
  });

  it("un compte qui répond glissé dans la charge est refusé : la base le déduit", async () => {
    const key = engineSigningKeyFromEnv();
    const d = demande(0);
    const corps = {
      key_id: key.id,
      nonce: randomUUID(),
      issued_at: new Date().toISOString(),
      campaign_id: campagne[0],
      changes: [{ ...d, request: { ...d.request, target_user_id: player.id } }],
    };
    const payload = canonicalJson(corps);
    const signature = createHmac("sha256", key.secret).update(payload, "utf8").digest("hex");
    const { error } = await appliquer(player.client, payload, signature);
    expect(error).not.toBeNull();
  });
});
