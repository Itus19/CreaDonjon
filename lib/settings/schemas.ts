import { z } from "zod";
import { SUPPORTED_LOCALES } from "@/src/i18n/request";

export const setLocaleSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
});

export const updateDisplayNameSchema = z.object({
  displayName: z.string().trim().max(80),
});

export const deleteAccountSchema = z.object({
  confirmation: z.literal("SUPPRIMER").or(z.literal("DELETE")),
});
