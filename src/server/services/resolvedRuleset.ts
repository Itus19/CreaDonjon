import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import type { ResolvedClass, ResolvedFeature, ResolvedRuleset } from "@/src/core/rules/sheet";
import {
  extractFeatureKeysUpToLevel,
  extractSkillChoices,
  extractSlotsByLevel,
  mapBackgroundModifiers,
  mapClassCore,
  mapClassSpellcastingAbility,
  mapSpeciesModifiers,
  parseArmorData,
  parseCustomTableFields,
  parseWeaponData,
  type ArmorData,
  type CustomTableRow,
  type ProgressionRow,
  type WeaponData,
} from "@/src/core/rules/srdMapping";
import {
  getEntryTranslation,
  listBlocksForRulesetEntry,
  listRulesetEntryChipsByKeys,
  listTranslationsForEntries,
  type RulesetEntryRow,
} from "@/src/server/repos/rules";
import { entryNameFrom, findEntryInRulesetChain } from "./rules";

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
}

export interface AssembledRuleset {
  ruleset: ResolvedRuleset;
  remainingChoices: RemainingChoice[];
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
  const classFeatureKeys = new Set<string>();

  if (selection.species) {
    const found = await fetchEntryFields(supabase, rulesetId, selection.species);
    if (found) {
      const label = await resolveEntryName(supabase, found.entry, locale);
      const key = `species:${selection.species}`;
      features[key] = { key, label, source: key, modifiers: mapSpeciesModifiers(found.fields, key, label) };
    }
  }

  if (selection.background) {
    const found = await fetchEntryFields(supabase, rulesetId, selection.background);
    if (found) {
      const label = await resolveEntryName(supabase, found.entry, locale);
      const key = `background:${selection.background}`;
      features[key] = { key, label, source: key, modifiers: mapBackgroundModifiers(found.fields, key, label) };
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

    for (const fk of extractFeatureKeysUpToLevel(found.progressionRows, cl.level)) classFeatureKeys.add(fk);

    for (const choice of extractSkillChoices(found.fields)) {
      remainingChoices.push({
        id: `${cl.key}.skills`,
        label: `${label} — compétences`,
        count: choice.count,
        options: choice.options,
      });
    }
  }

  if (classFeatureKeys.size > 0) {
    const keys = [...classFeatureKeys];
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
        source: "class",
        modifiers: [],
      };
    }
    // Cle sans entree resolue (rare : feature non importee) — conservee
    // quand meme, label = cle brute, pour que build.featureKeys puisse la
    // referencer sans faire echouer characterSheet().
    for (const fk of keys) {
      if (!features[fk]) features[fk] = { key: fk, label: fk, source: "class", modifiers: [] };
    }
  }

  return { ruleset: { classes, features }, remainingChoices };
}

/** Donnees mecaniques d'armure d'un objet d'equipement, par cle de regle — `null` si l'entree n'existe pas ou n'a pas de donnees d'armure (une arme, par exemple). */
export async function resolveEquipmentArmorData(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<Record<string, ArmorData | null>> {
  const result: Record<string, ArmorData | null> = {};
  for (const key of keys) {
    const found = await fetchEntryFields(supabase, rulesetId, key);
    result[key] = found ? parseArmorData(found.fields) : null;
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
    const found = await fetchEntryFields(supabase, rulesetId, key);
    result[key] = found ? parseWeaponData(found.fields) : null;
  }
  return result;
}
