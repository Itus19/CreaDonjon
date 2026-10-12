import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { Database } from "@/src/types/database";
import { DEFAULT_MAP_BLOCK_DATA } from "@/src/core/schemas/blocks/map";
import { defaultBlockData } from "@/src/core/schemas/blocks/registry";
import type { Json } from "@/src/types/database";
import { ASSETS_BUCKET } from "./storage";
import { duplicateWorld } from "./worldExport";

/**
 * V3-F3 (ADR 0058) — sur la vraie base : dupliquer copie le wiki ET ses
 * images dans le monde neuf (carte, portrait, bloc Image), jamais la partie
 * (decouvertes), dans le mode choisi, avec ou sans les regles du monde.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

const WEBP_1PX = Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=", "base64");

describe.skipIf(!hasCreds)("dupliquer un monde copie son wiki et ses images (integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: { id: string; client: SupabaseClient };
  let sourceId: string;
  let campagneSourceId: string;
  let copieId: string | null = null;
  const images: Record<string, string> = {};

  async function creerImage(nom: string): Promise<string> {
    const id = crypto.randomUUID();
    const chemin = `${sourceId}/${id}.webp`;
    const envoi = await admin.storage.from(ASSETS_BUCKET).upload(chemin, WEBP_1PX, { contentType: "image/webp" });
    if (envoi.error) throw new Error(envoi.error.message);
    const { error } = await admin.from("assets").insert({
      id,
      world_id: sourceId,
      storage_path: chemin,
      mime_type: "image/webp",
      byte_size: WEBP_1PX.byteLength,
      uploaded_by: gm.id,
      visibility_level: "players",
    });
    if (error) throw new Error(error.message);
    images[nom] = id;
    return id;
  }

  /** Nettoyage de fin : les blocs d'abord, pour ne jamais laisser de reste meme sans la migration 20261012140000. */
  async function nettoyerMonde(worldId: string) {
    const { data: fichiers } = await admin.storage.from(ASSETS_BUCKET).list(worldId);
    if (fichiers?.length) await admin.storage.from(ASSETS_BUCKET).remove(fichiers.map((f) => `${worldId}/${f.name}`));
    const { data: fiches } = await admin.from("entities").select("id").eq("world_id", worldId);
    if (fiches?.length) await admin.from("blocks").delete().in("entity_id", fiches.map((f) => f.id));
    await admin.from("worlds").delete().eq("id", worldId);
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    gm = await getReusableTestAccount(admin, "gm");

    const { data: officiel, error: officielError } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    if (officielError || !officiel) throw new Error(officielError?.message ?? "aucun ruleset officiel");

    const { data: monde, error: mondeError } = await admin
      .from("worlds")
      .insert({ name: "Monde solo a copier", slug: `integration-test-duplicate-${Date.now()}`, owner_id: gm.id, default_ruleset_id: officiel.id })
      .select("id")
      .single();
    if (mondeError || !monde) throw new Error(mondeError?.message ?? "creation monde echouee");
    sourceId = monde.id;

    const { data: campagne, error: campagneError } = await admin
      .from("campaigns")
      .insert({ world_id: sourceId, name: "Partie solo", ruleset_id: officiel.id, mode: "solo", gm_user_id: null })
      .select("id")
      .single();
    if (campagneError || !campagne) throw new Error(campagneError?.message ?? "creation campagne echouee");
    campagneSourceId = campagne.id;
    await admin.from("campaign_members").insert({ campaign_id: campagneSourceId, user_id: gm.id, role: "player" });

    const { data: fiche, error: ficheError } = await admin
      .from("entities")
      .insert({ world_id: sourceId, slug: "port", name: "Le port", entity_kind: "location", created_by: gm.id })
      .select("id")
      .single();
    if (ficheError || !fiche) throw new Error(ficheError?.message ?? "creation fiche echouee");

    await creerImage("carte");
    await creerImage("vignette");
    await creerImage("portrait");
    await creerImage("illustration");
    await creerImage("orpheline"); // designee par rien : ne doit pas etre copiee

    const { error: portraitError } = await admin.from("entity_assets").insert({ entity_id: fiche.id, asset_id: images.portrait, role: "portrait" });
    if (portraitError) throw new Error(portraitError.message);

    const { data: blocs, error: blocsError } = await admin
      .from("blocks")
      .insert([
        {
          entity_id: fiche.id,
          block_type: "map",
          data: { ...DEFAULT_MAP_BLOCK_DATA, mode: "own", assetId: images.carte, thumbnailAssetId: images.vignette },
          display: {},
          display_order: 1000,
          visibility_level: "players",
          created_by: gm.id,
        },
        { entity_id: fiche.id, block_type: "image", data: defaultBlockData("image") as Json, display: {}, display_order: 2000, visibility_level: "players", created_by: gm.id },
      ])
      .select("id, block_type");
    if (blocsError || !blocs) throw new Error(blocsError?.message ?? "creation blocs echouee");
    const blocImage = blocs.find((b) => b.block_type === "image")!.id;
    const { error: lienError } = await admin.from("block_images").insert({ block_id: blocImage, asset_id: images.illustration });
    if (lienError) throw new Error(lienError.message);

    // Une trace de la partie : elle ne doit pas suivre.
    await admin.from("entity_discoveries").insert({ campaign_id: campagneSourceId, user_id: gm.id, entity_id: fiche.id, detail_level: "known" });
  });

  afterAll(async () => {
    if (copieId) await nettoyerMonde(copieId);
    if (sourceId) await nettoyerMonde(sourceId);
  });

  it("copie un monde solo en campagne, sans les regles du monde, avec ses images", async () => {
    const resultat = await duplicateWorld(gm.client as SupabaseClient<Database>, {
      worldId: sourceId,
      ownerId: gm.id,
      mode: "campaign",
      rulesFollow: false,
    });
    copieId = resultat.world.id;
    expect(resultat.campaign.mode).toBe("campaign");

    // Le proprietaire est MJ de la copie.
    const { data: membres } = await admin.from("campaign_members").select("user_id, role").eq("campaign_id", resultat.campaign.id);
    expect(membres).toEqual([{ user_id: gm.id, role: "gm" }]);

    // Quatre images designees copiees dans le monde neuf ; l'orpheline non.
    const { data: copiees } = await admin.from("assets").select("id, storage_path, visibility_level").eq("world_id", copieId);
    expect((copiees ?? []).length).toBe(4);
    for (const a of copiees ?? []) {
      expect(a.storage_path.startsWith(`${copieId}/`)).toBe(true);
      expect(a.visibility_level).toBe("players");
    }
    const idsCopies = new Set((copiees ?? []).map((a) => a.id));

    // La carte de la copie designe ses propres images.
    const { data: fiches } = await admin.from("entities").select("id").eq("world_id", copieId!).eq("name", "Le port");
    const ficheCopie = fiches?.[0]?.id;
    expect(ficheCopie).toBeTruthy();
    const { data: blocsCopie } = await admin.from("blocks").select("id, block_type, data").eq("entity_id", ficheCopie!);
    const carte = blocsCopie?.find((b) => b.block_type === "map")?.data as { assetId: string; thumbnailAssetId: string };
    expect(idsCopies.has(carte.assetId)).toBe(true);
    expect(idsCopies.has(carte.thumbnailAssetId)).toBe(true);

    // Portrait et bloc Image rattaches a la fiche et au bloc neufs.
    const { data: portrait } = await admin.from("entity_assets").select("asset_id").eq("entity_id", ficheCopie!);
    expect(idsCopies.has(portrait?.[0]?.asset_id ?? "")).toBe(true);
    const blocImage = blocsCopie?.find((b) => b.block_type === "image")?.id;
    const { data: lien } = await admin.from("block_images").select("asset_id").eq("block_id", blocImage!);
    expect(idsCopies.has(lien?.[0]?.asset_id ?? "")).toBe(true);

    // Rien de la partie : aucune decouverte dans la copie.
    const { data: decouvertes } = await admin.from("entity_discoveries").select("entity_id").eq("campaign_id", resultat.campaign.id);
    expect(decouvertes ?? []).toEqual([]);
  });

  it("« les regles suivent » reprend tel quel un ruleset personnel ; « non » repart de l'officiel", async () => {
    const { data: officiel } = await admin.from("rulesets").select("id, base_system").eq("is_official_base", true).limit(1).single();
    const { data: personnel, error } = await admin
      .from("rulesets")
      .insert({ name: "Regles perso (test)", base_system: officiel!.base_system, content_origin: "personal_reference", parent_ruleset_id: officiel!.id, created_by: gm.id })
      .select("id")
      .single();
    if (error || !personnel) throw new Error(error?.message ?? "creation ruleset personnel echouee");
    try {
      await admin.from("worlds").update({ default_ruleset_id: personnel.id }).eq("id", sourceId);
      const suivent = await duplicateWorld(gm.client as SupabaseClient<Database>, { worldId: sourceId, ownerId: gm.id, mode: "campaign", rulesFollow: true });
      const repart = await duplicateWorld(gm.client as SupabaseClient<Database>, { worldId: sourceId, ownerId: gm.id, mode: "campaign", rulesFollow: false });
      try {
        const { data: c1 } = await admin.from("campaigns").select("ruleset_id").eq("id", suivent.campaign.id).single();
        const { data: c2 } = await admin.from("campaigns").select("ruleset_id").eq("id", repart.campaign.id).single();
        expect(c1?.ruleset_id).toBe(personnel.id);
        expect(c2?.ruleset_id).toBe(officiel!.id);
      } finally {
        await nettoyerMonde(suivent.world.id);
        await nettoyerMonde(repart.world.id);
      }
    } finally {
      await admin.from("worlds").update({ default_ruleset_id: officiel!.id }).eq("id", sourceId);
      await admin.from("rulesets").delete().eq("id", personnel.id);
    }
  });

  it("les images de la copie survivent a la suppression du monde d'origine", async () => {
    // Une seule suppression, comme « Supprimer le monde » dans l'app : exige
    // la migration 20261012140000 des qu'un bloc Image existe.
    const { error } = await admin.from("worlds").delete().eq("id", sourceId);
    expect(error).toBeNull();
    await nettoyerMonde(sourceId);
    sourceId = "";
    const { data: copiees } = await admin.from("assets").select("storage_path").eq("world_id", copieId!);
    const { data: fichiers } = await admin.storage.from(ASSETS_BUCKET).list(copieId!);
    const presents = new Set((fichiers ?? []).map((f) => `${copieId}/${f.name}`));
    expect((copiees ?? []).length).toBe(4);
    for (const a of copiees ?? []) expect(presents.has(a.storage_path)).toBe(true);
  });
});
