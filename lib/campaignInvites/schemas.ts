import { z } from "zod";

export const createCampaignInviteSchema = z.object({
  campaignId: z.string().min(1),
  // Role obligatoire depuis V3.1-10 : un lien joueur reutilisable et un
  // lien MJ nominatif ont des semantiques trop differentes (ADR 0031) pour
  // rester "au choix" — l'ancienne option laissait le VISITEUR trancher,
  // desormais c'est le MJ qui le fait a la creation.
  intendedRole: z.enum(["gm", "player"]),
  password: z.string().trim().max(200).optional().or(z.literal("")),
  // V3.1-100 : « pour : [PJ] » — un lien joueur nominatif. Jamais pour un lien MJ.
  entityId: z.string().uuid().optional(),
}).refine((value) => !value.entityId || value.intendedRole === "player", {
  message: "Seul un lien joueur peut viser un personnage.",
  path: ["entityId"],
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
  // Requis seulement pour un visiteur sans session deja ouverte (V3.1-10) :
  // un compte "tag" avec mot de passe se cree a cette occasion. Optionnel
  // ici, verifie cote action selon la presence d'une session.
  accountPassword: z.string().min(8, "8 caractères minimum.").optional(),
});

export const reopenCampaignInviteSchema = z.object({
  token: z.string().min(1),
});
