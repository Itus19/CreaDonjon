"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorldSchema } from "@/lib/worlds/schemas";
import { createWorldWithCampaign } from "@/src/server/services/worlds";

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
