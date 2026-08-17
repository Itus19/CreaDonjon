import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import type { ResolvedClass, ResolvedFeature, ResolvedRuleset } from "@/src/core/rules/sheet";
import {
  armorDataFromBlock,
  costFromQuantity,
  extractBackgroundFeat,
  extractFeatureKeysUpToLevel,
  extractLanguageChoice,
  extractLanguages,
  extractSkillChoices,
  extractSlotsByLevel,
  mapBackgroundModifiers,
  mapClassCore,
  mapClassSpellcastingAbility,
  mapPrerequisites,
  mapProficiencies,
  mapSpeciesModifiers,
  parseArmorData,
  parseCustomTableFields,
  parseItemCost,
  parseItemWeight,
  parseSpellLevel,
  parseWeaponData,
  SRD_LANGUAGES,
  weaponDataFromBlock,
  weightFromQuantity,
  type ArmorData,
  type CustomTableRow,
  type ItemCost,
  type ProgressionRow,
  type WeaponData,
} from "@/src/core/rules/srdMapping";
import type { ArmorBlockData, ItemPropertiesBlockData, WeaponBlockData } from "@/src/core/schemas/rule-blocks";
import {
  getEntryTranslation,
  listBlocksForRulesetEntry,
  listRulesetEntryChipsByKeys,
  listTranslationsForEntries,
  type RulesetEntryRow,
} from "@/src/server/repos/rules";
import { entryNameFrom, findEntryInRulesetChain, resolveEntryBlocksInRuleset } from "./rules";

type TypedClient = SupabaseClient<Database>;

export interface CreationSelection {
  species?: string;
  background?: string;
  classes: { key: string; level: number }[];
}

export interface RemainingChoice {
  /** Cle qualifiee par classe (ex. "fighter.skills"), meme convention que `character.choices` (§B2). */
  id: string;
  label: string;
  count: number;
  options: string[];
  /** Distingue le rendu cote client (V1-C7) : la liste de competences est fixe et deja affichee par ailleurs, la liste de langues ne l'est pas — deux listes de cases a cocher differentes, pas une seule generique. */
  kind: "skill" | "language";
}

/** Maitrise ou langue accordee, avec sa source pour affichage (onglet Traits, V1-C6) — pas de lien de regle dedie, voir docs/BACKLOG_V1.md V1-C6 (le SRD ne porte aucun texte descriptif pour ces deux categories). */
export interface TraitGrant {
  key: string;
  name: string;
  source: string;
}

export interface AssembledRuleset {
  ruleset: ResolvedRuleset;
  remainingChoices: RemainingChoice[];
  proficiencies: TraitGrant[];
  languages: TraitGrant[];
}

async function resolveEntryName(supabase: TypedClient, entry: RulesetEntryRow, locale: Locale): Promise<string> {
  if (locale === "en") return entryNameFrom(entry);
  const translation = await getEntryTranslation(supabase, entry.id, locale);
  return translation?.name ?? entryNameFrom(entry);
}

async function fetchEntryFields(
  supabase: TypedClient,
  rulesetId: string,
  key: string
): Promise<{ entry: RulesetEntryRow; fields: Record<string, unknown>; progressionRows: ProgressionRow[] } | null> {
  const entry = await findEntryInRulesetChain(supabase, rulesetId, key);
  if (!entry) return null;

  const blocks = await listBlocksForRulesetEntry(supabase, entry.id);
  const customTable = blocks.find((b) => b.block_type === "custom_table");
  const progression = blocks.find((b) => b.block_type === "class_progression");

  const fields = customTable
    ? parseCustomTableFields((customTable.data as unknown as { rows: CustomTableRow[] }).rows)
    : {};
  const progressionRows = progression
    ? ((progression.data as unknown as { rows: ProgressionRow[] }).rows ?? [])
    : [];

  return { entry, fields, progressionRows };
}

/**
 * Assemble un `ResolvedRuleset` (V1-B1) reel a partir des entrees SRD deja
 * importees (V1-A1/A2) — pas de jeu de donnees de demonstration : espece,
 * historique et classes sont lus depuis leurs blocs `custom_table`/
 * `class_progression` deja en base (V1-B4). Les cles de feature accordees
 * par la progression de classe sont incluses pour l'affichage (`features`),
 * meme sans modificateur propre — la plupart n'en ont pas dans ce ticket
 * (seuls espece/historique/choix de competences en produisent).
 */
export async function assembleResolvedRuleset(
  supabase: TypedClient,
  rulesetId: string,
  selection: CreationSelection,
  locale: Locale
): Promise<AssembledRuleset> {
  const features: Record<string, ResolvedFeature> = {};
  const classes: Record<string, ResolvedClass> = {};
  const remainingChoices: RemainingChoice[] = [];
  /** Cles de feature a resoudre en lot (aptitudes de classe + dons accordes, V1-C8), avec leur source pour affichage — Map plutot que Set depuis V1-C8 : toutes n'ont plus la meme source "class" litterale. */
  const extraFeatureKeys = new Map<string, string>();
  const proficiencies: TraitGrant[] = [];
  const languages: TraitGrant[] = [];

  if (selection.species) {
    const found = await fetchEntryFields(supabase, rulesetId, selection.species);
    if (found) {
      const label = await resolveEntryName(supabase, found.entry, locale);
      const key = `species:${selection.species}`;
      features[key] = { key, label, source: key, modifiers: mapSpeciesModifiers(found.fields, key, label) };
      proficiencies.push(...mapProficiencies(found.fields).map((p) => ({ ...p, source: label })));
      languages.push(...extractLanguages(found.fields).map((l) => ({ ...l, source: label })));
    }
  }

  if (selection.background) {
    const found = await fetchEntryFields(supabase, rulesetId, selection.background);
    if (found) {
      const label = await resolveEntryName(supabase, found.entry, locale);
      const key = `background:${selection.background}`;
      features[key] = { key, label, source: key, modifiers: mapBackgroundModifiers(found.fields, key, label) };
      proficiencies.push(...mapProficiencies(found.fields).map((p) => ({ ...p, source: label })));

      const languageChoice = extractLanguageChoice(found.fields);
      if (languageChoice) {
        remainingChoices.push({
          id: `${key}.languages`,
          label: `${label} — langues`,
          count: languageChoice.count,
          options: [...SRD_LANGUAGES],
          kind: "language",
        });
      }

      const featKey = extractBackgroundFeat(found.fields);
      if (featKey) extraFeatureKeys.set(featKey, key);
    }
  }

  for (const cl of selection.classes) {
    const found = await fetchEntryFields(supabase, rulesetId, cl.key);
    if (!found) continue;

    const label = await resolveEntryName(supabase, found.entry, locale);
    const core = mapClassCore(found.fields);
    const spellAbility = mapClassSpellcastingAbility(found.fields);
    const slotsByLevel = extractSlotsByLevel(found.progressionRows);

    classes[cl.key] = {
      key: cl.key,
      label,
      hitDie: core.hitDie,
      savingThrowProficiencies: core.savingThrowProficiencies,
      spellcasting: spellAbility ? { ability: spellAbility, slotsByLevel } : undefined,
    };

    proficiencies.push(...mapProficiencies(found.fields).map((p) => ({ ...p, source: label })));

    for (const fk of extractFeatureKeysUpToLevel(found.progressionRows, cl.level)) extraFeatureKeys.set(fk, `class:${cl.key}`);

    for (const choice of extractSkillChoices(found.fields)) {
      remainingChoices.push({
        id: `${cl.key}.skills`,
        label: `${label} — compétences`,
        count: choice.count,
        options: choice.options,
        kind: "skill",
      });
    }
  }

  if (extraFeatureKeys.size > 0) {
    const keys = [...extraFeatureKeys.keys()];
    const chips = await listRulesetEntryChipsByKeys(supabase, rulesetId, keys);
    const translationByEntryId = new Map<string, string>();
    if (locale !== "en" && chips.length > 0) {
      const translations = await listTranslationsForEntries(supabase, chips.map((c) => c.id), locale);
      for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
    }
    for (const chip of chips) {
      features[chip.entry_key] = {
        key: chip.entry_key,
        label: translationByEntryId.get(chip.id) ?? entryNameFrom(chip),
        source: extraFeatureKeys.get(chip.entry_key) ?? "class:inconnue",
        modifiers: [],
        prerequisites: mapPrerequisites(chip.source_raw),
      };
    }
    // Cle sans entree resolue (rare : feature non importee) — conservee
    // quand meme, label = cle brute, pour que build.featureKeys puisse la
    // referencer sans faire echouer characterSheet().
    for (const fk of keys) {
      if (!features[fk]) features[fk] = { key: fk, label: fk, source: extraFeatureKeys.get(fk) ?? "class:inconnue", modifiers: [] };
    }
  }

  return { ruleset: { classes, features }, remainingChoices, proficiencies, languages };
}

interface EquipmentBlocks {
  fields: Record<string, unknown>;
  weapon?: WeaponBlockData;
  armor?: ArmorBlockData;
  itemProperties?: ItemPropertiesBlockData;
}

/**
 * Blocs mecaniques d'un objet d'equipement, base + TOUTES les surcharges de
 * la chaine (`resolveEntryBlocksInRuleset`, V1-A4/V1-D4) — contrairement a
 * `fetchEntryFields` ci-dessus (espece/historique/classe, jamais surcharge-
 * aware, hors de portee de ce correctif), une fiche qui n'existe que par
 * une surcharge `add_entry` (aucune ligne `ruleset_entries`, arme maison
 * V1-D4) doit resoudre ici. `weapon`/`armor`/`itemProperties` : les blocs
 * dedies (V1-D1/V1-D2) quand ils existent — `fields` (`custom_table`) reste
 * le repli pour tout contenu qui n'en a pas (une fiche maison n'en ecrit
 * aucun, V1-D4 : `createHomebrewWeapon` ne pose qu'un bloc `weapon`).
 */
async function fetchEquipmentBlocks(supabase: TypedClient, rulesetId: string, key: string): Promise<EquipmentBlocks | null> {
  const resolved = await resolveEntryBlocksInRuleset(supabase, rulesetId, key);
  if (!resolved) return null;

  const customTable = resolved.blocksByType.get("custom_table") as { rows: CustomTableRow[] } | undefined;
  return {
    fields: customTable ? parseCustomTableFields(customTable.rows) : {},
    weapon: resolved.blocksByType.get("weapon") as WeaponBlockData | undefined,
    armor: resolved.blocksByType.get("armor") as ArmorBlockData | undefined,
    itemProperties: resolved.blocksByType.get("item_properties") as ItemPropertiesBlockData | undefined,
  };
}

/** Donnees mecaniques d'armure d'un objet d'equipement, par cle de regle — `null` si l'entree n'existe pas ou n'a pas de donnees d'armure (une arme, par exemple). */
export async function resolveEquipmentArmorData(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<Record<string, ArmorData | null>> {
  const result: Record<string, ArmorData | null> = {};
  for (const key of keys) {
    const found = await fetchEquipmentBlocks(supabase, rulesetId, key);
    result[key] = found ? (found.armor ? armorDataFromBlock(found.armor) : parseArmorData(found.fields)) : null;
  }
  return result;
}

/** Donnees mecaniques d'arme d'un objet d'equipement, par cle de regle — `null` si l'entree n'existe pas ou n'a pas de donnees d'arme (V1-B5, memes principes que resolveEquipmentArmorData). */
export async function resolveEquipmentWeaponData(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<Record<string, WeaponData | null>> {
  const result: Record<string, WeaponData | null> = {};
  for (const key of keys) {
    const found = await fetchEquipmentBlocks(supabase, rulesetId, key);
    result[key] = found ? (found.weapon ? weaponDataFromBlock(found.weapon) : parseWeaponData(found.fields)) : null;
  }
  return result;
}

/** Poids (en livres) d'un objet d'equipement, par cle de regle — `null` si l'entree n'existe pas ou n'a pas de poids renseigne (encombrement, V1-C4 suite). */
export async function resolveEquipmentWeight(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<Record<string, number | null>> {
  const result: Record<string, number | null> = {};
  for (const key of keys) {
    const found = await fetchEquipmentBlocks(supabase, rulesetId, key);
    const dedicated = found?.weapon?.weight ?? found?.armor?.weight ?? found?.itemProperties?.weight;
    result[key] = found ? (dedicated !== undefined ? weightFromQuantity(dedicated) : parseItemWeight(found.fields)) : null;
  }
  return result;
}

/** Cout d'un objet d'equipement, par cle de regle — `null` si l'entree n'existe pas ou n'a pas de cout renseigne (onglet Inventaire, V1-C11). */
export async function resolveEquipmentCost(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<Record<string, ItemCost | null>> {
  const result: Record<string, ItemCost | null> = {};
  for (const key of keys) {
    const found = await fetchEquipmentBlocks(supabase, rulesetId, key);
    const dedicated = found?.weapon?.cost ?? found?.armor?.cost ?? found?.itemProperties?.cost;
    result[key] = found ? (dedicated !== undefined ? costFromQuantity(dedicated) : parseItemCost(found.fields)) : null;
  }
  return result;
}

/** Niveau d'un sort connu, par cle de regle — `null` si l'entree n'existe pas ou n'a pas de niveau renseigne (tri Magie par niveau, V1-C6). */
export async function resolveSpellLevels(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<Record<string, number | null>> {
  const result: Record<string, number | null> = {};
  for (const key of keys) {
    const found = await fetchEntryFields(supabase, rulesetId, key);
    result[key] = found ? parseSpellLevel(found.fields) : null;
  }
  return result;
}
