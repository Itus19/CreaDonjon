"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createBlankEntitySchema } from "@/lib/entities/schemas";
import { createEntity } from "@/src/server/services/entities";

/**
 * Cree une fiche vierge et y redirige immediatement (V0-06g) : pas d'ecran
 * de creation separe a remplir avant de voir quoi que ce soit — le nom,
 * le type et les alias se choisissent en place sur la fiche elle-meme,
 * exactement comme toute autre modification.
 */
export async function createBlankEntityAction(formData: FormData): Promise<void> {
  const parsed = createBlankEntitySchema.safeParse({
    worldId: formData.get("worldId"),
  });
  if (!parsed.success) return;

  const worldSlug = formData.get("worldSlug");
  if (typeof worldSlug !== "string" || worldSlug === "") return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const entity = await createEntity(supabase, {
    worldId: parsed.data.worldId,
    createdBy: user.id,
    name: "",
    entityKind: "other",
    aliases: [],
  });

  revalidatePath(`/m/${worldSlug}`, "layout");
  redirect(`/m/${worldSlug}/f/${entity.slug}`);
}
