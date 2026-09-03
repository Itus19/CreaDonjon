import { z } from "zod";
import { BLOCK_TYPES, ENTRY_TYPES, zWeaponBlockData } from "@/src/core/schemas/rule-blocks";

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
  description: z.string().max(2000).optional(),
  weapon: zWeaponBlockData,
  note: z.string().min(1).max(500).optional(),
});

/** V1-F2 : description libre en francais, entree de l'editeur de regle assiste. */
export const proposeWeaponSchema = z.object({
  description: z.string().min(1).max(1000),
});

/**
 * Import JSON de regles (retour utilisateur, "regles actives") — meme forme
 * que specs/ruleset-personnel.md §1 (`entry_key`, `blocks[].block_type/data`) :
 * un fichier prepare a la main ou par un autre outil, jamais le format brut
 * du SRD (qui porte en plus `source_raw`/`refs`, reserves a l'import
 * officiel, `scripts/ingest-srd.ts`). `display` optionnel : un gabarit
 * label/layout par `block_type` comble l'absence (`DEFAULT_BLOCK_DISPLAY`,
 * `src/server/services/rules.ts`) — l'auteur d'un fichier n'a pas a
 * connaitre les six mises en page pour importer une premiere fois.
 * `data: unknown` ici : sa forme depend de `block_type`, verifiee bloc par
 * bloc cote service (`validateBlockData`), jamais a ce niveau générique.
 */
const zImportBlock = z.object({
  block_type: z.enum(BLOCK_TYPES),
  display: z
    .object({ label: z.string().min(1).optional(), layout: z.string().min(1).optional(), collapsed: z.boolean().optional() })
    .optional(),
  data: z.unknown(),
});

export const zImportEntry = z.object({
  // Autorise `_` (convention SRD, ex. "great_weapon_fighting") ET `-`
  // (convention `slugify()`, utilisee si absent) — jamais impose l'un ou
  // l'autre a un fichier ecrit a la main.
  entry_key: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_-]+$/, "La clé ne doit contenir que des minuscules, chiffres, tirets ou underscores.")
    .optional(),
  name: z.string().min(1).max(120),
  entry_type: z.enum(ENTRY_TYPES),
  blocks: z.array(zImportBlock).min(1).max(20),
  note: z.string().min(1).max(500).optional(),
});

export const importRulesetEntriesSchema = z.object({
  rulesetId: z.string().uuid(),
  // Un fichier a la fois (`accepte un objet OU un tableau`, cote route) —
  // borne haute large mais pas illimitee : un import reste une action
  // manuelle deliberee, pas un pipeline d'ingestion en masse.
  entries: z.array(zImportEntry).min(1).max(200),
});
export type ImportRulesetEntriesInput = z.infer<typeof importRulesetEntriesSchema>;

/**
 * Import "notre format" → nouveau ruleset personnel (V2-J4) — meme forme
 * `entries` que `importRulesetEntriesSchema` (c'est le vrai miroir de
 * l'export, `GET /api/rulesets/[rulesetId]/export`), mais cree une variante
 * `personal_reference` plutot que d'ajouter dans celle deja active.
 * `baseSystem` doit correspondre a un ruleset officiel existant, verifie
 * cote service (`getOfficialBaseRulesetId`), jamais ici.
 */
export const createRulesetFromImportSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(120, "120 caractères maximum."),
  baseSystem: z.string().trim().min(1, "Le système de base est requis."),
  entries: z.array(zImportEntry).min(1).max(200),
});
export type CreateRulesetFromImportInput = z.infer<typeof createRulesetFromImportSchema>;
