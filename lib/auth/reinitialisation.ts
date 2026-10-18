import { z } from "zod";

/**
 * « Mot de passe oublié » en un seul champ (V3.1-85) : « Ton nom ou ton
 * email ». Un email valide part par le lien envoyé à l'adresse (compte
 * ordinaire) ; tout le reste est un nom de compte « tag », dont la demande
 * va au MJ (ADR 0031 §5). On ne devine jamais un email : « Ana@ » reste un nom.
 */
export const requestResetSchema = z.object({
  identifier: z.string().trim().min(1, "Ton nom ou ton email.").max(254, "254 caractères maximum."),
});

export function voieReinitialisation(identifier: string): "email" | "nom" {
  return z.email().safeParse(identifier.trim()).success ? "email" : "nom";
}
