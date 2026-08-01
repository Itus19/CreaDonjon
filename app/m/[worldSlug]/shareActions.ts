"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createShareLinkSchema, revokeShareLinkSchema } from "@/lib/shareLinks/schemas";
import { createShareLink, revokeShareLink } from "@/src/server/services/shareLinks";

export type CreateShareLinkState = { error: string } | { token: string } | null;

/**
 * useActionState (pas un simple <form action>) : le jeton en clair doit
 * s'afficher une seule fois juste apres la creation (il n'est jamais
 * stocke, SCHEMA.md §18) — une redirection classique le perdrait.
 */
export async function createShareLinkAction(
  _prevState: CreateShareLinkState,
  formData: FormData,
): Promise<CreateShareLinkState> {
  const parsed = createShareLinkSchema.safeParse({ worldId: formData.get("worldId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expiree, reconnectez-vous." };

  const { token } = await createShareLink(supabase, { worldId: parsed.data.worldId, createdBy: user.id });

  const worldSlug = formData.get("worldSlug");
  if (typeof worldSlug === "string" && worldSlug !== "") {
    revalidatePath(`/m/${worldSlug}`, "page");
  }

  return { token };
}

export async function revokeShareLinkAction(formData: FormData): Promise<void> {
  const parsed = revokeShareLinkSchema.safeParse({
    id: formData.get("id"),
    worldId: formData.get("worldId"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await revokeShareLink(supabase, parsed.data);

  const worldSlug = formData.get("worldSlug");
  if (typeof worldSlug === "string" && worldSlug !== "") {
    revalidatePath(`/m/${worldSlug}`, "page");
  }
}
