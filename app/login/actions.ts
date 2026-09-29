"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, tagSignupSchema, forgotPasswordByNameSchema } from "@/lib/auth/schemas";
import { resolveLoginEmails, requestPasswordResetByName } from "@/src/server/repos/accountAuth";
import { createTagAccount } from "@/src/server/services/accountAuth";

export type ActionState = { error: string } | null;

/**
 * Ecran de connexion unique (V3.1-10) : "identifier" essaie d'abord chaque
 * compte "tag" portant ce nom (`app.resolve_login_emails`, dans l'ordre de
 * creation), puis retombe sur le texte tape comme un email de compte
 * ordinaire — jamais de champ separe pour les deux familles de comptes.
 */
export async function login(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  const { identifier, password } = parsed.data;
  const supabase = await createClient();

  const candidateEmails = await resolveLoginEmails(supabase, identifier);
  for (const email of candidateEmails) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) redirect("/");
  }

  const { error } = await supabase.auth.signInWithPassword({ email: identifier, password });
  if (error) {
    return { error: "Nom, email ou mot de passe incorrect." };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Creation libre-service d'un compte "tag" (V3.1-10) : n'importe qui peut
 * en creer un sans invitation, il ne donne acces a aucun monde tant que
 * personne ne l'y invite ensuite. Mot de passe choisi ici meme, jamais de
 * lien magique — la session s'ouvre directement sur le mot de passe qui
 * vient d'etre choisi.
 */
export async function createAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = tagSignupSchema.safeParse({
    handleName: formData.get("handleName"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const result = await createTagAccount(parsed.data);
  if (!result.ok) {
    return { error: "Impossible de créer le compte, réessayez." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: result.email, password: parsed.data.password });
  if (error) {
    return { error: "Compte créé, mais la connexion a échoué — réessayez de vous connecter." };
  }

  redirect("/");
}

export type RequestResetByNameState = { error: string } | { success: true } | null;

/**
 * "Mot de passe oublié" pour un compte "tag" (V3.1-10, ADR 0031 §5) : ne
 * revele jamais si le nom correspond a un compte (meme discipline que
 * app/auth/forgot-password/actions.ts pour les comptes ordinaires), depose
 * seulement un horodatage lu par le panneau MJ/superadmin competent.
 */
export async function requestResetByName(
  _prevState: RequestResetByNameState,
  formData: FormData
): Promise<RequestResetByNameState> {
  const parsed = forgotPasswordByNameSchema.safeParse({ handleName: formData.get("handleName") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nom requis." };
  }

  const supabase = await createClient();
  await requestPasswordResetByName(supabase, parsed.data.handleName);
  return { success: true };
}
