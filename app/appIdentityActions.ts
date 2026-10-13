"use server";

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { appIdentityFormSchema } from "@/lib/admin/schemas";
import { APP_IDENTITY_TAG } from "@/src/server/services/appIdentity";
import { MAX_LOGO_UPLOAD_BYTES, resetAppIdentity, updateAppIdentity, type AppIdentityWriteError, type LogoChange } from "@/src/server/services/appIdentityWrite";

export type AppIdentityActionState = { error: string } | { ok: true } | null;

const ERREURS: Record<AppIdentityWriteError, string> = {
  forbidden: "Réservé au superadmin.",
  too_large: "Logo trop lourd (900 Ko au plus).",
  unsupported_type: "Le logo doit être un PNG ou un WebP. Jamais de SVG : il peut contenir du script.",
  not_square: "Le logo doit être carré.",
  too_small: "Le logo doit mesurer au moins 512 px de côté.",
  invalid_image: "Ce fichier n'est pas une image lisible.",
};

/**
 * V3.1-84 (ADR 0061) — enregistre le nom, la phrase et le logo de
 * l'application. Superadmin vérifié par le service ET par la RLS ; entrée
 * validée par Zod ; le cache de lecture est invalidé aussitôt
 * (`updateTag`), pour que l'écran-titre change pour tous.
 */
export async function updateAppIdentityAction(_prev: AppIdentityActionState, formData: FormData): Promise<AppIdentityActionState> {
  const parsed = appIdentityFormSchema.safeParse({
    name: formData.get("name"),
    tagline: formData.get("tagline") ?? "",
    logoKey: formData.get("logoKey"),
    logoAction: formData.get("logoAction") ?? "keep",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  let logo: LogoChange = { kind: parsed.data.logoAction === "remove" ? "remove" : "keep" };
  if (parsed.data.logoAction === "upload") {
    const file = formData.get("logoFile");
    if (!(file instanceof File) || file.size === 0) return { error: "Aucun logo reçu." };
    // Refus avant de lire le fichier en mémoire.
    if (file.size > MAX_LOGO_UPLOAD_BYTES) return { error: ERREURS.too_large };
    logo = { kind: "upload", bytes: Buffer.from(await file.arrayBuffer()) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { name, tagline, logoKey } = parsed.data;
  const result = await updateAppIdentity(supabase, { userId: user.id, input: { name, tagline, logoKey }, logo });
  if (!result.ok) return { error: ERREURS[result.reason] };
  updateTag(APP_IDENTITY_TAG);
  return { ok: true };
}

/** « Rétablir « Antre Nous » » : retour au nom, à la phrase et au d20 par défaut. */
export async function resetAppIdentityAction(): Promise<AppIdentityActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };
  const result = await resetAppIdentity(supabase, user.id);
  if (!result.ok) return { error: ERREURS[result.reason] };
  updateTag(APP_IDENTITY_TAG);
  return { ok: true };
}
