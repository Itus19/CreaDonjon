"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string } | null;

/**
 * Verifie le jeton uniquement sur une vraie action utilisateur (clic sur
 * le bouton, donc une requete POST) — jamais au chargement de la page.
 * Un jeton de confirmation est a usage unique ; si la verification se
 * declenchait des le GET initial, un scanner de liens automatique (Gmail,
 * antivirus, passerelle de messagerie d'entreprise) qui pre-visite le
 * lien avant l'utilisateur consommerait le jeton a sa place, et
 * l'utilisateur tomberait toujours sur "lien invalide" en cliquant.
 */
export async function confirmEmailLink(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const token_hash = formData.get("token_hash");
  const type = formData.get("type") as EmailOtpType | null;
  const next = (formData.get("next") as string | null) ?? "/";

  if (typeof token_hash !== "string" || !type) {
    redirect("/login?error=lien-invalide");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    redirect("/login?error=lien-invalide");
  }

  redirect(next);
}
