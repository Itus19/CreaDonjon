import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { forgotPasswordByNameSchema } from "@/lib/auth/schemas";
import { voieReinitialisation } from "@/lib/auth/reinitialisation";
import { requestPasswordResetByName, sendPasswordResetEmail } from "@/src/server/repos/accountAuth";

type TypedClient = SupabaseClient<Database>;

/**
 * « Mot de passe oublié » en un seul champ (V3.1-85). Un email part par le
 * lien envoyé à l'adresse ; un nom dépose la demande lue par le MJ
 * (ADR 0031 §5). **Ne rend rien et ne lève jamais** : qu'un compte existe ou
 * non, que l'envoi réussisse ou échoue, l'appelant répond la même chose. Les
 * échecs sont journalisés, jamais renvoyés — une erreur visible dirait qu'il
 * s'est passé quelque chose de particulier pour ce nom ou cet email.
 */
export async function demanderReinitialisation(supabase: TypedClient, identifier: string, siteUrl: string): Promise<void> {
  try {
    if (voieReinitialisation(identifier) === "email") {
      const { error } = await sendPasswordResetEmail(supabase, identifier.trim(), `${siteUrl}/auth/confirm?next=/auth/reset-password`);
      if (error) console.error("Envoi du lien de réinitialisation impossible", error);
      return;
    }
    // Un nom hors des bornes d'un nom de compte (plus de 40 caractères) ne désigne personne : rien à déposer.
    if (forgotPasswordByNameSchema.safeParse({ handleName: identifier }).success) {
      await requestPasswordResetByName(supabase, identifier.trim());
    }
  } catch (erreur) {
    console.error("Demande de réinitialisation non déposée", erreur);
  }
}
