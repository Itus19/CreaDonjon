import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(100, "100 caractères maximum."),
  rulesetId: z.string().min(1),
  mode: z.enum(["campaign", "solo"]),
});

/** Mode modifiable apres creation (V2-G1 prepa, "un monde = une campagne") — seul le mode se change ici, jamais le ruleset ni le nom via cette route. */
export const updateCampaignSchema = z.object({
  mode: z.enum(["campaign", "solo"]),
});

/** Renommage depuis l'ecran de choix de monde (V2-M1, retour utilisateur) — ne change que `campaigns.name`. */
export const renameCampaignSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().trim().min(1, "Le nom est requis.").max(100, "100 caractères maximum."),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Adresse courriel invalide."),
  role: z.enum(["gm", "player"]),
});

export const assignCharacterSchema = z.object({
  entityId: z.string().min(1),
  userId: z.string().nullable(),
  isPc: z.boolean(),
});
