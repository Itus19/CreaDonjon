import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import type { Database } from "@/src/types/database";
import { BUILTIN_BACKGROUNDS } from "@/src/core/theme/builtinBackgrounds";
import { ASSETS_BUCKET, getSignedAssetUrl } from "./storage";
import { getMemberWorldWikiBackground, memberWorldBackgroundImageBase, setWorldWikiBackgroundByGm } from "./worldWikiBackground";
import { getPublicWorldWikiBackground, getPublicWorldWikiBackgroundSignedUrl } from "./publicShare";

/**
 * V3.1-59 (ADR 0047) — sur la vraie base : le fond par défaut du wiki. Exige
 * la migration 20261013140000. Le monde de test est supprimé à la fin, avec
 * ses fichiers.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

const WEBP_1PX = Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=", "base64");
type Account = { id: string; client: SupabaseClient };
const typed = (a: Account) => a.client as SupabaseClient<Database>;

describe.skipIf(!hasCreds)("fond par défaut du wiki (integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let anon: SupabaseClient<Database>;
  let gm: Account;
  let player: Account;
  let worldId: string;
  let worldSlug: string;
  const bibliotheque: { imageId: string; assetId: string }[] = [];
  let copieId: string;

  /** Une image de la bibliothèque PERSONNELLE du MJ : un asset `user` et sa ligne `background_images`. */
  async function imageDeBibliotheque() {
    const assetId = crypto.randomUUID();
    const chemin = `${worldId}/${assetId}.webp`;
    const envoi = await admin.storage.from(ASSETS_BUCKET).upload(chemin, WEBP_1PX, { contentType: "image/webp" });
    if (envoi.error) throw new Error(envoi.error.message);
    const { error } = await admin.from("assets").insert({
      id: assetId, world_id: worldId, storage_path: chemin, mime_type: "image/webp", byte_size: WEBP_1PX.byteLength,
      uploaded_by: gm.id, visibility_level: "user", visibility_scope_id: gm.id,
    });
    if (error) throw new Error(error.message);
    const { data: image, error: imageError } = await admin
      .from("background_images")
      .insert({ owner_id: gm.id, asset_id: assetId, thumb_data_url: "data:,", hue: 200, chroma: 0.04, available_modes: ["dark", "dim"] })
      .select("id")
      .single();
    if (imageError || !image) throw new Error(imageError?.message ?? "bibliotheque");
    bibliotheque.push({ imageId: image.id, assetId });
    return { imageId: image.id, assetId };
  }

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    anon = createSupabaseClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    [gm, player] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("is_official_base", true).limit(1).single();
    worldSlug = `integration-test-wiki-bg-${Date.now()}`;
    const { data: world, error } = await admin.from("worlds").insert({ name: "Monde de test fond du wiki", slug: worldSlug, owner_id: gm.id }).select("id").single();
    if (error || !world) throw new Error(error?.message ?? "creation monde echouee");
    worldId = world.id;
    const { data: campaign } = await admin
      .from("campaigns")
      .insert({ world_id: worldId, name: "Campagne de test", ruleset_id: official!.id, mode: "campaign", gm_user_id: gm.id })
      .select("id")
      .single();
    await admin.from("campaign_members").insert([
      { campaign_id: campaign!.id, user_id: gm.id, role: "gm" },
      { campaign_id: campaign!.id, user_id: player.id, role: "player" },
    ]);
  });

  afterAll(async () => {
    if (bibliotheque.length) await admin.from("background_images").delete().in("id", bibliotheque.map((b) => b.imageId));
    if (!worldId) return;
    const { data: fichiers } = await admin.storage.from(ASSETS_BUCKET).list(worldId);
    if (fichiers?.length) await admin.storage.from(ASSETS_BUCKET).remove(fichiers.map((f) => `${worldId}/${f.name}`));
    await admin.from("worlds").delete().eq("id", worldId);
  });

  it("une joueuse ne peut pas choisir le fond du wiki", async () => {
    const out = await setWorldWikiBackgroundByGm(typed(player), { worldId, userId: player.id, input: { source: "none" } });
    expect(out).toEqual({ ok: false, reason: "forbidden" });
  });

  it("un fond fourni : le visiteur anonyme et la joueuse voient le même", async () => {
    const fourni = BUILTIN_BACKGROUNDS[0];
    const out = await setWorldWikiBackgroundByGm(typed(gm), { worldId, userId: gm.id, input: { source: "builtin", key: fourni.slug, mode: "dim", blur: 8 } });
    expect(out.ok).toBe(true);
    const pourVisiteur = await getPublicWorldWikiBackground(worldId, "/partage/x/fond-du-wiki");
    const pourJoueuse = await getMemberWorldWikiBackground(typed(player), { id: worldId, slug: worldSlug });
    expect(pourVisiteur).toEqual({ imageUrl: fourni.backdropUrl, blurPx: 8, fadeMs: 600, hue: fourni.hue, chroma: fourni.chroma, mode: "dim" });
    expect(pourJoueuse).toEqual(pourVisiteur);
  });

  it("un mode que le fond ne permet pas est refusé", async () => {
    const { imageId } = await imageDeBibliotheque();
    const out = await setWorldWikiBackgroundByGm(typed(gm), { worldId, userId: gm.id, input: { source: "library", backgroundImageId: imageId, mode: "light", blur: 0 } });
    expect(out).toEqual({ ok: false, reason: "invalid_mode" });
  });

  it("une image de la bibliothèque est COPIÉE dans le monde ; la joueuse et le visiteur lisent la copie, jamais l'original", async () => {
    const original = await imageDeBibliotheque();
    const autre = await imageDeBibliotheque();
    const out = await setWorldWikiBackgroundByGm(typed(gm), { worldId, userId: gm.id, input: { source: "library", backgroundImageId: original.imageId, mode: "dim", blur: 20 } });
    expect(out.ok).toBe(true);
    if (!out.ok || out.setting?.source !== "world_asset") throw new Error("pas de copie");
    copieId = out.setting.assetId;
    expect(copieId).not.toBe(original.assetId);

    const { data: copie } = await admin.from("assets").select("visibility_level, world_id").eq("id", copieId).single();
    expect(copie).toEqual({ visibility_level: "players", world_id: worldId });

    // La joueuse : par la route des membres, et elle peut signer la copie.
    const pourJoueuse = await getMemberWorldWikiBackground(typed(player), { id: worldId, slug: worldSlug });
    expect(pourJoueuse?.imageUrl).toBe(`${memberWorldBackgroundImageBase(worldSlug)}?v=${copieId}`);
    expect(await getSignedAssetUrl(typed(player), copieId)).not.toBeNull();

    // Le visiteur : la seule image signée est la copie.
    const signee = await getPublicWorldWikiBackgroundSignedUrl(worldId);
    expect(signee).toContain(copieId);
    expect(signee).not.toContain(original.assetId);

    // Aucune image de la bibliothèque n'est lisible publiquement, ni par la joueuse.
    for (const image of [original, autre]) {
      expect(await getSignedAssetUrl(anon, image.assetId)).toBeNull();
      expect(await getSignedAssetUrl(typed(player), image.assetId)).toBeNull();
      const { data } = await anon.from("assets").select("id").eq("id", image.assetId);
      expect(data ?? []).toEqual([]);
    }
  });

  it("garder le fond (V3.1-60) : le mode et le flou changent, la même copie reste, sans recopie", async () => {
    const out = await setWorldWikiBackgroundByGm(typed(gm), { worldId, userId: gm.id, input: { source: "keep", mode: "dark", blur: 6 } });
    expect(out.ok).toBe(true);
    if (!out.ok || out.setting?.source !== "world_asset") throw new Error("copie perdue");
    expect(out.setting.assetId).toBe(copieId);
    expect(out.setting).toMatchObject({ mode: "dark", blur: 6 });
    const { data: copie } = await admin.from("assets").select("id").eq("id", copieId);
    expect(copie ?? []).toHaveLength(1);
    const { count } = await admin.from("assets").select("id", { count: "exact", head: true }).eq("world_id", worldId).eq("visibility_level", "players");
    expect(count).toBe(1);

    expect(await setWorldWikiBackgroundByGm(typed(gm), { worldId, userId: gm.id, input: { source: "keep", mode: "light", blur: 6 } })).toEqual({ ok: false, reason: "invalid_mode" });
    expect(await setWorldWikiBackgroundByGm(typed(player), { worldId, userId: player.id, input: { source: "keep", mode: "dim", blur: 6 } })).toEqual({ ok: false, reason: "forbidden" });
  });

  it("changer de fond supprime l'ancienne copie, jamais l'original de la bibliothèque", async () => {
    const out = await setWorldWikiBackgroundByGm(typed(gm), { worldId, userId: gm.id, input: { source: "none" } });
    expect(out).toEqual({ ok: true, setting: null });
    const { data: copie } = await admin.from("assets").select("id").eq("id", copieId);
    expect(copie ?? []).toEqual([]);
    const { data: originaux } = await admin.from("assets").select("id").in("id", bibliotheque.map((b) => b.assetId));
    expect((originaux ?? []).length).toBe(bibliotheque.length);
    expect(await getPublicWorldWikiBackground(worldId, "/partage/y/fond-du-wiki")).toBeNull();
  });
});
