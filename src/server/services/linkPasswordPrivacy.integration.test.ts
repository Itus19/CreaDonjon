import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { Database } from "@/src/types/database";
import { generateShareToken, hashShareToken } from "@/src/core/shareLinks/token";
import { hashCampaignInviteToken } from "@/src/core/campaignInvites/token";
import { hashSharePassword } from "@/src/core/shareLinks/password";
import { readInvitePasswordHash } from "./accountProvisioning";
import { resolveShareLink, verifyShareLinkPassword } from "./publicShare";
import { verifyInvitePassword } from "./campaignInvites";

/**
 * V3.1-142 — sur la vraie base : le hash du mot de passe d'un lien (partage,
 * invitation) ne sort plus jamais vers un visiteur, ni anonyme ni connecté.
 * Exige la migration 20261013150000. Le monde de test est supprimé à la fin.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("le hash du mot de passe d'un lien reste sur le serveur (integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let anon: SupabaseClient<Database>;
  let player: { id: string; client: SupabaseClient };
  let worldId: string;
  const shareToken = generateShareToken();
  const inviteToken = generateShareToken();
  const MOT_DE_PASSE = "porte-du-donjon";

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    anon = createSupabaseClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const gm = await getReusableTestAccount(admin, "gm");
    player = await getReusableTestAccount(admin, "player");
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test mots de passe", slug: `integration-test-link-pw-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "creation monde echouee");
    worldId = world.id;
    const hash = hashSharePassword(MOT_DE_PASSE);
    const { error: e1 } = await admin.from("share_links").insert({ world_id: worldId, token_hash: hashShareToken(shareToken), token: shareToken, scope: "public_only", password_hash: hash, created_by: gm.id });
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await admin.from("campaign_invites").insert({ world_id: worldId, token_hash: hashCampaignInviteToken(inviteToken), token: inviteToken, intended_role: "player", password_hash: hash, created_by: gm.id });
    if (e2) throw new Error(e2.message);
  });

  afterAll(async () => {
    if (!worldId) return;
    await admin.from("campaign_invites").delete().eq("world_id", worldId);
    await admin.from("share_links").delete().eq("world_id", worldId);
    await admin.from("worlds").delete().eq("id", worldId);
  });

  it("un visiteur, anonyme ou connecté, ne peut plus appeler la résolution d'un lien de partage", async () => {
    for (const client of [anon, player.client]) {
      const { error } = await client.rpc("resolve_share_link", { p_token: shareToken });
      expect(error).not.toBeNull();
    }
  });

  it("la résolution d'une invitation dit seulement s'il y a un mot de passe, jamais son hash", async () => {
    const { data, error } = await anon.rpc("resolve_campaign_invite", { p_token: inviteToken });
    expect(error).toBeNull();
    expect(data?.[0]?.has_password).toBe(true);
    expect(JSON.stringify(data)).not.toContain("scrypt");
    expect(Object.keys(data?.[0] ?? {})).not.toContain("password_hash");
  });

  it("le hash d'une invitation n'est lisible ni par un visiteur anonyme, ni par un compte connecté", async () => {
    for (const client of [anon, player.client]) {
      const { error } = await client.rpc("campaign_invite_password_hash", { p_token: inviteToken });
      expect(error).not.toBeNull();
    }
  });

  it("le serveur, lui, le lit et vérifie toujours les mots de passe", async () => {
    expect(await readInvitePasswordHash(inviteToken)).toMatch(/^scrypt/);
    expect((await resolveShareLink(shareToken))?.passwordHash).toMatch(/^scrypt/);
    expect(await verifyShareLinkPassword(shareToken, MOT_DE_PASSE)).toBe("ok");
    expect(await verifyInvitePassword(anon, inviteToken, "mauvais")).toBe("wrong");
    expect(await verifyInvitePassword(anon, inviteToken, MOT_DE_PASSE)).toBe("ok");
  });
});
