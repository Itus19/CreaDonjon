import { z } from "zod";
import { zCharacterBlockData } from "@/src/core/schemas/blocks/character";
import { zSpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import { ABILITIES, SKILLS, type Ability, type Skill } from "@/src/core/rules/sheet";

const campaignIdField = z.string().uuid().nullable();

// V2-M11 (volet de lancer de des) : `dc` vide (pas de DD) -> null, jamais de
// mention reussite/echec (retour utilisateur). `hidden` est l'intention du
// client, toujours reclampee cote serveur a `isWorldAdmin` (checkRolls.ts).
const abilityField = z.enum(ABILITIES as [Ability, ...Ability[]]);
const skillField = z.enum(SKILLS as [Skill, ...Skill[]]);
const advantageField = z.enum(["normal", "advantage", "disadvantage"]);
const dcField = z.number().int().min(1).max(50).nullable();

export const abilityCheckSchema = z.object({
  campaignId: campaignIdField,
  ability: abilityField,
  advantage: advantageField,
  dc: dcField,
  hidden: z.boolean(),
});

export const skillCheckSchema = z.object({
  campaignId: campaignIdField,
  skill: skillField,
  advantage: advantageField,
  dc: dcField,
  hidden: z.boolean(),
});

export const savingThrowSchema = z.object({
  campaignId: campaignIdField,
  ability: abilityField,
  advantage: advantageField,
  dc: dcField,
  hidden: z.boolean(),
});

export const initiativeCheckSchema = z.object({
  campaignId: campaignIdField,
  advantage: advantageField,
  dc: dcField,
  hidden: z.boolean(),
});

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

/** V3.1-32 — jet contre la mort : sans `natural`, le serveur lance ; avec, le joueur annonce son vrai d20. */
export const deathSaveSchema = z.object({
  campaignId: campaignIdField,
  natural: z.number().int().min(1).max(20).nullable().default(null),
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

/** V2.1-26 : meme forme que l'epuisement, clampe a [0, 5] cote serveur (`changeInspiration`). */
export const inspirationChangeSchema = z.object({
  campaignId: campaignIdField,
  delta: z.number().int(),
});

/** V3.1-24 : PV temporaires donnes. `choice` : garder les anciens, prendre les nouveaux, ou le plus grand (défaut de l'interface). */
export const tempHpChangeSchema = z.object({
  campaignId: campaignIdField,
  amount: z.number().int().min(0).max(1000),
  choice: z.enum(["keep", "replace", "largest"]).default("largest"),
});

const coinDeltaField = z.number().int().min(-1_000_000).max(1_000_000).optional();

/** V3.1-24 : variation du porte-monnaie, par pièce (positif = dépôt, négatif = dépense). Le serveur applique `depositCoins` / `spendCoins`. */
export const currencyChangeSchema = z.object({
  campaignId: campaignIdField,
  delta: z
    .object({ pp: coinDeltaField, gp: coinDeltaField, ep: coinDeltaField, sp: coinDeltaField, cp: coinDeltaField })
    .strict()
    .refine((d) => Object.values(d).some((v) => v !== undefined && v !== 0), { message: "Aucune pièce à ajouter ou à retirer." }),
});

/** V3.1-24 : équiper ou déséquiper un objet de l'inventaire. */
export const equipItemSchema = z.object({
  campaignId: campaignIdField,
  itemId: z.string().min(1),
  equipped: z.boolean(),
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
  // V3.1-115 : le MJ passe outre un prerequis de multiclassage non rempli. Une
  // INTENTION : le serveur la reclampe a `isWorldAdmin`, jamais fiee au client.
  overrideMulticlassPrerequisites: z.boolean().default(false),
});
