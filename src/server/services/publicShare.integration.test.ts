import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateShareToken, hashShareToken } from "../../core/shareLinks/token";
import { resolveShareLink, getPublicEntityDetail, getPublicBlockImageAssetId } from "./publicShare";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

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

  /**
   * V2.1-20 lot 2 : trois blocs `image` portant chacun un asset, pour couvrir
   * les trois cas de `getPublicBlockImageAssetId`. Ils existent en base mais
   * aucun fichier n'est televerse dans le stockage — inutile, cette fonction
   * decide de servir ou non AVANT de signer quoi que ce soit, et c'est
   * exactement la decision qu'on veut voir echouer si elle regresse.
   */
  let imageBlockPublicId = "";
  let imageBlockGmId = "";
  let imageBlockOnHiddenEntityId = "";
  let assetId = "";

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

    userId = (await getReusableTestAccount(admin, "owner")).id;

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

    // --- V2.1-20 lot 2 : la route d'image de bloc devient atteignable par un
    // visiteur anonyme (le middleware la redirigeait vers /login). Trois cas,
    // et le premier est le temoin : sans lui, les deux refus pourraient passer
    // parce que la fonction refuse TOUT.
    const { data: hiddenEntity, error: hiddenError } = await admin
      .from("entities")
      .insert({
        world_id: worldId,
        slug: "fiche-masquee",
        name: "Fiche masquee",
        entity_kind: "other",
        created_by: userId,
        is_public: false,
      })
      .select("id")
      .single();
    if (hiddenError || !hiddenEntity) throw new Error(hiddenError?.message ?? "creation fiche masquee echouee");

    const { data: asset, error: assetError } = await admin
      .from("assets")
      .insert({
        world_id: worldId,
        storage_path: `${worldId}/integration-${Date.now()}.webp`,
        mime_type: "image/webp",
        byte_size: 1234,
        width: 16,
        height: 16,
        visibility_level: "players",
        uploaded_by: userId,
      })
      .select("id")
      .single();
    if (assetError || !asset) throw new Error(assetError?.message ?? "creation asset echouee");
    assetId = asset.id;

    const { data: imageBlocks, error: imageBlocksError } = await admin
      .from("blocks")
      .insert([
        {
          entity_id: entityId,
          block_type: "image",
          display: { label: "Image publique", layout: "image" },
          visibility_level: "public",
          display_order: 300,
          created_by: userId,
          data: { __v: 1, url: "", useAsWikiBackground: true },
        },
        {
          entity_id: entityId,
          block_type: "image",
          display: { label: "Image MJ", layout: "image" },
          visibility_level: "gm",
          display_order: 400,
          created_by: userId,
          data: { __v: 1, url: "" },
        },
        {
          entity_id: hiddenEntity.id,
          block_type: "image",
          display: { label: "Image publique sur fiche masquee", layout: "image" },
          visibility_level: "public",
          display_order: 100,
          created_by: userId,
          data: { __v: 1, url: "" },
        },
      ])
      .select("id, entity_id, visibility_level, display_order");
    if (imageBlocksError || !imageBlocks) throw new Error(imageBlocksError?.message ?? "creation blocs image echouee");

    imageBlockPublicId = imageBlocks.find((b) => b.entity_id === entityId && b.display_order === 300)!.id;
    imageBlockGmId = imageBlocks.find((b) => b.entity_id === entityId && b.display_order === 400)!.id;
    imageBlockOnHiddenEntityId = imageBlocks.find((b) => b.entity_id === hiddenEntity.id)!.id;

    const { error: linkError } = await admin.from("block_images").insert(
      [imageBlockPublicId, imageBlockGmId, imageBlockOnHiddenEntityId].map((blockId) => ({
        block_id: blockId,
        asset_id: assetId,
      }))
    );
    if (linkError) throw new Error(linkError.message);
  });

  afterAll(async () => {
    // world_id est en cascade sur entities/blocks/share_links (SCHEMA.md
    // §5-§7, §18) : supprimer le monde suffit a tout nettoyer.
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
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

  /**
   * V2.1-20 lot 2. Ces trois tests gardent une route qui, jusqu'a ce lot,
   * n'etait atteignable par personne : le middleware redirigeait
   * `/api/blocks/[id]/image` vers /login avant qu'elle ne s'execute. Deux
   * defauts se cachaient derriere — l'image de fond ne s'affichait jamais pour
   * un visiteur anonyme, ET la seule garde qui restait une fois le middleware
   * corrige ne regardait que la visibilite du bloc, pas celle de la fiche.
   *
   * Le premier test est le temoin : sans lui, les deux refus passeraient aussi
   * bien si la fonction refusait tout.
   */
  it("l'image d'un bloc public sur une fiche publique est bien servie", async () => {
    expect(await getPublicBlockImageAssetId(imageBlockPublicId)).toBe(assetId);
  });

  it("l'image d'un bloc gm n'est jamais servie a un visiteur anonyme", async () => {
    expect(await getPublicBlockImageAssetId(imageBlockGmId)).toBeNull();
  });

  it("l'image d'un bloc public pose sur une fiche MASQUEE n'est jamais servie", async () => {
    expect(await getPublicBlockImageAssetId(imageBlockOnHiddenEntityId)).toBeNull();
  });

  it("un jeton valide resout bien le monde attendu", async () => {
    const token = await insertTestShareLink();
    const resolved = await resolveShareLink(token);
    expect(resolved?.worldId).toBe(worldId);
    expect(resolved?.scope).toBe("public_only");
  });
});
