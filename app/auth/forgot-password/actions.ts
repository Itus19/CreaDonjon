"use server";

import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/auth/schemas";

export type ActionState = { error: string } | { success: true } | null;

// Message et comportement identiques que l'adresse existe ou non : ne
// jamais reveler l'existence d'un compte (V0-01, critere d'acceptation).
const NEUTRAL_SUCCESS: ActionState = { success: true };

export async function requestPasswordReset(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // resetPasswordForEmail ne revele deja pas si l'adresse existe (Supabase
  // renvoie succes dans les deux cas) ; on ignore aussi son eventuelle
  // erreur pour ne jamais faire varier la reponse selon l'adresse saisie.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/auth/reset-password`,
  });

  return NEUTRAL_SUCCESS;
}
