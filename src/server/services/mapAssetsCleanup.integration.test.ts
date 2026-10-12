import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { Database } from "@/src/types/database";
import { DEFAULT_MAP_BLOCK_DATA } from "@/src/core/schemas/blocks/map";
import { ASSETS_BUCKET } from "./storage";
import { deleteBlock, updateBlockContent } from "./blocks";

/**
 * V3.1-128 (ADR 0057) — sur la vraie base : l'image d'une carte remplacee
 * ou supprimee est effacee du stockage, SAUF si un autre bloc la designe
 * encore, meme un bloc que l'appelant ne voit pas (bloc prive d'une
 * joueuse, copie de la carte). Exige la migration 20261012120000.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

// Plus petit WebP valide (1 x 1) : le contenu ne compte pas, seule sa presence.
const WEBP_1PX = Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=", "base64");

describe.skipIf(!hasCreds)("images des cartes effacees quand plus rien ne les designe (integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: { id: string; client: SupabaseClient };
  let player: { id: string; client: SupabaseClient };
  let outsider: { id: string; client: SupabaseClient };
  let worldId: string;
  /** Un second monde, comme une copie faite avant l'ADR 0058 : sa carte designe une image du premier. */
  let copieAncienneId: string;
  let mapBlockId: string;
  let fichesDuMonde: string[] = [];
  const assets: Record<string, string> = {};

  async function creerImage(nom: string): Promise<string> {
    const id = crypto.randomUUID();
    const storagePath = `${worldId}/${id}.webp`;
    const { error: uploadError } = await admin.storage.from(ASSETS_BUCKET).upload(storagePath, WEBP_1PX, { contentType: "image/webp" });
    if (uploadError) throw new Error(uploadError.message);
    const { error } = await admin.from("assets").insert({
      id,
      world_id: worldId,
      storage_path: storagePath,
      mime_type: "image/webp",
      byte_size: WEBP_1PX.byteLength,
      uploaded_by: gm.id,
      visibility_level: "gm",
    });
    if (error) throw new Error(error.message);
    assets[nom] = id;
    return id;
  }

  /** La ligne `assets` ET le fichier existent-ils encore ? */
  async function existe(nom: string): Promise<{ ligne: boolean; fichier: boolean }> {
    const id = assets[nom];
    const { data: ligne } = await admin.from("assets").select("id").eq("id", id).maybeSingle();
    const { data: fichiers } = await admin.storage.from(ASSETS_BUCKET).list(worldId, { search: id });
    return { ligne: ligne !== null, fichier: (fichiers ?? []).some((f) => f.name === `${id}.webp`) };
  }

  const carte = (assetId: string, thumbnailAssetId: string) => ({ ...DEFAULT_MAP_BLOCK_DATA, mode: "own" as const, assetId, thumbnailAssetId });

  async function versionDe(blockId: string): Promise<number> {
    const { data, error } = await admin.from("blocks").select("version").eq("id", blockId).single();
    if (error || !data) throw new Error(error?.message ?? "bloc introuvable");
    return data.version;
  }

  async function remplacer(assetId: string, thumbnailAssetId: string) {
    const resultat = await updateBlockContent(gm.client as SupabaseClient<Database>, {
      id: mapBlockId,
      expectedVersion: await versionDe(mapBlockId),
      display: {},
      data: carte(assetId, thumbnailAssetId),
      visibilityLevel: "gm",
      visibilityScopeId: null,
      changedBy: gm.id,
    });
    expect(resultat.ok).toBe(true);
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, player, outsider] = await Promise.all([
      getReusableTestAccount(admin, "gm"),
      getReusableTestAccount(admin, "player"),
      getReusableTestAccount(admin, "outsider"),
    ]);

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test images de cartes", slug: `integration-test-map-assets-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    // La joueuse est membre du monde : elle peut y avoir un bloc prive.
    const { error: memberError } = await admin.from("world_members").insert({ world_id: worldId, user_id: player.id, role: "viewer" });
    if (memberError) throw new Error(memberError.message);

    const { data: fiches, error: fichesError } = await admin
      .from("entities")
      .insert([
        { world_id: worldId, slug: "carte", name: "Carte", entity_kind: "carte", created_by: gm.id },
        { world_id: worldId, slug: "copie", name: "Carte (copie)", entity_kind: "carte", created_by: player.id },
      ])
      .select("id, slug");
    if (fichesError || !fiches) throw new Error(fichesError?.message ?? "creation fiches echouee");
    const ficheCarte = fiches.find((f) => f.slug === "carte")!.id;
    const ficheCopie = fiches.find((f) => f.slug === "copie")!.id;
    fichesDuMonde = [ficheCarte, ficheCopie];

    await creerImage("partagee");
    await creerImage("partageeVignette");
    await creerImage("seconde");
    await creerImage("secondeVignette");
    await creerImage("troisieme");
    await creerImage("troisiemeVignette");

    const { data: blocs, error: blocsError } = await admin
      .from("blocks")
      .insert([
        {
          entity_id: ficheCarte,
          block_type: "map",
          data: carte(assets.partagee, assets.partageeVignette),
          display: {},
          display_order: 1000,
          visibility_level: "gm",
          created_by: gm.id,
        },
        // La copie : meme images, dans un bloc PRIVE de la joueuse, que le MJ ne voit pas.
        {
          entity_id: ficheCopie,
          block_type: "map",
          data: carte(assets.partagee, assets.partageeVignette),
          display: {},
          display_order: 1000,
          visibility_level: "private",
          created_by: player.id,
        },
      ])
      .select("id, entity_id");
    if (blocsError || !blocs) throw new Error(blocsError?.message ?? "creation blocs echouee");
    mapBlockId = blocs.find((b) => b.entity_id === ficheCarte)!.id;

    const { data: copie, error: copieError } = await admin
      .from("worlds")
      .insert({ name: "Ancienne copie (test images)", slug: `integration-test-map-assets-copie-${Date.now()}`, owner_id: gm.id })
      .select("id")
      .single();
    if (copieError || !copie) throw new Error(copieError?.message ?? "creation copie echouee");
    copieAncienneId = copie.id;
    const { data: ficheAncienne, error: ficheAncienneError } = await admin
      .from("entities")
      .insert({ world_id: copieAncienneId, slug: "carte", name: "Carte (copie)", entity_kind: "carte", created_by: gm.id })
      .select("id")
      .single();
    if (ficheAncienneError || !ficheAncienne) throw new Error(ficheAncienneError?.message ?? "creation fiche copie echouee");
    const { error: blocAncienError } = await admin.from("blocks").insert({
      entity_id: ficheAncienne.id,
      block_type: "map",
      data: carte(assets.troisieme, assets.partageeVignette),
      display: {},
      display_order: 1000,
      visibility_level: "gm",
      created_by: gm.id,
    });
    if (blocAncienError) throw new Error(blocAncienError.message);
  });

  afterAll(async () => {
    if (!worldId) return;
    await admin.storage.from(ASSETS_BUCKET).remove(Object.values(assets).map((id) => `${worldId}/${id}.webp`));
    await admin.from("worlds").delete().eq("id", worldId);
    if (copieAncienneId) await admin.from("worlds").delete().eq("id", copieAncienneId);
  });

  it("le MJ ne voit pas la copie privee, mais le compte la trouve", async () => {
    const { data: visibles } = await gm.client.from("blocks").select("id").eq("block_type", "map").in("entity_id", fichesDuMonde);
    expect((visibles ?? []).length).toBe(1);
    const { data: compte, error } = await gm.client.rpc("asset_reference_count", { p_asset_id: assets.partagee });
    expect(error).toBeNull();
    expect(compte).toBe(2);
  });

  it("un compte hors du monde n'apprend rien (null)", async () => {
    const { data: compte, error } = await outsider.client.rpc("asset_reference_count", { p_asset_id: assets.partagee });
    expect(error).toBeNull();
    expect(compte).toBeNull();
  });

  it("remplacer l'image garde celle que la copie privee designe encore", async () => {
    await remplacer(assets.seconde, assets.secondeVignette);
    expect(await existe("partagee")).toEqual({ ligne: true, fichier: true });
    expect(await existe("partageeVignette")).toEqual({ ligne: true, fichier: true });
  });

  it("remplacer encore efface l'image que plus rien ne designe", async () => {
    await remplacer(assets.troisieme, assets.troisiemeVignette);
    expect(await existe("seconde")).toEqual({ ligne: false, fichier: false });
    expect(await existe("secondeVignette")).toEqual({ ligne: false, fichier: false });
  });

  it("supprimer le bloc efface ses images, sauf celle qu'une copie d'un autre monde designe encore", async () => {
    const resultat = await deleteBlock(gm.client as SupabaseClient<Database>, mapBlockId, gm.id);
    expect(resultat.ok).toBe(true);
    // ADR 0058 : l'ancienne copie (autre monde) designe `troisieme` : gardee.
    expect(await existe("troisieme")).toEqual({ ligne: true, fichier: true });
    expect(await existe("troisiemeVignette")).toEqual({ ligne: false, fichier: false });
    // La copie privee n'a pas bouge : ses images restent.
    expect(await existe("partagee")).toEqual({ ligne: true, fichier: true });
  });
});
