import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(100, "100 caractères maximum."),
  rulesetId: z.string().min(1),
  mode: z.enum(["campaign", "solo"]),
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
