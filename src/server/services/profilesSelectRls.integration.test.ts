import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * V2-M7c (Lot M) : bug trouve en verifiant le journal avec un vrai compte
 * joueur — `profiles_select` restait bornee a `id = auth.uid()` (sauf
 * superadmin, M6), donc le journal affichait "Compte sans nom" pour tout
 * auteur autre que le viewer. Corrige (migration
 * 20260830200001_profiles_select_shared_world.sql) : un compte peut lire le
 * nom d'un autre s'ils partagent au moins un monde (`app.shares_world_with`).
 * Ce test verifie le nouveau comportement ET sa limite (un tiers hors de
 * tout monde commun reste refuse).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("profiles_select — noms lisibles entre membres d'un meme monde (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let worldId: string;
  const userIds: Record<string, string> = {};
  const clients: Record<string, SupabaseClient> = {};

  async function createProfile(key: string): Promise<{ id: string; client: SupabaseClient }> {
    const email = `integration-test-profiles-${key}-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? `creation ${key} echouee`);
    const client = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(signInError.message);
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const [owner, player, outsider] = await Promise.all([
      createProfile("owner"),
      createProfile("player"),
      createProfile("outsider"),
    ]);
    userIds.owner = owner.id;
    clients.owner = owner.client;
    userIds.player = player.id;
    clients.player = player.client;
    userIds.outsider = outsider.id;
    clients.outsider = outsider.client;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test profiles", slug: `integration-test-profiles-${Date.now()}`, owner_id: userIds.owner })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { error: memberError } = await admin
      .from("world_members")
      .insert({ world_id: worldId, user_id: userIds.player, role: "viewer" });
    if (memberError) throw new Error(memberError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    for (const id of Object.values(userIds)) await admin.auth.admin.deleteUser(id);
  });

  it("deux comptes qui partagent un monde peuvent lire le nom l'un de l'autre", async () => {
    const { data: fromOwner } = await clients.owner.from("profiles").select("id").eq("id", userIds.player).maybeSingle();
    expect(fromOwner?.id).toBe(userIds.player);

    const { data: fromPlayer } = await clients.player.from("profiles").select("id").eq("id", userIds.owner).maybeSingle();
    expect(fromPlayer?.id).toBe(userIds.owner);
  });

  it("un tiers hors de tout monde commun ne peut pas lire leurs profils", async () => {
    const { data: outsiderReadsOwner } = await clients.outsider.from("profiles").select("id").eq("id", userIds.owner).maybeSingle();
    expect(outsiderReadsOwner).toBeNull();

    const { data: outsiderReadsPlayer } = await clients.outsider.from("profiles").select("id").eq("id", userIds.player).maybeSingle();
    expect(outsiderReadsPlayer).toBeNull();
  });

  it("chacun peut toujours lire son propre profil", async () => {
    const { data } = await clients.outsider.from("profiles").select("id").eq("id", userIds.outsider).maybeSingle();
    expect(data?.id).toBe(userIds.outsider);
  });
});
