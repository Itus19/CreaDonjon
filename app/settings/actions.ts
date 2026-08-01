"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setLocaleSchema, updateDisplayNameSchema, deleteAccountSchema } from "@/lib/settings/schemas";
import { updateOwnProfile, deleteOwnAccount } from "@/src/server/repos/account";

/** Cookie seul (comme "mode"), plus profiles.locale pour que la preference survive un changement de navigateur/appareil. */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const parsed = setLocaleSchema.safeParse({ locale: formData.get("locale") });
  if (!parsed.success) return;

  const cookieStore = await cookies();
  cookieStore.set("locale", parsed.data.locale, { path: "/", maxAge: 31536000 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await updateOwnProfile(supabase, user.id, { locale: parsed.data.locale });

  revalidatePath("/", "layout");
}

export type UpdateDisplayNameState = { error: string } | { ok: true } | null;

export async function updateDisplayNameAction(
  _prevState: UpdateDisplayNameState,
  formData: FormData,
): Promise<UpdateDisplayNameState> {
  const parsed = updateDisplayNameSchema.safeParse({ displayName: formData.get("displayName") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expiree, reconnectez-vous." };

  await updateOwnProfile(supabase, user.id, { displayName: parsed.data.displayName });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Suppression definitive (V1-A1b) : app.delete_own_account (security
 * definer) fait tout le travail cote base, y compris resoudre auth.uid()
 * sous ses propres privileges — voir la migration pour la portee exacte.
 * Le mot de confirmation est verifie ici en plus du texte affiche, pour
 * qu'un appel direct a cette action sans passer par le formulaire echoue
 * aussi silencieusement que possible plutot que de supprimer sans confirmation.
 */
export type DeleteAccountState = { error: string } | null;

export async function deleteAccountAction(
  _prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const parsed = deleteAccountSchema.safeParse({ confirmation: formData.get("confirmation") });
  if (!parsed.success) return { error: "confirmation" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  try {
    await deleteOwnAccount(supabase);
  } catch {
    return { error: "delete" };
  }

  await supabase.auth.signOut();
  redirect("/login");
}
