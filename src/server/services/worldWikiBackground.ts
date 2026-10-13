import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { ThemeMode } from "@/src/core/theme/oklch";
import {
  checkWikiBackgroundMode,
  findBuiltinBackground,
  parseWorldWikiBackground,
  worldWikiBackgroundView,
  type WikiBackgroundInput,
  type WikiBackgroundView,
  type WorldWikiBackground,
} from "@/src/core/theme/worldWikiBackground";
import { getAssetById } from "@/src/server/repos/assets";
import { getBackgroundImageAssetId, getBackgroundImageById } from "@/src/server/repos/backgroundImages";
import { getWorldWikiBackground, setWorldWikiBackground } from "@/src/server/repos/worlds";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { copyAssetToWorld, deleteAsset } from "@/src/server/services/storage";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-59 (ADR 0047) — le fond par défaut du wiki d'un monde, côté membres
 * (client de l'appelant, RLS ordinaire). Le wiki public le lit par
 * `publicShare.ts`.
 */

/** L'adresse par laquelle un MEMBRE obtient la copie, sans sa version (`?v=` l'identifiant de la copie). */
export function memberWorldBackgroundImageBase(worldSlug: string): string {
  return `/api/worlds/${encodeURIComponent(worldSlug)}/wiki-background/image`;
}

/** Le réglage stocké, relu. Un contenu illisible vaut « aucun fond », journalisé. */
export async function readWorldWikiBackground(supabase: TypedClient, worldId: string): Promise<WorldWikiBackground | null> {
  const raw = await getWorldWikiBackground(supabase, worldId);
  const parsed = parseWorldWikiBackground(raw);
  if (raw !== null && parsed === null) console.error("Fond par défaut du wiki illisible, ignoré", worldId);
  return parsed;
}

/** Le fond par défaut tel qu'un membre le voit (onglet Wiki des joueuses). */
export const getMemberWorldWikiBackground = cache(async function getMemberWorldWikiBackground(
  supabase: TypedClient,
  world: { id: string; slug: string }
): Promise<WikiBackgroundView | null> {
  const setting = await readWorldWikiBackground(supabase, world.id);
  return worldWikiBackgroundView(setting, setting?.source === "world_asset" ? `${memberWorldBackgroundImageBase(world.slug)}?v=${setting.assetId}` : null);
});

export type SetWikiBackgroundError = "forbidden" | "not_found" | "invalid_mode";

/** Retire une ancienne copie. Un échec laisse un fichier orphelin, jamais un fond faux : journalisé, sans faire échouer l'enregistrement. */
async function removeOldCopy(supabase: TypedClient, assetId: string): Promise<void> {
  try {
    await deleteAsset(supabase, assetId);
  } catch (erreur) {
    console.error("Ancienne copie du fond du wiki non supprimée", assetId, erreur);
  }
}

/**
 * Le MJ choisit le fond par défaut. Une image de sa bibliothèque est COPIÉE
 * dans le stockage du monde, en visibilité `players` : les membres la lisent
 * par la RLS, les visiteurs du wiki public par `publicShare.ts`, et la
 * bibliothèque reste privée. Changer de fond supprime l'ancienne copie.
 */
export async function setWorldWikiBackgroundByGm(
  supabase: TypedClient,
  params: { worldId: string; userId: string; input: WikiBackgroundInput }
): Promise<{ ok: true; setting: WorldWikiBackground | null } | { ok: false; reason: SetWikiBackgroundError }> {
  if (!(await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.userId }))) return { ok: false, reason: "forbidden" };

  const current = await readWorldWikiBackground(supabase, params.worldId);
  const input = params.input;
  let next: WorldWikiBackground | null = null;
  let newCopyId: string | null = null;

  if (input.source === "builtin") {
    const builtin = findBuiltinBackground(input.key);
    if (!builtin) return { ok: false, reason: "not_found" };
    if (!checkWikiBackgroundMode(input.mode, builtin.availableModes)) return { ok: false, reason: "invalid_mode" };
    next = { source: "builtin", key: builtin.slug, mode: input.mode, blur: input.blur };
  } else if (input.source === "library") {
    // RLS : seule la propriétaire de l'image la voit, donc on ne copie jamais l'image d'un autre compte.
    const [image, assetId] = await Promise.all([
      getBackgroundImageById(supabase, input.backgroundImageId),
      getBackgroundImageAssetId(supabase, input.backgroundImageId),
    ]);
    const asset = assetId ? await getAssetById(supabase, assetId) : null;
    if (!image || !asset) return { ok: false, reason: "not_found" };
    const availableModes = image.available_modes as ThemeMode[];
    if (!checkWikiBackgroundMode(input.mode, availableModes)) return { ok: false, reason: "invalid_mode" };
    newCopyId = await copyAssetToWorld(supabase, asset, { worldId: params.worldId, uploadedBy: params.userId, visibilityLevel: "players" });
    next = { source: "world_asset", assetId: newCopyId, mode: input.mode, blur: input.blur, hue: image.hue, chroma: image.chroma, availableModes };
  }

  try {
    const { updated } = await setWorldWikiBackground(supabase, params.worldId, next as unknown as Json);
    if (!updated) throw new Error("monde non modifié");
  } catch (erreur) {
    // Le réglage n'a pas changé : la copie qu'on vient de faire ne servirait à rien.
    if (newCopyId) await removeOldCopy(supabase, newCopyId);
    throw erreur;
  }

  if (current?.source === "world_asset") await removeOldCopy(supabase, current.assetId);
  return { ok: true, setting: next };
}
