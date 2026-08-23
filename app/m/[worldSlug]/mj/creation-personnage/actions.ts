"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createCharacterFromWizardSchema } from "@/lib/characterCreator/schemas";
import { createCharacterFromWizard } from "@/src/server/services/characterCreator";

export interface CreateCharacterFromWizardInput {
  worldId: string;
  name: string;
  character: unknown;
  inventory?: unknown;
}

/**
 * Cree le personnage compose par l'assistant (V2-G1, ecran MJ) et redirige
 * vers sa fiche. Appelee directement comme une fonction depuis le client
 * (pas un `<form action>`) : la donnee est un objet compose sur plusieurs
 * etapes, pas des champs de formulaire — meme mecanisme Next.js, juste un
 * autre point d'entree que `createBlankEntityAction`.
 */
export async function createCharacterFromWizardAction(
  worldSlug: string,
  input: CreateCharacterFromWizardInput
): Promise<{ error: string } | void> {
  const parsed = createCharacterFromWizardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Donnees invalides." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Non authentifie." };
  }

  const entity = await createCharacterFromWizard(supabase, {
    worldId: parsed.data.worldId,
    createdBy: user.id,
    name: parsed.data.name,
    character: parsed.data.character,
    inventory: parsed.data.inventory,
  });

  revalidatePath(`/m/${worldSlug}`, "layout");
  redirect(`/m/${worldSlug}/f/${entity.slug}`);
}
