import { z } from "zod";
import { zAppIdentityInput } from "@/src/core/brand/identity";

export const transferRulesetSchema = z.object({
  newOwnerId: z.string().uuid(),
});

/**
 * V3.1-84 — formulaire « Identité de l'application » (superadmin). Le texte
 * suit `zAppIdentityInput` du noyau ; `logoAction` dit quoi faire du logo
 * téléversé (le fichier lui-même est contrôlé par le service : signature,
 * forme, taille).
 */
export const appIdentityFormSchema = zAppIdentityInput.extend({
  logoAction: z.enum(["keep", "remove", "upload"]),
});
