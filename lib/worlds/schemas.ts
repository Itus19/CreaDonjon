import { z } from "zod";

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
