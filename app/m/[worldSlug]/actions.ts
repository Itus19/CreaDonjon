"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createEntitySchema } from "@/lib/entities/schemas";
import { createEntity } from "@/src/server/services/entities";

export type ActionState = { error: string } | null;

export async function createEntityAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createEntitySchema.safeParse({
    worldId: formData.get("worldId"),
    name: formData.get("name"),
    entityKind: formData.get("entityKind"),
    aliases: formData.get("aliases"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const worldSlug = formData.get("worldSlug");
  if (typeof worldSlug !== "string" || worldSlug === "") {
    return { error: "Formulaire invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Session expiree, reconnectez-vous." };
  }

  const entity = await createEntity(supabase, {
    worldId: parsed.data.worldId,
    createdBy: user.id,
    name: parsed.data.name,
    entityKind: parsed.data.entityKind,
    aliases: parsed.data.aliases,
  });

  revalidatePath(`/m/${worldSlug}`, "layout");
  redirect(`/m/${worldSlug}/f/${entity.slug}`);
}
