import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateShareToken, hashShareToken } from "../../core/shareLinks/token";
import { resolveShareLink, getPublicEntityDetail } from "./publicShare";

/**
 * V1 D-01 : sans ce test, une modification future de getPublicEntityDetail
 * peut ouvrir une fuite totale sans que rien n'echoue — le filtrage
 * applicatif (filterBlocks/filterSegments) est la seule barriere une fois
 * le jeton resolu, la RLS ne protege plus rien a ce stade (le client
 * service-role la contourne entierement, CLAUDE.md regle 4 ter).
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local
 * (charge par vitest.setup.ts) n'est pas configure — jamais en echec dans
 * un environnement sans base (CI sans secrets, par exemple).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("publicShare (integration, base reelle)", () => {
  // Client brut construit ici, jamais importe de lib/supabase/service.ts :
  // la restriction ESLint (V1 D-01) vise le code applicatif, pas
  // l'infrastructure de test qui doit pouvoir arranger librement son
  // propre etat (meme pattern que scripts/seed-dev.ts).
  let admin: SupabaseClient;
  let userId: string;
  let worldId: string;
  const entitySlug = "1";

  const SECRET_BLOCK_MARKER = "SECRET_BLOC_MJ_INTEGRATION";
  const SECRET_SEGMENT_MARKER = "SECRET_SEGMENT_MJ_INTEGRATION";
  const PUBLIC_MARKER = "Phrase publique d'integration";

  async function insertTestShareLink(): Promise<string> {
    const token = generateShareToken();
    const { error } = await admin
      .from("share_links")
      .insert({ world_id: worldId, token_hash: hashShareToken(token), scope: "public_only", created_by: userId });
    if (error) throw new Error(error.message);
    return token;
  }

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `integration-test-${Date.now()}@creadonjon.local`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password: `integration-test-${Date.now()}`,
      email_confirm: true,
    });
    if (userError || !userData.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    userId = userData.user.id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test d'integration", slug: `integration-test-${Date.now()}`, owner_id: userId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: entitySlug, name: "Entite de test", entity_kind: "other", created_by: userId })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    const entityId = entity.id;

    // Un bloc `text` public contenant un segment public ET un segment gm
    // (SCHEMA.md §7.1, exemple Bram) — teste que la visibilite du bloc ne
    // suffit pas, chaque segment doit etre filtre a son tour. Un second
    // bloc entierement gm teste le filtrage au niveau du bloc lui-meme.
    const { error: blocksError } = await admin.from("blocks").insert([
      {
        entity_id: entityId,
        block_type: "text",
        display: { label: "Texte", layout: "prose" },
        visibility_level: "public",
        display_order: 100,
        created_by: userId,
        data: {
          __v: 1,
          segments: [
            {
              id: "s1",
              blockType: "paragraph",
              visibility: { level: "public", scopeId: null },
              content: [{ t: "text", v: PUBLIC_MARKER }],
            },
            {
              id: "s2",
              blockType: "paragraph",
              visibility: { level: "gm", scopeId: null },
              content: [{ t: "text", v: SECRET_SEGMENT_MARKER }],
            },
          ],
        },
      },
      {
        entity_id: entityId,
        block_type: "infobox",
        display: { label: "Secret MJ", layout: "key_values" },
        visibility_level: "gm",
        display_order: 200,
        created_by: userId,
        data: { __v: 1, entries: [{ label: "Secret", value: SECRET_BLOCK_MARKER }] },
      },
    ]);
    if (blocksError) throw new Error(blocksError.message);
  });

  afterAll(async () => {
    // world_id est en cascade sur entities/blocks/share_links (SCHEMA.md
    // §5-§7, §18) : supprimer le monde suffit a tout nettoyer.
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("le contenu d'un bloc gm est absent de la reponse brute", async () => {
    const token = await insertTestShareLink();
    const resolved = await resolveShareLink(token);
    expect(resolved).not.toBeNull();

    const detail = await getPublicEntityDetail(resolved!.worldId, entitySlug);
    expect(detail).not.toBeNull();

    const raw = JSON.stringify(detail);
    expect(raw).not.toContain(SECRET_BLOCK_MARKER);
    expect(raw).not.toContain("Secret MJ");
  });

  it("le contenu d'un segment gm dans un bloc public est absent de la reponse brute", async () => {
    const token = await insertTestShareLink();
    const resolved = await resolveShareLink(token);
    const detail = await getPublicEntityDetail(resolved!.worldId, entitySlug);

    const raw = JSON.stringify(detail);
    expect(raw).not.toContain(SECRET_SEGMENT_MARKER);
    // Le segment public voisin, lui, doit bien passer — sinon le test
    // precedent pourrait passer par accident (tout filtre, y compris le
    // public).
    expect(raw).toContain(PUBLIC_MARKER);
  });

  it("un jeton revoque ne resout plus rien (meme reponse qu'un jeton jamais existe)", async () => {
    const token = await insertTestShareLink();
    const { error } = await admin
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashShareToken(token));
    if (error) throw new Error(error.message);

    expect(await resolveShareLink(token)).toBeNull();
    expect(await resolveShareLink("un-jeton-qui-n-a-jamais-existe")).toBeNull();
  });

  it("un jeton valide resout bien le monde attendu", async () => {
    const token = await insertTestShareLink();
    const resolved = await resolveShareLink(token);
    expect(resolved?.worldId).toBe(worldId);
    expect(resolved?.scope).toBe("public_only");
  });
});
