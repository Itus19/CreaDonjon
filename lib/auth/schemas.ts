import { z } from "zod";

// Minimum plus strict que celui configure sur le projet Supabase (6) : la
// validation Zod est toujours la contrainte qui s'applique en pratique
// puisqu'elle s'execute avant l'appel a Supabase.
const password = z.string().min(8, "8 caracteres minimum.");
const email = z.email("Adresse email invalide.");

export const loginSchema = z.object({ email, password: z.string().min(1, "Mot de passe requis.") });
export const signupSchema = z.object({ email, password });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ password });

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
