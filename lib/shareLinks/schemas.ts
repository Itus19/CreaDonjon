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
  // Optionnel (retour utilisateur, V2-M7 suite : "pouvoir personnaliser le
  // lien du wiki public") — vide retombe sur l'alias auto-genere a partir
  // du nom de campagne (`generateUniqueShareSlug`). Format strict plutot
  // qu'un slugify silencieux : l'utilisateur choisit exactement l'URL
  // qu'il va partager, jamais une transformation surprise.
  customSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Minuscules, chiffres et tirets uniquement (jamais au début/à la fin).")
    .min(3, "Trois caractères minimum.")
    .max(60, "Soixante caractères maximum.")
    .optional()
    .or(z.literal("")),
});

export const revokeShareLinkSchema = z.object({
  id: z.guid(),
  worldId: z.guid(),
});
