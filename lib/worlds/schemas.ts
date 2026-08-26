import { z } from "zod";
import { zWorldExport } from "@/src/core/schemas/worldExport";

/**
 * Un monde = une campagne (decision produit, prepa V2-G1 export/import) :
 * la creation d'un monde choisit desormais aussi son ruleset et son mode
 * de jeu, plutot que de laisser le monde sans campagne jusqu'a un second
 * passage par `CampaignsPanel.tsx` (qui ne sait plus creer de campagne,
 * seule celle-ci existe).
 */
export const createWorldSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(100, "100 caracteres maximum."),
  rulesetId: z.string().uuid("Choisissez un ruleset."),
  mode: z.enum(["campaign", "solo"]),
});

/** Import de monde (V2-G1, dernier point) : mode choisi par la personne qui importe, jamais impose par le fichier — meme logique qu'a la creation. */
export const importWorldSchema = z.object({
  mode: z.enum(["campaign", "solo"]),
  data: zWorldExport,
});

export const updateWikiWelcomeMessageSchema = z.object({
  worldId: z.guid(),
  // "" (champ vide du formulaire) efface la personnalisation — l'appelant
  // retombe alors sur le message calcule (nom de la campagne), jamais une
  // chaine vide stockee.
  message: z.string().trim().max(500, "500 caractères maximum.").optional().or(z.literal("")),
});
