import { z } from "zod";
import { zWeaponBlockData } from "@/src/core/schemas/rule-blocks";

export const setActiveRulesetSchema = z.object({
  rulesetId: z.string().uuid(),
});

export const createRulesetVariantSchema = z.object({
  name: z.string().min(1).max(120),
  parentRulesetId: z.string().uuid(),
  // Jamais un content_origin brut depuis le client (specs/ruleset-personnel.md
  // §2) : un simple booleau, la seule chose que ce formulaire a jamais a
  // choisir — 'official_srd' n'est possible que par l'import SRD.
  personalReference: z.boolean().optional(),
});

export const createHomebrewWeaponSchema = z.object({
  rulesetId: z.string().uuid(),
  name: z.string().min(1).max(120),
  weapon: zWeaponBlockData,
  note: z.string().min(1).max(500).optional(),
});

/** V1-F2 : description libre en francais, entree de l'editeur de regle assiste. */
export const proposeWeaponSchema = z.object({
  description: z.string().min(1).max(1000),
});
