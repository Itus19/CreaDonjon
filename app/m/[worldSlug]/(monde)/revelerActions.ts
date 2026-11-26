"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revealPlacesSchema } from "@/lib/worldgen/schemas";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { revealPlacesAround } from "@/src/server/services/worldReveal";

/**
 * G-7b — fait naître les villes autour d'un lieu, depuis la carte d'un monde
 * créé avec Azgaar. Entrée validée par Zod ; le droit (MJ du monde) et
 * l'appartenance du lieu au monde sont tranchés par le service.
 */
export type RevealActionResult = { ok: true; created: { slug: string; name: string }[] } | { ok: false; error: string };

const ERRORS = {
  forbidden: "Seul le MJ de ce monde peut révéler des lieux.",
  not_found: "Lieu introuvable.",
  no_map: "Ce monde n'a pas été créé depuis une carte.",
  not_on_map: "Ce lieu n'est pas une ville de la carte.",
  conflict: "La carte a été modifiée entre-temps. Réessayez.",
} as const;

export async function revealPlacesAction(input: unknown): Promise<RevealActionResult> {
  const parsed = revealPlacesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: ERRORS.forbidden };
  const world = await getWorldBySlug(supabase, parsed.data.worldSlug);
  if (!world) return { ok: false, error: ERRORS.not_found };

  const result = await revealPlacesAround(supabase, {
    worldId: world.id,
    userId: user.id,
    entityId: parsed.data.entityId,
    radiusKm: parsed.data.radiusKm,
  });
  if (!result.ok) return { ok: false, error: ERRORS[result.reason] };
  if (result.created.length > 0) revalidatePath(`/m/${parsed.data.worldSlug}`, "layout");
  return { ok: true, created: result.created.map(({ slug, name }) => ({ slug, name })) };
}
