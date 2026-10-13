import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { detectRasterImageType, type AppIdentityInput } from "@/src/core/brand/identity";
import { deleteAppIdentityRow, getAppIdentityRow, upsertAppIdentityRow, type AppIdentityRow } from "@/src/server/repos/appIdentity";
import { isSuperadmin } from "@/src/server/services/account";
import { putBrandLogo, removeBrandLogo } from "@/src/server/services/storage";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-84 (ADR 0061) — ÉCRITURE de l'identité de l'application, réservée au
 * superadmin. Fichier à part de la lecture (`appIdentity.ts`) : il charge
 * `sharp`, que le layout racine ne doit jamais embarquer.
 *
 * Deux barrières : `isSuperadmin` ici, et la RLS (`app_identity_*`,
 * `brand_bucket_*`) en base. Un logo téléversé est contrôlé par sa
 * signature (jamais l'extension : un SVG peut porter du script), doit être
 * carré, au moins 512 px, puis il est RÉENCODÉ en WebP 512 px : ce qui part
 * en stockage est toujours une image matricielle produite par le serveur.
 */

/** Sous la limite de 1 Mo des actions serveur de Next, enveloppe du formulaire comprise. */
export const MAX_LOGO_UPLOAD_BYTES = 900 * 1024;
const LOGO_SIZE = 512;

export type LogoChange = { kind: "keep" } | { kind: "remove" } | { kind: "upload"; bytes: Buffer };

export type AppIdentityWriteError = "forbidden" | "too_large" | "unsupported_type" | "not_square" | "too_small" | "invalid_image";

/** Contrôle et réencode un logo téléversé. */
async function prepareLogo(bytes: Buffer): Promise<{ ok: true; webp: Buffer } | { ok: false; reason: AppIdentityWriteError }> {
  if (bytes.byteLength > MAX_LOGO_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  if (!detectRasterImageType(bytes)) return { ok: false, reason: "unsupported_type" };
  const { default: sharp } = await import("sharp");
  try {
    const meta = await sharp(bytes).metadata();
    if (!meta.width || !meta.height) return { ok: false, reason: "invalid_image" };
    if (meta.width !== meta.height) return { ok: false, reason: "not_square" };
    if (meta.width < LOGO_SIZE) return { ok: false, reason: "too_small" };
    const webp = await sharp(bytes).resize(LOGO_SIZE, LOGO_SIZE).webp({ quality: 90 }).toBuffer();
    return { ok: true, webp };
  } catch (erreur) {
    // Signature correcte mais contenu illisible (fichier tronqué ou forgé) : refus ordinaire, journalisé.
    console.error("Logo illisible", erreur);
    return { ok: false, reason: "invalid_image" };
  }
}

/** Retire un ancien fichier de logo. Un échec laisse un fichier orphelin, jamais une identité fausse : on le journalise sans faire échouer l'enregistrement. */
async function removeOldLogo(supabase: TypedClient, path: string): Promise<void> {
  try {
    await removeBrandLogo(supabase, path);
  } catch (erreur) {
    console.error("Ancien logo non supprimé", path, erreur);
  }
}

export async function updateAppIdentity(
  supabase: TypedClient,
  params: { userId: string; input: AppIdentityInput; logo: LogoChange }
): Promise<{ ok: true; row: AppIdentityRow } | { ok: false; reason: AppIdentityWriteError }> {
  if (!(await isSuperadmin(supabase, params.userId))) return { ok: false, reason: "forbidden" };

  const current = await getAppIdentityRow(supabase);
  const oldPath = current?.logo_storage_path ?? null;
  let path = params.logo.kind === "remove" ? null : oldPath;
  let uploadedPath: string | null = null;

  if (params.logo.kind === "upload") {
    const prepared = await prepareLogo(params.logo.bytes);
    if (!prepared.ok) return prepared;
    uploadedPath = `logo/${randomUUID()}.webp`;
    await putBrandLogo(supabase, uploadedPath, prepared.webp);
    path = uploadedPath;
  }

  let row: AppIdentityRow;
  try {
    row = await upsertAppIdentityRow(supabase, {
      name: params.input.name,
      tagline: params.input.tagline,
      logo_key: params.input.logoKey,
      logo_storage_path: path,
      updated_by: params.userId,
    });
  } catch (erreur) {
    // La ligne n'a pas changé : le fichier qu'on vient d'écrire ne servirait à rien.
    if (uploadedPath) await removeOldLogo(supabase, uploadedPath);
    throw erreur;
  }

  if (oldPath && oldPath !== path) await removeOldLogo(supabase, oldPath);
  return { ok: true, row };
}

/** « Rétablir « Antre Nous » » : supprime la ligne et le logo téléversé. */
export async function resetAppIdentity(supabase: TypedClient, userId: string): Promise<{ ok: true } | { ok: false; reason: "forbidden" }> {
  if (!(await isSuperadmin(supabase, userId))) return { ok: false, reason: "forbidden" };
  const current = await getAppIdentityRow(supabase);
  await deleteAppIdentityRow(supabase);
  if (current?.logo_storage_path) await removeOldLogo(supabase, current.logo_storage_path);
  return { ok: true };
}
