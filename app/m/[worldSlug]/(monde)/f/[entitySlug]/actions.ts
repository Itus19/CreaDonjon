"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { overwriteCharacterFromWizardSchema } from "@/lib/characterCreator/schemas";
import { overwriteCharacterFromWizard } from "@/src/server/services/characterCreator";

export interface OverwriteCharacterFromWizardInput {
  entityId: string;
  expectedVersion: number;
  name: string;
  character: unknown;
  inventory?: unknown;
  spellcasting?: unknown;
}

/**
 * Ecrase l'entite courante avec le personnage compose par l'assistant
 * (retour utilisateur : "Assistant de creation" lance depuis une fiche
 * existante) — jamais de redirection, contrairement a
 * `createCharacterFromWizardAction` : l'entite et son URL (slug) ne
 * changent jamais, seuls son nom et ses blocs sont mis a jour. Appelee
 * directement comme une fonction depuis `CharacterCreatorWizard.tsx`, meme
 * motif que `createCharacterFromWizardAction`.
 */
export async function overwriteCharacterFromWizardAction(
  worldSlug: string,
  input: OverwriteCharacterFromWizardInput
): Promise<{ error: string } | { ok: true; name: string; version: number }> {
  const parsed = overwriteCharacterFromWizardSchema.safeParse(input);
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

  const result = await overwriteCharacterFromWizard(supabase, {
    entityId: parsed.data.entityId,
    expectedVersion: parsed.data.expectedVersion,
    changedBy: user.id,
    name: parsed.data.name,
    character: parsed.data.character,
    inventory: parsed.data.inventory,
    spellcasting: parsed.data.spellcasting,
  });

  if (!result.ok) {
    const messages = {
      conflict: "Cette fiche a été modifiée entre-temps. Rechargez la page avant de réessayer.",
      forbidden: "Vous n'avez pas le droit de modifier cette fiche.",
      not_found: "Fiche introuvable.",
    };
    return { error: messages[result.reason] };
  }

  revalidatePath(`/m/${worldSlug}`, "layout");
  return { ok: true, name: result.entity.name, version: result.entity.version };
}
