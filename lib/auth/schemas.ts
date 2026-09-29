import { z } from "zod";

// Minimum plus strict que celui configure sur le projet Supabase (6) : la
// validation Zod est toujours la contrainte qui s'applique en pratique
// puisqu'elle s'execute avant l'appel a Supabase.
const password = z.string().min(8, "8 caractères minimum.");
const email = z.email("Adresse email invalide.");

/**
 * Ecran de connexion unique (V3.1-10) : "identifier" est soit un nom de
 * compte "tag" (essaye d'abord), soit un email de compte ordinaire (repli)
 * — jamais deux champs distincts, la resolution se fait cote serveur
 * (`app.resolve_login_emails`). Meme regle pour la creation libre-service :
 * un nom affiche, pas un email, un compte "tag" n'en a jamais.
 */
const handleName = z.string().trim().min(1, "Nom requis.").max(40, "40 caractères maximum.");

export const loginSchema = z.object({ identifier: z.string().trim().min(1, "Nom ou email requis."), password: z.string().min(1, "Mot de passe requis.") });
export const signupSchema = z.object({ email, password });
export const tagSignupSchema = z.object({ handleName, password });
export const forgotPasswordSchema = z.object({ email });
export const forgotPasswordByNameSchema = z.object({ handleName });
export const resetPasswordSchema = z.object({ password });
export const consumeAccountResetTokenSchema = z.object({ token: z.string().min(1, "Jeton manquant."), password });

/**
 * "Voir comme" (audit B-05, ADR 0016). `uuid()` plutot que la simple
 * chaine non vide d'avant : la cible est toujours un `auth.users.id`, et
 * l'ecran n'envoie que des identifiants reels. Consequence assumee — une
 * valeur mal formee repond desormais 400 (entree invalide) la ou elle
 * repondait 404 (compte introuvable) apres un aller-retour en base inutile.
 */
export const viewAsSchema = z.object({
  targetUserId: z.string().uuid(),
});
