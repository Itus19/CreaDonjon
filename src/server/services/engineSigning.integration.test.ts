import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { canonicalJson } from "@/src/core/rules/engineChange";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { engineSigningKeyFromEnv, signEngineChange } = await import("./engineSigning");

/**
 * V3.1-104 (ADR 0041) — Les changements signés du moteur, contre la base réelle.
 *
 * La clé ne passe jamais par un test : celle de l'environnement
 * (`ENGINE_SIGNING_KEY`, `ENGINE_SIGNING_KEY_ID`), posée par l'auteur dans la
 * base et dans l'environnement (docs/CLE-MOTEUR.md). Absente : le test se saute.
 * La rotation se vérifie si une seconde clé active est fournie
 * (`ENGINE_SIGNING_KEY_2`, `ENGINE_SIGNING_KEY_ID_2`).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && process.env.ENGINE_SIGNING_KEY && process.env.ENGINE_SIGNING_KEY_ID);
const hasSecondKey = Boolean(process.env.ENGINE_SIGNING_KEY_2 && process.env.ENGINE_SIGNING_KEY_ID_2);

describe.skipIf(!hasCreds)("changements signés du moteur (V3.1-104, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let player: ReusableAccount;
  let worldId: string;
  let campaignId: string;
  let otherCampaignId: string;
  let participantId: string;
  let foreignParticipantId: string;

  const joueur = () => player.client as unknown as SupabaseClient<Database>;
  const appliquer = (client: SupabaseClient<Database>, payload: string, signature: string) =>
    client.rpc("apply_engine_change", { p_payload: payload, p_signature: signature });
  const pv = async (id = participantId) => (await admin.from("combat_participants").select("hp_current, conditions").eq("id", id).single()).data;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, player] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test signatures", slug: `integration-test-engine-signing-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: campaign } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne signée", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id })
      .select("id")
      .single();
    campaignId = campaign!.id;
    await admin.from("campaign_members").insert([
      { campaign_id: campaignId, user_id: gm.id, role: "gm" },
      { campaign_id: campaignId, user_id: player.id, role: "player" },
    ]);
    const { data: combat } = await admin.from("combats").insert({ campaign_id: campaignId, name: "Embuscade", status: "running", round: 1, turn_index: 0 }).select("id").single();
    const { data: gobelin } = await admin
      .from("combat_participants")
      .insert({ combat_id: combat!.id, source_kind: "custom", label: "Gobelin", initiative: 12, ac: 13, hp_max: 7, hp_current: 7, display_order: 0 })
      .select("id")
      .single();
    participantId = gobelin!.id;

    // Une autre campagne, dans un autre monde : un changement signé pour la première ne doit pas l'atteindre.
    const { data: autreMonde } = await admin
      .from("worlds")
      .insert({ name: "Autre monde", slug: `integration-test-engine-signing-b-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    const { data: autre } = await admin.from("campaigns").insert({ world_id: autreMonde!.id, name: "Autre", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    otherCampaignId = autre!.id;
    const { data: autreCombat } = await admin.from("combats").insert({ campaign_id: otherCampaignId, name: "Ailleurs", status: "running", round: 1, turn_index: 0 }).select("id").single();
    const { data: loup } = await admin
      .from("combat_participants")
      .insert({ combat_id: autreCombat!.id, source_kind: "custom", label: "Loup", initiative: 9, ac: 12, hp_max: 11, hp_current: 11, display_order: 0 })
      .select("id")
      .single();
    foreignParticipantId = loup!.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    await admin.from("worlds").delete().like("slug", "integration-test-engine-signing-b-%");
  });

  it("un changement signé s'applique ; le même, rejoué, est refusé", async () => {
    const signe = signEngineChange({ campaignId, changes: [{ kind: "participant", id: participantId, hp: 3, conditions: ["prone"] }] }, engineSigningKeyFromEnv());
    expect((await appliquer(joueur(), signe.payload, signe.signature)).error).toBeNull();
    expect(await pv()).toEqual({ hp_current: 3, conditions: ["prone"] });
    expect((await appliquer(joueur(), signe.payload, signe.signature)).error).not.toBeNull();
  });

  it("signature fausse, clé inconnue, issued_at trop vieux, champ hors liste, ligne d'une autre campagne : refusés, rien d'écrit", async () => {
    await admin.from("combat_participants").update({ hp_current: 7, conditions: [] }).eq("id", participantId);
    const cle = engineSigningKeyFromEnv();
    const base = { campaignId, changes: [{ kind: "participant" as const, id: participantId, hp: 1 }] };

    // Un joueur qui fabrique son objet : sans la clé, sa signature est fausse.
    const fabrique = signEngineChange(base, { id: cle.id, secret: Buffer.alloc(32, 1) });
    expect((await appliquer(joueur(), fabrique.payload, fabrique.signature)).error).not.toBeNull();
    // Une clé que la base ne connaît pas.
    const inconnue = signEngineChange(base, { id: "cle-inconnue-du-test", secret: cle.secret });
    expect((await appliquer(joueur(), inconnue.payload, inconnue.signature)).error).not.toBeNull();
    // Trop vieux.
    const vieux = signEngineChange({ ...base, now: new Date(Date.now() - 120_000) }, cle);
    expect((await appliquer(joueur(), vieux.payload, vieux.signature)).error).not.toBeNull();
    // Champ hors liste, mais bien signé : la base refuse quand même.
    const horsListe = canonicalJson({ key_id: cle.id, nonce: randomUUID(), issued_at: new Date().toISOString(), campaign_id: campaignId, changes: [{ kind: "participant", id: participantId, hp: 1, ac: 30 }] });
    expect((await appliquer(joueur(), horsListe, createHmac("sha256", cle.secret).update(horsListe, "utf8").digest("hex"))).error).not.toBeNull();
    // Une ligne d'une autre campagne.
    const ailleurs = signEngineChange({ campaignId, changes: [{ kind: "participant", id: foreignParticipantId, hp: 0 }] }, cle);
    expect((await appliquer(joueur(), ailleurs.payload, ailleurs.signature)).error).not.toBeNull();

    expect(await pv()).toEqual({ hp_current: 7, conditions: [] });
    expect((await pv(foreignParticipantId))?.hp_current).toBe(11);
  });

  it("un client anonyme ne peut pas appeler la fonction", async () => {
    const anon = createSupabaseClient<Database>(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const signe = signEngineChange({ campaignId, changes: [{ kind: "participant", id: participantId, hp: 2 }] }, engineSigningKeyFromEnv());
    expect((await appliquer(anon, signe.payload, signe.signature)).error).not.toBeNull();
    expect((await pv())?.hp_current).toBe(7);
  });

  it.skipIf(!hasSecondKey)("deux clés actives : un changement signé par l'une ou l'autre passe (rotation)", async () => {
    const seconde = { id: process.env.ENGINE_SIGNING_KEY_ID_2!, secret: Buffer.from(process.env.ENGINE_SIGNING_KEY_2!, "hex") };
    const parLaSeconde = signEngineChange({ campaignId, changes: [{ kind: "participant", id: participantId, hp: 5 }] }, seconde);
    expect((await appliquer(joueur(), parLaSeconde.payload, parLaSeconde.signature)).error).toBeNull();
    const parLaPremiere = signEngineChange({ campaignId, changes: [{ kind: "participant", id: participantId, hp: 6 }] }, engineSigningKeyFromEnv());
    expect((await appliquer(joueur(), parLaPremiere.payload, parLaPremiere.signature)).error).toBeNull();
    expect((await pv())?.hp_current).toBe(6);
  });
});
