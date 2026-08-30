import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createShareLink } from "./shareLinks";
import { resolveShareLink } from "./publicShare";

/**
 * V2-M10 (Lot M, retour utilisateur : "personnaliser l'url de partage...
 * le plus court et explicite possible... y mettre le nom de la campagne")
 * — genere le slug (nom de campagne slugifie), gere les collisions, et
 * verifie que la resolution (RPC `resolve_share_link`) accepte le slug
 * aussi bien que le jeton d'origine. Client `service_role` uniquement
 * (aucun `signInWithPassword`) : ce test porte sur l'algorithme de slug,
 * pas sur les permissions de creation (deja couvertes ailleurs) — evite
 * d'ajouter une charge sur le quota d'authentification de ce projet.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("createShareLink : slug court (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let worldId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `integration-test-share-slug-${Date.now()}@creadonjon.local`;
    const { data: user, error: userError } = await admin.auth.admin.createUser({
      email,
      password: `integration-test-${Date.now()}`,
      email_confirm: true,
    });
    if (userError || !user.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    userId = user.user.id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde slug test", slug: `integration-test-share-slug-${Date.now()}`, owner_id: userId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { error: campaignError } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Ma Campagne de Test !", ruleset_id: official.id, mode: "campaign" });
    if (campaignError) throw new Error(campaignError.message);
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("derive le slug du nom de campagne (accents, ponctuation, espaces normalises)", async () => {
    const { link } = await createShareLink(admin, { worldId, createdBy: userId });
    expect(link.slug).toBe("ma-campagne-de-test");
  });

  it("evite une collision de slug avec un suffixe numerique", async () => {
    const { link } = await createShareLink(admin, { worldId, createdBy: userId });
    expect(link.slug).toBe("ma-campagne-de-test-2");
  });

  it("resolveShareLink accepte le slug aussi bien que le jeton d'origine", async () => {
    const { token, link } = await createShareLink(admin, { worldId, createdBy: userId });
    expect(link.slug).toBeTruthy();

    const bySlug = await resolveShareLink(link.slug!);
    expect(bySlug?.worldId).toBe(worldId);

    const byToken = await resolveShareLink(token);
    expect(byToken?.worldId).toBe(worldId);
  });
});
