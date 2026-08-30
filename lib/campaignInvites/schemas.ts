import { z } from "zod";

export const createCampaignInviteSchema = z.object({
  campaignId: z.string().min(1),
  intendedRole: z.enum(["gm", "player"]).nullable(),
  password: z.string().trim().max(200).optional().or(z.literal("")),
});

export const setCampaignInvitePasswordSchema = z.object({
  inviteId: z.string().min(1),
  // "" (champ vide) efface le mot de passe — jamais une chaine vide stockee.
  password: z.string().trim().max(200).optional().or(z.literal("")),
});

export const verifyCampaignInvitePasswordSchema = z.object({
  password: z.string().min(1),
});

export const joinCampaignInviteSchema = z.object({
  token: z.string().min(1),
  role: z.enum(["gm", "player"]),
  name: z.string().trim().min(1, "Le nom est requis.").max(80, "80 caractères maximum."),
  entityId: z.string().min(1).optional(),
});

export const reopenCampaignInviteSchema = z.object({
  token: z.string().min(1),
});
