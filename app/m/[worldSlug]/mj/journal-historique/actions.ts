"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { restoreDeletedEntity } from "@/src/server/services/entities";

export type RestoreEntityState = { ok: true } | { error: string };

const restoreEntitySchema = z.object({
  worldSlug: z.string().trim().min(1).max(200),
  entityId: z.guid(),
});

/**
 * « Rétablir » une fiche supprimée depuis le journal d'historique (V3.1-61).
 * Une action serveur plutôt que la route `/api/entities/[id]/restore` suivie
 * d'un `window.location.reload()` : `revalidatePath` sur la mise en page du
 * monde fait reparaître la fiche dans l'arborescence sans recharger la page
 * ni appeler `router.refresh()` (docs/CABLAGE.md, C5). Le droit se vérifie
 * dans `restoreDeletedEntity` (MJ du monde, RLS).
 */
export async function restoreEntityAction(worldSlug: string, entityId: string): Promise<RestoreEntityState> {
  const parsed = restoreEntitySchema.safeParse({ worldSlug, entityId });
  if (!parsed.success) return { error: "Demande invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const result = await restoreDeletedEntity(supabase, parsed.data.entityId);
  if (!result.restored) {
    if (result.error === "forbidden") return { error: "Vous n'avez pas le droit de rétablir cette fiche." };
    if (result.error === "slug_conflict") return { error: "Une autre fiche utilise déjà cette URL, impossible de rétablir." };
    return { error: "Fiche introuvable ou déjà rétablie." };
  }

  revalidatePath(`/m/${parsed.data.worldSlug}`, "layout");
  return { ok: true };
}
