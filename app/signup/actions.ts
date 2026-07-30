"use server";

import { createClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/auth/schemas";

export type ActionState = { error: string } | { success: true } | null;

export async function signup(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm?next=/`,
    },
  });
  if (error) {
    return { error: "Impossible de créer le compte." };
  }

  return { success: true };
}
