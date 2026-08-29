"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorldSchema, deleteWorldSchema, renameWorldSchema } from "@/lib/worlds/schemas";
import { createWorldWithCampaign, deleteWorldWithConfirmation, renameWorld } from "@/src/server/services/worlds";

export type ActionState = { error: string } | null;

/**
 * Un monde = une campagne (decision produit, prepa V2-G1 export/import) :
 * cree desormais le monde ET sa campagne unique en un seul passage
 * (ruleset + mode choisis a la creation), puis quitte l'ecran d'accueil
 * plutot que de simplement rafraichir la liste — en mode solo, direction
 * le createur de personnage (le mode solo lui-meme n'existe pas encore,
 * mais son point d'entree est deja le bon : `createCharacterFromWizardAction`
 * redirige ensuite vers la fiche du PJ cree).
 */
export async function createWorldAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createWorldSchema.safeParse({
    name: formData.get("name"),
    rulesetId: formData.get("rulesetId"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Session expiree, reconnectez-vous." };
  }

  const { world } = await createWorldWithCampaign(supabase, {
    ownerId: user.id,
    name: parsed.data.name,
    rulesetId: parsed.data.rulesetId,
    mode: parsed.data.mode,
  });
  revalidatePath("/");
  redirect(parsed.data.mode === "solo" ? `/m/${world.slug}/mj/creation-personnage` : `/m/${world.slug}`);
}

/** Renommage depuis l'ecran d'accueil (V2, retour utilisateur). */
export type RenameWorldState = { error: string } | { ok: true } | null;

export async function renameWorldAction(
  _prevState: RenameWorldState,
  formData: FormData
): Promise<RenameWorldState> {
  const parsed = renameWorldSchema.safeParse({
    worldId: formData.get("worldId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expiree, reconnectez-vous." };

  const { updated, error } = await renameWorld(supabase, {
    worldId: parsed.data.worldId,
    userId: user.id,
    name: parsed.data.name,
  });
  if (!updated) {
    return {
      error:
        error === "forbidden"
          ? "Seul le proprietaire du monde peut le renommer."
          : "Impossible de renommer ce monde.",
    };
  }
  revalidatePath("/");
  return { ok: true };
}

/**
 * Suppression definitive depuis l'ecran d'accueil (V2, retour utilisateur) :
 * pas de redirection, `worlds.map` (app/page.tsx) n'inclut simplement plus
 * ce monde une fois `revalidatePath("/")` applique — la carte disparait
 * d'elle-meme.
 */
export type DeleteWorldState = { error: string } | null;

export async function deleteWorldAction(
  _prevState: DeleteWorldState,
  formData: FormData
): Promise<DeleteWorldState> {
  const parsed = deleteWorldSchema.safeParse({
    worldId: formData.get("worldId"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expiree, reconnectez-vous." };

  const { deleted, error } = await deleteWorldWithConfirmation(supabase, {
    worldId: parsed.data.worldId,
    userId: user.id,
    confirmation: parsed.data.confirmation,
  });
  if (!deleted) {
    if (error === "forbidden") return { error: "Seul le proprietaire du monde peut le supprimer." };
    if (error === "mismatch") return { error: "Le nom saisi ne correspond pas." };
    return { error: "Impossible de supprimer ce monde." };
  }
  revalidatePath("/");
  return null;
}
