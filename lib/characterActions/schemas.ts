import { z } from "zod";
import { zCharacterBlockData } from "@/src/core/schemas/blocks/character";
import { zSpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";

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
  // 0 = sort mineur (retour utilisateur, V2-G1 suite) : ne consomme jamais
  // d'emplacement (regle 2024), distinct des niveaux 1-9 qui en consomment un.
  slotLevel: z.number().int().min(0).max(9),
  // Vient du jet d'attaque de sort precedent (`spellAttackSchema` ci-dessous),
  // meme motif que `weaponDamageSchema.critical` — l'appelant le sait deja,
  // jamais recalcule ici.
  critical: z.boolean().default(false),
});

export const spellAttackSchema = z.object({
  campaignId: campaignIdField,
  spellKey: z.string().min(1),
  advantage: z.enum(["normal", "advantage", "disadvantage"]),
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

/** `delta` accepte les deltas negatifs depuis V1-C4 suite (correction manuelle d'une erreur de saisie) — le clampage a 0 minimum reste cote serveur (`changeXp`, characterActions.ts), jamais de XP negative persistee. */
export const xpChangeSchema = z.object({
  campaignId: campaignIdField,
  delta: z.number().int(),
});

/** Clampe a [0, 6] cote serveur (`changeExhaustion`, characterActions.ts) — meme borne que `zRuntimeState.exhaustion`. */
export const exhaustionChangeSchema = z.object({
  campaignId: campaignIdField,
  delta: z.number().int(),
});

export const resourceUsageSchema = z.object({
  campaignId: campaignIdField,
  trackerId: z.string().min(1),
  delta: z.number().int(),
});

/** Montee de niveau accompagnee (V2-G1) — validation de forme seulement, les regles metier (niveaux qui ne peuvent que monter, plafond d'ASI, seuil de PX) vivent dans `applyLevelUp` (characterActions.ts), pas ici. */
export const applyLevelUpSchema = z.object({
  campaignId: campaignIdField,
  expectedVersion: z.number().int().nonnegative(),
  character: zCharacterBlockData,
  spellcasting: zSpellcastingBlockData.optional(),
  // Une INTENTION par nouveau niveau gagne, par classe (V2-G1) — jamais une
  // valeur de PV : le jet reel se fait cote serveur (CLAUDE.md regle 6).
  hpChoices: z.record(z.string(), z.array(z.enum(["average", "rolled"]))).default({}),
});
