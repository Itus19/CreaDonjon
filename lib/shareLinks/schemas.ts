import { z } from "zod";

export const createShareLinkSchema = z.object({
  worldId: z.guid(),
  // Optionnel : "" (case vide du formulaire) et absent doivent tous deux
  // valoir "pas de mot de passe", jamais un mot de passe vide stocke.
  password: z
    .string()
    .trim()
    .min(4, "Le mot de passe doit faire au moins 4 caractères.")
    .optional()
    .or(z.literal("")),
});

export const revokeShareLinkSchema = z.object({
  id: z.guid(),
  worldId: z.guid(),
});
