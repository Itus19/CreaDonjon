"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consumeAccountResetTokenSchema } from "@/lib/auth/schemas";
import { consumeResetToken } from "@/src/server/services/accountAuth";

export type ActionState = { error: string } | null;

export async function submitNewPassword(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = consumeAccountResetTokenSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const result = await consumeResetToken({ token: parsed.data.token, newPassword: parsed.data.password });
  if (!result.ok) {
    return { error: "Ce lien n'est plus valide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: result.email, password: parsed.data.password });
  if (error) {
    return { error: "Mot de passe changé, mais la connexion a échoué — connecte-toi depuis /login." };
  }

  redirect("/");
}
