"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createWorldSchema } from "@/lib/worlds/schemas";
import { createWorld } from "@/src/server/services/worlds";

export type ActionState = { error: string } | null;

export async function createWorldAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createWorldSchema.safeParse({ name: formData.get("name") });
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

  await createWorld(supabase, { ownerId: user.id, name: parsed.data.name });
  revalidatePath("/");
  return null;
}
