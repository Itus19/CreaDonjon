import { z } from "zod";

const campaignIdField = z.string().uuid().nullable();

export const weaponAttackSchema = z.object({
  campaignId: campaignIdField,
  itemId: z.string().min(1),
  advantage: z.enum(["normal", "advantage", "disadvantage"]),
});

export const weaponDamageSchema = z.object({
  campaignId: campaignIdField,
  itemId: z.string().min(1),
  critical: z.boolean(),
  versatile: z.boolean(),
});

export const castSpellSchema = z.object({
  campaignId: campaignIdField,
  spellKey: z.string().min(1),
  slotLevel: z.number().int().min(1).max(9),
});

export const shortRestSchema = z.object({
  campaignId: campaignIdField,
  hitDiceSpent: z.record(z.string().min(1), z.number().int().min(0)).default({}),
});

export const longRestSchema = z.object({
  campaignId: campaignIdField,
});

export const hpChangeSchema = z.object({
  campaignId: campaignIdField,
  delta: z.number().int(),
});

export const xpChangeSchema = z.object({
  campaignId: campaignIdField,
  delta: z.number().int().positive(),
});

export const resourceUsageSchema = z.object({
  campaignId: campaignIdField,
  trackerId: z.string().min(1),
  delta: z.number().int(),
});
