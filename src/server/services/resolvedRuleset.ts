import "server-only";
import { zCharacterRulesBlockData, type CharacterRules, type MulticlassPrerequisites } from "@/src/core/schemas/rule-blocks/characterRules";
import { zClassBasicsBlockData, zModifiersBlockData, zSubclassFeaturesBlockData } from "@/src/core/schemas/rule-blocks/blocks";
import { subclassFeatures, type SubclassFeatureData } from "@/src/core/rules/subclass";
import { zChoicesBlockData, type ChoiceGrant, type ChoicesBlockData } from "@/src/core/schemas/rule-blocks/choices";
import { resolveChoices, simpleGrantChoices, type ChoiceSource, type FeatChoiceData, type ResolvedChoices, type SpellMeta } from "@/src/core/rules/choices";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import {
  ABILITIES,
  layerForFeatureSource,
  resolveDeclaredModifiers,
  type Ability,
  type DeclaredModifier,
  type ResolvedClass,
  type ResolvedFeature,
  type ResolvedRuleset,
} from "@/src/core/rules/sheet";
import {
  armorDataFromBlock,
  backgroundFeatKeyFromBlock,
  backgroundModifiersFromBlock,
  costFromQuantity,
  extractAsiGrantedLevels,
  extractBackgroundAbilityScores,
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
  parseSpellClasses,
  parseSpellLevel,
  parseWeaponData,
  SRD_LANGUAGES,
  weaponDataFromBlock,
  weightFromQuantity,
  type ArmorData,
  type CustomTableRow,
  type ItemCost,
  type LanguageKey,
  type ProgressionRow,
  type WeaponData,
} from "@/src/core/rules/srdMapping";
import type { ArmorBlockData, BackgroundBlockData, ItemPropertiesBlockData, WeaponBlockData } from "@/src/core/schemas/rule-blocks";
import {
  listFeatKeysByCategory,
  listBlocksForRulesetEntries,
  listEntryTranslationsWithBlocks,
  listRulesetEntries,
  listRulesetEntriesByKeys,
  listRulesetEntryChipsByKeys,
  listTranslationsForEntries,
} from "@/src/server/repos/rules";
import { entryNameFrom, resolveEntryBlocksInRuleset, resolveEntryBlocksInRulesetBatch, walkRulesetChain } from "./rules";
import { LANGUAGE_LABELS_FR, WEAPON_ARMOR_PROFICIENCY_LABELS_FR } from "@/src/i18n/fr";
import {
  backgroundAbilityBonusModifiers,
  isValidBackgroundAbilityBonusChoice,
  parseBackgroundAbilityBonusChoice,
} from "@/src/core/rules/backgroundAbilityBonus";

type TypedClient = SupabaseClient<Database>;

export interface CreationSelection {
  species?: string;
  background?: string;
  /** V3.1-117 : `subclass`, clé de la sous-classe choisie. */
  classes: { key: string; level: number; subclass?: string }[];
  /** `character.choices` (V2-G7) — seul `"background.ability_bonus"` est lu ici aujourd'hui ; les autres cles (ASI, competences restantes) restent resolues ailleurs (`characterActions.ts`/`useCharacterSheetContext.ts`), jamais dupliquees ici. */
  choices?: Record<string, unknown>;
}

export interface RemainingChoice {
  /** Cle qualifiee par classe (ex. "fighter.skills"), meme convention que `character.choices` (§B2). */
  id: string;
  label: string;
  count: number;
  options: string[];
  /** Distingue le rendu cote client (V1-C7) : la liste de competences est fixe et deja affichee par ailleurs, la liste de langues ne l'est pas — deux listes de cases a cocher differentes, pas une seule generique. */
  kind: "skill" | "language" | "weapon_mastery";
  /** V3.1-49 : l'étape de création qui fait naître ce choix (« character » : les langues du personnage, sous Identité). */
  origin: "species" | "class" | "background" | "character";
}

/**
 * Nombre d'armes maitrisees et restriction "corps a corps seulement",
 * lus UNIFORMEMENT dans `class_progression` pour les cinq classes
 * concernees (colonnes `class_specific_weapon_mastery`/
 * `class_specific_weapon_mastery_melee_only`) — Barbare/Guerrier ont le
 * nombre nativement du SRD (il augmente avec le niveau) et le Barbare seul
 * porte la restriction corps-a-corps (son texte de feature "Weapon Mastery"
 * la restreint specifiquement, alors qu'il reste maitre des armes a
 * distance en general) ; Paladin/Rodeur/Roublard n'ont jamais le nombre
 * nativement (leur texte de feature ne tabule aucune progression, toujours
 * "deux"). Les deux trous sont desormais injectes a l'import
 * (`scripts/ingest-srd.ts`, `classProgressionBlock`) plutot que codes en
 * dur ici — un seul chemin de lecture pour les cinq classes, aucun
 * special-case par classe cote serveur.
 */
function weaponMasteryCount(progressionRows: ProgressionRow[], level: number): number {
  const row = progressionRows.find((r) => r.level === level);
  const value = row?.class_specific_weapon_mastery;
  return typeof value === "number" ? value : 0;
}

function weaponMasteryMeleeOnly(progressionRows: ProgressionRow[], level: number): boolean {
  const row = progressionRows.find((r) => r.level === level);
  return row?.class_specific_weapon_mastery_melee_only === true;
}

/**
 * Armes eligibles a la maitrise pour une classe, a partir de ses VRAIES
 * maitrises d'armes (`mapProficiencies`, jamais une liste recopiee a la
 * main). "simple-weapons"/"martial-weapons" couvrent une categorie entiere ;
 * une maitrise nommee (ex. "longswords", Roublard) desingularise vers la cle
 * de la fiche d'arme correspondante ("longsword") — les noms d'armes du SRD
 * ne portent jamais d'exception de pluriel irreguliere, verifie contre les
 * six cas reels (Roublard).
 */
function weaponMasteryOptions(
  proficiencyKeys: string[],
  pool: Map<string, { category: "simple" | "martial"; isRanged: boolean }>,
  meleeOnly: boolean
): string[] {
  const categories = new Set<"simple" | "martial">();
  const specific = new Set<string>();
  for (const key of proficiencyKeys) {
    if (key === "simple-weapons") categories.add("simple");
    else if (key === "martial-weapons") categories.add("martial");
    else {
      const singular = key.replace(/s$/, "");
      if (pool.has(singular)) specific.add(singular);
    }
  }
  const options: string[] = [];
  for (const [key, data] of pool) {
    if (meleeOnly && data.isRanged) continue;
    if (categories.has(data.category) || specific.has(key)) options.push(key);
  }
  return options;
}

/**
 * Toutes les armes de la chaine de ruleset avec leur categorie/portee (une
 * seule fois par assemblage, jamais par classe) — memes principes que
 * `fetchEntriesBatch` (surcharge la plus proche gagne), mais un SCAN complet
 * du type "weapon" plutot qu'un lot de cles precises : necessaire ici, la
 * liste des armes eligibles n'est jamais connue a l'avance.
 */
async function fetchWeaponPool(
  supabase: TypedClient,
  rulesetId: string
): Promise<Map<string, { category: "simple" | "martial"; isRanged: boolean }>> {
  const chain = await walkRulesetChain(supabase, rulesetId);
  const result = new Map<string, { category: "simple" | "martial"; isRanged: boolean }>();
  for (const link of chain) {
    const entries = await listRulesetEntries(supabase, link.rulesetId, { entryTypes: ["weapon"] });
    const weaponEntries = entries.filter((e) => !result.has(e.entry_key));
    if (weaponEntries.length === 0) continue;
    const blockRows = await listBlocksForRulesetEntries(supabase, weaponEntries.map((e) => e.id));
    const dataByEntryId = new Map(blockRows.filter((r) => r.block_type === "weapon").map((r) => [r.entry_id, r.data as WeaponBlockData]));
    for (const e of weaponEntries) {
      const data = dataByEntryId.get(e.id);
      if (data) result.set(e.entry_key, { category: data.category, isRanged: data.is_ranged });
    }
  }
  return result;
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
  /** Niveaux ou chaque classe accorde une amelioration de caracteristique (V2-G1, montee de niveau accompagnee) — jamais code en dur, lu dans `progressionRows` (`extractAsiGrantedLevels`). */
  asiGrantedLevels: Record<string, number[]>;
  /** Les trois caracteristiques de l'historique choisi (V2-G7, bonus +2/+1) — `null` si aucun historique choisi ou si sa fiche n'en porte aucune (ex. historique SRD 2014). Les DEUX chemins de lecture du bloc historique (SRD `fields`/fiche dediee) l'alimentent, meme source que le don accorde/les competences juste au-dessus. */
  backgroundAbilityScores: Ability[] | null;
  /** V3.1-116 (ADR 0046) : les fiches du personnage qui portent des choix (bloc `choices`), à résoudre avec ses réponses par `resolveChoices`. */
  choiceSources: ChoiceSource[];
  /** Réponses imposées par une fiche à un choix d'une autre (Acolyte → liste du clerc). */
  choicePresets: Record<string, string[]>;
  /** Les dons qu'un choix `feat` de ces fiches peut désigner. Vide s'il n'y en a aucun. */
  featCatalog: Record<string, FeatChoiceData>;
}

interface BatchEntry {
  name: string;
  fields: Record<string, unknown>;
  progressionRows: ProgressionRow[];
  /** Present uniquement pour une fiche maison resolue via le repli ci-dessous (bloc dedie `background`, jamais de `custom_table`). */
  backgroundBlock?: BackgroundBlockData;
  /** Cles des fiches de traits d'une espece (bloc `species_traits`, V3.1-4) — vide pour toute autre fiche. */
  traitKeys: string[];
  /** Modificateurs declares par la fiche (bloc `modifiers`). Lus pour les traits d'espece (V3.1-121, Ténacité naine) ; vide si la fiche n'en porte pas. */
  modifiers: DeclaredModifier[];
  /** V3.1-115 : prérequis de multiclassage et caractéristiques suggérées (bloc `class_basics`) — absents pour toute autre fiche. */
  multiclassPrerequisites?: MulticlassPrerequisites;
  suggestedAbilities?: Ability[];
  /** V3.1-113 : magie de pacte et poids dans la table du multiclassé (bloc `class_basics`). */
  spellcastingKind?: "slots" | "pact";
  casterWeight?: { fraction: "full" | "half"; rounding: "up" | "down" };
  /** V3.1-116 : le bloc `choices` de la fiche, s'il en porte un. */
  choices?: ChoicesBlockData;
  /** V3.1-117 : les aptitudes d'une fiche de sous-classe (bloc `subclass_features`). */
  subclassFeatures?: SubclassFeatureData[];
}

/** Bloc `subclass_features`, validé. Mal formé : ignoré mais journalisé. */
function parseSubclassFeatures(data: unknown): SubclassFeatureData[] | undefined {
  if (data === undefined || data === null) return undefined;
  const parsed = zSubclassFeaturesBlockData.safeParse(data);
  if (!parsed.success) {
    console.error("Bloc subclass_features mal forme, ignore", parsed.error.issues);
    return undefined;
  }
  return parsed.data.features;
}

/** Bloc `choices`, validé. Mal formé : ignoré mais journalisé, comme `declaredModifiers`. */
function parseChoicesBlock(data: unknown): ChoicesBlockData | undefined {
  if (data === undefined || data === null) return undefined;
  const parsed = zChoicesBlockData.safeParse(data);
  if (!parsed.success) {
    console.error("Bloc choices mal forme, ignore", parsed.error.issues);
    return undefined;
  }
  return parsed.data;
}

/**
 * Prérequis de multiclassage et caractéristiques suggérées du bloc
 * `class_basics` (V3.1-115). Tolère une donnée absente ; une donnée mal
 * formée est ignorée mais journalisée (un prérequis perdu en silence
 * laisserait entrer dans une classe sans le dire).
 */
function classBasicsExtras(data: unknown): Pick<BatchEntry, "multiclassPrerequisites" | "suggestedAbilities" | "spellcastingKind" | "casterWeight"> {
  if (data === undefined || data === null) return {};
  const parsed = zClassBasicsBlockData
    .pick({ multiclass_prerequisites: true, suggested_abilities: true, spellcasting_kind: true, caster_weight: true })
    .safeParse(data);
  if (!parsed.success) {
    console.error("Bloc class_basics : prérequis de multiclassage mal formés, ignorés", parsed.error.issues);
    return {};
  }
  return {
    ...(parsed.data.multiclass_prerequisites ? { multiclassPrerequisites: parsed.data.multiclass_prerequisites } : {}),
    ...(parsed.data.suggested_abilities ? { suggestedAbilities: parsed.data.suggested_abilities } : {}),
    ...(parsed.data.spellcasting_kind ? { spellcastingKind: parsed.data.spellcasting_kind } : {}),
    ...(parsed.data.caster_weight ? { casterWeight: parsed.data.caster_weight } : {}),
  };
}

/** Modificateurs du bloc `modifiers`, valides par son schema. Absent : aucun. Mal forme : aucun, mais journalise (un effet ignore en silence fausserait la fiche sans qu'on sache pourquoi). */
function declaredModifiers(data: unknown): DeclaredModifier[] {
  if (data === undefined || data === null) return [];
  const parsed = zModifiersBlockData.safeParse(data);
  if (!parsed.success) {
    console.error("Bloc modifiers mal forme, ignore", parsed.error.issues);
    return [];
  }
  return parsed.data.modifiers;
}

/** Cles de regle du bloc `species_traits` ; tolere une donnee absente ou d'une autre forme. */
function speciesTraitKeys(data: unknown): string[] {
  const traits = (data as { traits?: unknown } | undefined)?.traits;
  if (!Array.isArray(traits)) return [];
  return traits
    .map((t) => (t as { kind?: unknown; key?: unknown }).kind === "rule" ? (t as { key?: unknown }).key : null)
    .filter((k): k is string => typeof k === "string" && k !== "");
}

/**
 * `fetchEntryFields`+`resolveEntryName` fusionnes puis batches pour un LOT
 * de cles (V2-G1 suite, retour utilisateur : "lenteur generale" persistante
 * meme apres le premier correctif N+1 de l'assistant) — mesure : assembler
 * un personnage a une seule classe prenait ~1.3s, chaque espece/historique/
 * classe/sort refaisant sa PROPRE remontee de chaine de rulesets (2-4
 * allers-retours chacune), jamais partagee entre elles ni avec les autres.
 *
 * Repli override-aware pour les cles introuvables via cette premiere passe
 * (retour utilisateur, "regarde le bug de creation de personnage" : un
 * historique maison, cree via `CreateHomebrewBackgroundForm.tsx`, n'existe
 * QUE dans `ruleset_overrides` — jamais de ligne `ruleset_entries`, donc
 * jamais trouve par `listRulesetEntriesByKeys` ci-dessous). L'hypothese
 * "l'espece/l'historique/la classe/le sort choisi par un joueur n'est
 * jamais une fiche maison" documentee ici avant etait vraie a l'ecriture de
 * cette fonction, plus depuis l'outil de creation d'historique — meme
 * moteur de repli (`resolveEntryBlocksInRuleset`) que `fetchEquipmentBlocks`
 * plus bas, deja override-aware pour ce meme besoin cote objets. Seul le
 * bloc dedie `background` est lu ici (jamais de `custom_table` sur une
 * fiche maison) : `species_traits` reste hors perimetre tant qu'aucun outil
 * de creation d'espece maison n'existe.
 */
async function fetchEntriesBatch(
  supabase: TypedClient,
  rulesetId: string,
  keys: string[],
  locale: Locale
): Promise<Map<string, BatchEntry>> {
  const result = new Map<string, BatchEntry>();
  const remaining = new Set(keys.filter((k) => k.trim() !== ""));
  if (remaining.size === 0) return result;

  const chain = await walkRulesetChain(supabase, rulesetId);

  for (const link of chain) {
    if (remaining.size === 0) break;
    const entries = await listRulesetEntriesByKeys(supabase, link.rulesetId, [...remaining]);
    if (entries.length === 0) continue;

    const entryIds = entries.map((e) => e.id);
    const [blockRows, translations] = await Promise.all([
      listBlocksForRulesetEntries(supabase, entryIds),
      locale !== "en" ? listEntryTranslationsWithBlocks(supabase, entryIds, locale) : Promise.resolve([]),
    ]);

    const translationByEntryId = new Map(translations.map((t) => [t.entry_id, t]));
    const blocksByEntryId = new Map<string, typeof blockRows>();
    for (const row of blockRows) {
      const list = blocksByEntryId.get(row.entry_id) ?? [];
      list.push(row);
      blocksByEntryId.set(row.entry_id, list);
    }

    for (const entry of entries) {
      const translation = translationByEntryId.get(entry.id);
      const overrideBlocks = (translation?.blocks ?? {}) as Record<string, unknown>;
      const rows = blocksByEntryId.get(entry.id) ?? [];
      const customTableRow = rows.find((r) => r.block_type === "custom_table");
      const progressionRow = rows.find((r) => r.block_type === "class_progression");
      const speciesTraitsRow = rows.find((r) => r.block_type === "species_traits");
      const modifiersRow = rows.find((r) => r.block_type === "modifiers");
      const classBasicsRow = rows.find((r) => r.block_type === "class_basics");
      const choicesRow = rows.find((r) => r.block_type === "choices");
      const subclassFeaturesRow = rows.find((r) => r.block_type === "subclass_features");

      const customTableData = (overrideBlocks.custom_table ?? customTableRow?.data) as { rows: CustomTableRow[] } | undefined;
      const progressionData = (overrideBlocks.class_progression ?? progressionRow?.data) as
        | { rows: ProgressionRow[] }
        | undefined;

      result.set(entry.entry_key, {
        name: translation?.name ?? entryNameFrom(entry),
        fields: customTableData ? parseCustomTableFields(customTableData.rows) : {},
        progressionRows: progressionData?.rows ?? [],
        traitKeys: speciesTraitKeys(overrideBlocks.species_traits ?? speciesTraitsRow?.data),
        modifiers: declaredModifiers(overrideBlocks.modifiers ?? modifiersRow?.data),
        ...classBasicsExtras(overrideBlocks.class_basics ?? classBasicsRow?.data),
        choices: parseChoicesBlock(choicesRow?.data),
        subclassFeatures: parseSubclassFeatures(subclassFeaturesRow?.data),
      });
      remaining.delete(entry.entry_key);
    }
  }

  if (remaining.size > 0) {
    const fallbackResults = await Promise.all(
      [...remaining].map(async (key) => [key, await resolveEntryBlocksInRuleset(supabase, rulesetId, key)] as const)
    );
    for (const [key, resolved] of fallbackResults) {
      if (!resolved || !resolved.name) continue;
      result.set(key, {
        name: resolved.name,
        fields: {},
        progressionRows: [],
        backgroundBlock: resolved.blocksByType.get("background") as BackgroundBlockData | undefined,
        traitKeys: speciesTraitKeys(resolved.blocksByType.get("species_traits")),
        modifiers: declaredModifiers(resolved.blocksByType.get("modifiers")),
        ...classBasicsExtras(resolved.blocksByType.get("class_basics")),
        choices: parseChoicesBlock(resolved.blocksByType.get("choices")),
        subclassFeatures: parseSubclassFeatures(resolved.blocksByType.get("subclass_features")),
      });
      remaining.delete(key);
    }
  }

  return result;
}

/**
 * V3.1-62 (docs/CABLAGE.md, C4) : les NOMS seuls d'un lot de fiches (espece,
 * classes...), lus exactement comme `assembleResolvedRuleset` les lit
 * (`fetchEntriesBatch` : chaine de rulesets, traduction, fiche maison en
 * repli) — sans le reste de l'assemblage (catalogue d'armes, traits,
 * aptitudes, choix). L'accueil du monde appelait l'assemblage complet par PJ
 * pour afficher « Humain — Guerrier 1 ». Une cle introuvable est absente.
 */
export async function resolveEntryNames(
  supabase: TypedClient,
  rulesetId: string,
  keys: string[],
  locale: Locale
): Promise<Map<string, string>> {
  const batch = await fetchEntriesBatch(supabase, rulesetId, keys, locale);
  return new Map([...batch.entries()].map(([key, entry]) => [key, entry.name]));
}

/** Noms d'affichage d'un lot de cles (fiche + traduction), en deux allers-retours qui s'enchainent forcement : la traduction a besoin des identifiants. */
async function fetchChipsWithNames(
  supabase: TypedClient,
  rulesetId: string,
  keys: string[],
  locale: Locale
): Promise<{ chips: Awaited<ReturnType<typeof listRulesetEntryChipsByKeys>>; nameByChipEntryId: Map<string, string> }> {
  const chips = await listRulesetEntryChipsByKeys(supabase, rulesetId, keys);
  const nameByChipEntryId = new Map<string, string>();
  if (locale !== "en" && chips.length > 0) {
    const translations = await listTranslationsForEntries(supabase, chips.map((c) => c.id), locale);
    for (const t of translations) nameByChipEntryId.set(t.entry_id, t.name);
  }
  return { chips, nameByChipEntryId };
}

/** Clé de la fiche des règles de personnage d'un ruleset (V3.1-115, `scripts/ingest-srd.ts`). */
export const CHARACTER_RULES_ENTRY_KEY = "character-rules";

/**
 * Les règles de personnage du ruleset (V3.1-115, ADR 0046), surcharges de la
 * chaîne comprises. `null` si le ruleset n'en a pas, ou si elles sont mal
 * formées (journalisé) : la fiche le signale alors, sans valeur inventée.
 */
export async function readCharacterRules(supabase: TypedClient, rulesetId: string): Promise<CharacterRules | null> {
  const resolved = await resolveEntryBlocksInRuleset(supabase, rulesetId, CHARACTER_RULES_ENTRY_KEY);
  const data = resolved?.blocksByType.get("character_rules");
  if (data === undefined) return null;
  const parsed = zCharacterRulesBlockData.safeParse(data);
  if (!parsed.success) {
    console.error("Règles de personnage mal formées, ignorées", rulesetId, parsed.error.issues);
    return null;
  }
  return parsed.data;
}

/** Les règles de personnage du ruleset par défaut d'un monde (V3.1-115). `null` : monde sans ruleset, ou ruleset sans règles. */
export async function readWorldCharacterRules(supabase: TypedClient, worldId: string): Promise<CharacterRules | null> {
  const rulesetId = await getWorldDefaultRulesetId(supabase, worldId);
  if (!rulesetId) return null;
  return readCharacterRules(supabase, rulesetId);
}

/** Catégories de don qu'exigent des choix `feat`, sous-choix d'options compris. Un choix sans catégorie accepte tout don : `null`. */
function featCategoriesOf(grants: readonly ChoiceGrant[], into: Set<string | null>): Set<string | null> {
  for (const grant of grants) {
    if (grant.from.kind === "feat") into.add(grant.from.category ?? null);
    if (grant.from.kind === "option") for (const o of grant.from.options) featCategoriesOf(o.grants ?? [], into);
  }
  return into;
}

/** Les catégories de don du SRD (`source_raw.type`). */
const FEAT_CATEGORIES = ["origin", "general", "fighting-style", "epic-boon"];

/**
 * V3.1-116 : les dons d'une ou plusieurs catégories, avec leurs choix et
 * leurs modificateurs, pour qu'un choix `feat` (Polyvalent) se résolve sans
 * nouvel aller-retour. Chargé seulement quand un tel choix existe : deux
 * vagues de requêtes (clés par catégorie sur la chaîne, puis le lot).
 */
async function fetchFeatCatalog(
  supabase: TypedClient,
  rulesetId: string,
  categories: Set<string | null>,
  locale: Locale
): Promise<Record<string, FeatChoiceData>> {
  const wanted = categories.has(null) ? FEAT_CATEGORIES : [...categories].filter((c): c is string => c !== null);
  const chain = await walkRulesetChain(supabase, rulesetId);
  const lists = await Promise.all(
    chain.flatMap((link) => wanted.map(async (category) => ({ category, keys: await listFeatKeysByCategory(supabase, link.rulesetId, category) })))
  );
  const categoryByKey = new Map<string, string>();
  for (const { category, keys } of lists) for (const key of keys) if (!categoryByKey.has(key)) categoryByKey.set(key, category);
  if (categoryByKey.size === 0) return {};
  const batch = await fetchEntriesBatch(supabase, rulesetId, [...categoryByKey.keys()], locale);
  const catalog: Record<string, FeatChoiceData> = {};
  for (const [key, entry] of batch) {
    catalog[key] = { key, label: entry.name, category: categoryByKey.get(key), grants: entry.choices?.grants ?? [], modifiers: entry.modifiers };
  }
  return catalog;
}

/**
 * Les choix du personnage résolus avec SES réponses, là où ils font foi
 * (moteur, montée de niveau). Deux passes : la première dit quels choix sont
 * des sorts et ce qui y est répondu, la seconde valide ces sorts (niveau,
 * liste) d'après leurs fiches — un lot de quelques clés, seulement s'il y en a.
 */
export async function resolveCharacterChoices(
  supabase: TypedClient,
  rulesetId: string,
  assembled: Pick<AssembledRuleset, "choiceSources" | "choicePresets" | "featCatalog">,
  choices: Record<string, unknown>,
  characterLevel: number,
  classLevels: Record<string, number> = {},
  /** V3.1-49 : les autres aptitudes du personnage, pour valider une expertise (voir `ResolveChoicesInput`). */
  otherFeatures?: readonly ResolvedFeature[]
): Promise<ResolvedChoices> {
  const input = {
    sources: assembled.choiceSources,
    choices,
    presets: assembled.choicePresets,
    characterLevel,
    classLevels,
    feats: assembled.featCatalog,
    ...(otherFeatures ? { otherFeatures } : {}),
  };
  const firstPass = resolveChoices(input);
  // Toutes les réponses brutes, pas seulement celles retenues : sans le
  // catalogue, la première passe garde les `count` premières, et un sort
  // valide placé après un sort refusé serait perdu.
  const spellKeys = [
    ...new Set(
      firstPass.open
        .filter((c) => c.from.kind === "spell")
        .flatMap((c) => {
          const raw = choices[c.key];
          return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string" && v !== "") : [];
        })
    ),
  ];
  if (spellKeys.length === 0) return firstPass;
  const batch = await fetchEntriesBatch(supabase, rulesetId, spellKeys, "en");
  const spells: Record<string, SpellMeta> = {};
  for (const [key, entry] of batch) {
    const level = parseSpellLevel(entry.fields);
    const school = (entry.fields.school as { index?: unknown } | undefined)?.index;
    if (level !== null) spells[key] = { level, lists: parseSpellClasses(entry.fields), ...(typeof school === "string" ? { school } : {}) };
  }
  return resolveChoices({ ...input, spells });
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
  const asiGrantedLevels: Record<string, number[]> = {};
  let backgroundAbilityScores: Ability[] | null = null;
  // V3.1-116 : fiches qui portent des choix, et réponses imposées.
  const choiceSources: ChoiceSource[] = [];
  const choicePresets: Record<string, string[]> = {};
  /** `where` (V3.1-49) : l'étape de création qui fait naître ces choix, et la classe dont le niveau les ouvre. */
  function addChoices(
    key: string,
    label: string,
    layer: ChoiceSource["layer"],
    block: ChoicesBlockData | undefined,
    where: Pick<ChoiceSource, "origin" | "classKey">
  ) {
    if (!block) return;
    if (block.grants.length > 0) choiceSources.push({ key, label, layer, grants: block.grants, ...where });
    Object.assign(choicePresets, block.presets ?? {});
  }

  // Avant toute classe (assistant de création), le personnage est traité comme de niveau 1.
  const characterLevel = Math.max(1, selection.classes.reduce((sum, c) => sum + c.level, 0));
  const topKeys = [
    ...(selection.species ? [selection.species] : []),
    ...(selection.background ? [selection.background] : []),
    ...selection.classes.map((c) => c.key),
    ...selection.classes.flatMap((c) => (c.subclass ? [c.subclass] : [])),
  ];
  // V3.1-115 (ADR 0046) : les regles de personnage du ruleset, surcharges de la
  // variante comprises. Lues en parallele du lot : aucune vague de plus.
  const [batch, characterRules] = await Promise.all([
    fetchEntriesBatch(supabase, rulesetId, topKeys, locale),
    readCharacterRules(supabase, rulesetId),
  ]);

  // Le catalogue d'armes n'est charge que si une classe choisie accorde
  // REELLEMENT une maitrise d'armes DANS CE RULESET — jamais seulement parce
  // que sa cle correspond a l'une des cinq classes concernees (V2-G1,
  // regression detectee par un test d'integration : "fighter" existe aussi
  // sous le SRD 2014, qui n'a pas la maitrise d'armes — sans ce filtre,
  // l'aller-retour se payait quand meme pour un resultat qui finissait
  // toujours ecarte). Le nombre se lit dans les donnees DEJA chargees par
  // `fetchEntriesBatch` (`progressionRows`), donc avant de decider si le
  // catalogue vaut la peine d'etre charge — un seul chemin de lecture pour
  // les cinq classes (`weaponMasteryCount`), plus de liste de cles a part.
  const weaponMasteryCounts = new Map<string, number>();
  for (const cl of selection.classes) {
    const found = batch.get(cl.key);
    if (!found) continue;
    const count = weaponMasteryCount(found.progressionRows, cl.level);
    if (count > 0) weaponMasteryCounts.set(cl.key, count);
  }

  // V3.1-62 (docs/CABLAGE.md, C3) : tout ce qui suit ne depend que de `batch`.
  // Les quatre lectures restantes (catalogue d'armes, traits d'espece, noms
  // des aptitudes et maitrises, blocs des aptitudes) partent donc ENSEMBLE
  // apres les boucles ci-dessous, au lieu de s'attendre l'une l'autre (18
  // vagues mesurees pour un Humain Guerrier). Les choix qui en dependent
  // (maitrise d'armes, traits) sont inseres ensuite a la place exacte
  // qu'ils occupaient : l'ordre des choix restants ne change pas.
  const weaponPoolPromise = weaponMasteryCounts.size > 0 ? fetchWeaponPool(supabase, rulesetId) : Promise.resolve(null);
  const speciesEntry = selection.species ? batch.get(selection.species) : undefined;
  const traitBatchPromise =
    speciesEntry && speciesEntry.traitKeys.length > 0 ? fetchEntriesBatch(supabase, rulesetId, speciesEntry.traitKeys, locale) : Promise.resolve(null);
  /** Choix de maitrise d'armes en attente du catalogue : leur place dans `remainingChoices` est retenue. */
  const pendingWeaponMastery: { insertAt: number; classKey: string; label: string; classProficiencyKeys: string[]; meleeOnly: boolean; count: number }[] = [];

  if (selection.species) {
    const found = batch.get(selection.species);
    if (found) {
      const label = found.name;
      const key = `species:${selection.species}`;
      features[key] = { key, label, source: key, modifiers: mapSpeciesModifiers(found.fields, key, label) };
      proficiencies.push(...mapProficiencies(found.fields).map((p) => ({ ...p, source: label })));
      languages.push(...extractLanguages(found.fields).map((l) => ({ ...l, source: label })));
    }
  }

  if (selection.background) {
    const found = batch.get(selection.background);
    if (found) {
      const label = found.name;
      const key = `background:${selection.background}`;
      addChoices(key, label, 4, found.choices, { origin: "background" });
      // Fiche maison (bloc dedie `background`, jamais de `custom_table`) :
      // deux extracteurs distincts (`backgroundModifiersFromBlock`/
      // `backgroundFeatKeyFromBlock`, src/core/rules/srdMapping.ts) plutot
      // que les extracteurs SRD `fields`-derives ci-dessous, qui ne
      // trouveraient jamais rien sur `found.fields` (vide pour une fiche
      // maison). La maitrise d'outil (texte libre, pas de fiche a
      // resoudre) s'ajoute directement en TraitGrant, meme cle que son
      // libelle — rien d'autre a resoudre.
      if (found.backgroundBlock) {
        features[key] = { key, label, source: key, modifiers: backgroundModifiersFromBlock(found.backgroundBlock, key, label) };
        const featKey = backgroundFeatKeyFromBlock(found.backgroundBlock);
        if (featKey) extraFeatureKeys.set(featKey, key);
        if (found.backgroundBlock.tool_proficiency) {
          proficiencies.push({ key: found.backgroundBlock.tool_proficiency, name: found.backgroundBlock.tool_proficiency, source: label });
        }
        // `ability_scores` n'est qu'un `string[]` au niveau du schema (zBackgroundBlockData) —
        // filtre defensif plutot qu'un cast, meme discipline que `extractBackgroundAbilityScores` ci-dessous.
        backgroundAbilityScores = found.backgroundBlock.ability_scores.filter((a): a is Ability => ABILITIES.includes(a as Ability));
      } else {
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
            origin: "background",
          });
        }

        const featKey = extractBackgroundFeat(found.fields);
        if (featKey) extraFeatureKeys.set(featKey, key);
        backgroundAbilityScores = extractBackgroundAbilityScores(found.fields);
      }

      // Bonus +2/+1 ou +1/+1/+1 (V2-G7, PHB 2024 p.15) : choix du joueur
      // (`character.choices["background.ability_bonus"]`), jamais devine —
      // un choix absent ou invalide (caracteristique hors des trois de CET
      // historique, total incorrect) ne contribue simplement aucun
      // modificateur, meme philosophie permissive que `buildAsiChoiceFeatures`
      // (characterActions.ts) pour un choix d'ASI malforme : jamais un rejet
      // HTTP a la lecture, l'avantage illegitime n'atteint jamais la fiche
      // calculee.
      const abilityBonusChoice = parseBackgroundAbilityBonusChoice(selection.choices?.["background.ability_bonus"]);
      if (abilityBonusChoice && isValidBackgroundAbilityBonusChoice(abilityBonusChoice, backgroundAbilityScores ?? [])) {
        features[key].modifiers.push(...backgroundAbilityBonusModifiers(abilityBonusChoice, key, label));
      }
    }
  }

  for (const cl of selection.classes) {
    const found = batch.get(cl.key);
    if (!found) continue;

    const label = found.name;
    const core = mapClassCore(found.fields);
    const spellAbility = mapClassSpellcastingAbility(found.fields);
    const slotsByLevel = extractSlotsByLevel(found.progressionRows);

    classes[cl.key] = {
      key: cl.key,
      label,
      hitDie: core.hitDie,
      savingThrowProficiencies: core.savingThrowProficiencies,
      spellcasting: spellAbility
        ? {
            ability: spellAbility,
            slotsByLevel,
            ...(found.spellcastingKind ? { kind: found.spellcastingKind } : {}),
            ...(found.casterWeight ? { casterWeight: found.casterWeight } : {}),
          }
        : undefined,
      ...(found.multiclassPrerequisites ? { multiclassPrerequisites: found.multiclassPrerequisites } : {}),
      ...(found.suggestedAbilities ? { suggestedAbilities: found.suggestedAbilities } : {}),
    };

    const classProficiencies = mapProficiencies(found.fields);
    proficiencies.push(...classProficiencies.map((p) => ({ ...p, source: label })));

    for (const fk of extractFeatureKeysUpToLevel(found.progressionRows, cl.level)) extraFeatureKeys.set(fk, `class:${cl.key}`);

    asiGrantedLevels[cl.key] = extractAsiGrantedLevels(found.progressionRows, cl.key);

    // V3.1-117 : la sous-classe choisie rejoint le lot ; ses aptitudes atteintes
    // (niveau de classe) donnent leurs effets et leurs choix.
    const subclassEntry = cl.subclass ? batch.get(cl.subclass) : undefined;
    if (cl.subclass && subclassEntry?.subclassFeatures) {
      const sub = subclassFeatures(
        { key: cl.subclass, label: subclassEntry.name, classKey: cl.key, classLevel: cl.level },
        subclassEntry.subclassFeatures
      );
      for (const f of sub.features) features[f.key] = f;
      choiceSources.push(...sub.sources);
    }

    for (const choice of extractSkillChoices(found.fields)) {
      remainingChoices.push({
        id: `${cl.key}.skills`,
        label: `${label} — compétences`,
        count: choice.count,
        options: choice.options,
        kind: "skill",
        origin: "class",
      });
    }

    const weaponMasteryCountForClass = weaponMasteryCounts.get(cl.key);
    if (weaponMasteryCountForClass !== undefined) {
      pendingWeaponMastery.push({
        insertAt: remainingChoices.length,
        classKey: cl.key,
        label,
        classProficiencyKeys: classProficiencies.map((p) => p.key),
        meleeOnly: weaponMasteryMeleeOnly(found.progressionRows, cl.level),
        count: weaponMasteryCountForClass,
      });
    }
  }

  // Traits d'espece a choix (V3.1-4, « Competent » humain, « Sens
  // aiguises » elfe) : leur `proficiency_choices` vit sur la fiche du TRAIT,
  // jamais sur celle de l'espece — un second lot, seulement s'il y a des
  // traits. Ajoutes APRES les choix de classe : une competence proposee par
  // les deux va d'abord a la classe (`routeSkillChoices`).
  const traitChoicesInsertAt = remainingChoices.length;

  // Regle universelle 2024 (retour utilisateur, V2-G1, point 3) : le SRD
  // 5.2.1 ne rattache plus AUCUNE langue a l'espece ni a l'historique
  // (contrairement a 2014, qui les accorde par espece — `mapSpeciesModifiers`
  // au-dessus) : la regle generale du personnage s'applique alors ("Choisissez
  // vos langues", data/srd/fr-source/srd-5.2.1-fr.txt : "Le commun, plus deux
  // langues determinees au hasard ou choisies"). Jamais tabulee nulle part
  // dans le SRD structure faute d'un champ dedie, donc jamais deduite d'une
  // fiche — codee ici comme repli explicite. Ne se declenche jamais sous une
  // regle qui fournit deja ses propres langues (2014) : `languages` porte
  // alors deja au moins le Commun via l'espece, et ce bloc reste muet.
  if (languages.length === 0 && !remainingChoices.some((c) => c.kind === "language")) {
    languages.push({ key: "common", name: "Common", source: "Personnage" });
    remainingChoices.push({
      id: "character.languages",
      label: "Langues",
      count: 2,
      options: SRD_LANGUAGES.filter((l) => l !== "common"),
      kind: "language",
      origin: "character",
    });
  }

  // Aptitudes de classe/dons accordes ET maitrises resolubles en UN seul
  // aller-retour de chips + un seul de traductions (V2-G1 suite, retour
  // utilisateur : "lenteur generale" persistante) — les deux etaient avant
  // deux paires sequentielles independantes (`listRulesetEntryChipsByKeys` +
  // `listTranslationsForEntries`), jamais fusionnees alors qu'elles portent
  // exactement la meme forme (cle -> nom traduit). `mapProficiencies` ne
  // connait que le nom brut du SRD (`p.name`), jamais le nom traduit de la
  // fiche de regle qu'un index d'outil/arme/armure resout pourtant souvent
  // (ex. "thieves-tools" a bien sa propre fiche Objet) ; les categories
  // generiques sans fiche propre (ex. "daggers", "light-armor" —
  // `Proficiencies` est explicitement exclue de l'import,
  // scripts/ingest-srd.ts `SKIPPED_CATEGORIES`) retombent sur
  // `WEAPON_ARMOR_PROFICIENCY_LABELS_FR`, un lexique statique dedie.
  const featureKeys = [...extraFeatureKeys.keys()];
  const proficiencyKeys = [...new Set(proficiencies.map((p) => p.key))];
  const combinedKeys = [...new Set([...featureKeys, ...proficiencyKeys])];
  const [weaponPool, traitBatch, chipsAndNames, resolvedFeatureBlocksOrNull] = await Promise.all([
    weaponPoolPromise,
    traitBatchPromise,
    combinedKeys.length > 0 ? fetchChipsWithNames(supabase, rulesetId, combinedKeys, locale) : Promise.resolve(null),
    combinedKeys.length > 0 ? resolveEntryBlocksInRulesetBatch(supabase, rulesetId, featureKeys) : Promise.resolve(null),
  ]);

  // Insertions a leur place d'origine, de la plus loin a la plus proche
  // (une insertion ne decale jamais une place situee avant elle) : les
  // traits apres les choix de classe, chaque maitrise d'armes apres les
  // competences de sa classe.
  if (speciesEntry && traitBatch) {
    const traitChoices: RemainingChoice[] = [];
    // V3.1-121 : les effets passifs d'un trait (bloc `modifiers`, ex.
    // Ténacité naine) s'ajoutent a la feature de l'espece, en couche 2 comme
    // ses bonus de caracteristique ; leur etiquette est le nom du trait, pour
    // que la fiche affiche « Ténacité naine » dans les sources des PV.
    const speciesFeature = selection.species ? features[`species:${selection.species}`] : undefined;
    for (const traitKey of speciesEntry.traitKeys) {
      const trait = traitBatch.get(traitKey);
      if (!trait) continue;
      if (speciesFeature && trait.modifiers.length > 0) {
        speciesFeature.modifiers.push(...resolveDeclaredModifiers(trait.modifiers, traitKey, trait.name, 2));
      }
      // V3.1-116 : un trait qui porte un bloc `choices` (Compétent, Sens
      // aiguisés, lignages) passe par le mécanisme générique ; le choix de
      // compétence lu dans le SRD ne s'y ajoute pas, il serait en double.
      if (trait.choices) {
        addChoices(traitKey, trait.name, 2, trait.choices, { origin: "species" });
        continue;
      }
      for (const choice of extractSkillChoices(trait.fields)) {
        traitChoices.push({
          id: `${traitKey}.skills`,
          label: `${speciesEntry.name} — ${trait.name}`,
          count: choice.count,
          options: choice.options,
          kind: "skill",
          origin: "species",
        });
      }
    }
    // Compétent, Sens aiguisés : à la même place et sous la même clé qu'avant le mécanisme générique.
    const traitSources = choiceSources.filter((s) => speciesEntry.traitKeys.includes(s.key));
    traitChoices.push(...simpleGrantChoices(traitSources, characterLevel, SRD_LANGUAGES).map((c) => ({ ...c, origin: "species" as const })));
    remainingChoices.splice(traitChoicesInsertAt, 0, ...traitChoices);
  }
  if (weaponPool) {
    for (const pending of [...pendingWeaponMastery].reverse()) {
      const options = weaponMasteryOptions(pending.classProficiencyKeys, weaponPool, pending.meleeOnly);
      if (options.length === 0) continue;
      remainingChoices.splice(pending.insertAt, 0, {
        id: `${pending.classKey}.weapon_mastery`,
        label: `${pending.label} — maîtrise d'armes`,
        count: pending.count,
        options,
        kind: "weapon_mastery",
        origin: "class",
      });
    }
  }

  if (chipsAndNames && resolvedFeatureBlocksOrNull) {
    const { chips, nameByChipEntryId } = chipsAndNames;
    const resolvedFeatureBlocks = resolvedFeatureBlocksOrNull;
    const chipByKey = new Map(chips.map((c) => [c.entry_key, c]));

    // Modificateurs generiques d'une aptitude/don (bloc `modifiers`, retour
    // utilisateur : "un don maison qui affecte reellement la fiche") — toutes
    // les cles EN UNE PASSE (audit de performance ulterieur ; `resolveEntryBlocksInRulesetBatch`,
    // meme raison que l'equipement plus bas). Passe par ce moteur
    // (override-aware, jamais `listRulesetEntryChipsByKeys` ci-dessus qui ne
    // lit QUE `ruleset_entries` — un don maison qui ne vit que dans
    // `ruleset_overrides`, comme n'importe quelle fiche cree via
    // `importRulesetEntries`, resout quand meme ici). Lu plus haut, en meme
    // temps que les autres lectures (V3.1-62).
    const declaredModifiersByKey = new Map(
      featureKeys.map((fk): [string, DeclaredModifier[]] => {
        const data = resolvedFeatureBlocks.get(fk)?.blocksByType.get("modifiers") as { modifiers: DeclaredModifier[] } | undefined;
        return [fk, data?.modifiers ?? []];
      })
    );

    for (const fk of featureKeys) {
      const chip = chipByKey.get(fk);
      const source = extraFeatureKeys.get(fk) ?? "class:inconnue";
      // Sans chip : une aptitude ajoutee apres coup (`add_entry`, elle ne vit
      // que dans `ruleset_overrides`, jamais dans `ruleset_entries` que lit
      // `listRulesetEntryChipsByKeys`). Son nom est deja porte par
      // `resolvedFeatureBlocks`, resolu juste au-dessus pour ses modificateurs
      // — le prendre la evite de retomber sur la cle technique brute dans la
      // colonne source de l'onglet Traits et dans les libelles de
      // modificateurs, et ne coute aucune requete de plus.
      const label = chip ? (nameByChipEntryId.get(chip.id) ?? entryNameFrom(chip)) : (resolvedFeatureBlocks.get(fk)?.name ?? fk);
      const modifiers = resolveDeclaredModifiers(declaredModifiersByKey.get(fk) ?? [], fk, label, layerForFeatureSource(source));
      // V3.1-49 : une aptitude de classe ouvre ses choix au niveau de SA classe (Expertise du roublard au niveau 6 de roublard).
      const featureClassKey = source.startsWith("class:") ? source.slice(6) : undefined;
      addChoices(
        fk,
        label,
        layerForFeatureSource(source),
        parseChoicesBlock(resolvedFeatureBlocks.get(fk)?.blocksByType.get("choices")),
        featureClassKey ? { origin: "class", classKey: featureClassKey } : { origin: source.startsWith("background:") ? "background" : "species" }
      );
      features[fk] = chip
        ? { key: fk, label, source, modifiers, prerequisites: mapPrerequisites(chip.source_raw) }
        : // Aucune ligne `ruleset_entries` : fiche maison (label resolu
          // ci-dessus) ou, plus rarement, aptitude jamais importee (label =
          // cle brute). Conservee dans les deux cas pour que
          // build.featureKeys puisse la referencer sans faire echouer
          // characterSheet(). Pas de prerequis : ils se lisent sur
          // `source_raw`, que seule une entree importee possede.
          { key: fk, label, source, modifiers };
    }

    for (const p of proficiencies) {
      const chip = chipByKey.get(p.key);
      const resolved = chip ? (nameByChipEntryId.get(chip.id) ?? entryNameFrom(chip)) : undefined;
      p.name = resolved ?? (locale !== "en" ? WEAPON_ARMOR_PROFICIENCY_LABELS_FR[p.key] : undefined) ?? p.name;
    }
  }

  // Langues : `extractLanguages` ne connait que le nom brut du SRD ("Common",
  // "Dwarvish"), affiche tel quel dans l'onglet Traits alors que les boutons
  // de choix juste au-dessus, eux, sont en francais (`LANGUAGE_LABELS_FR`).
  // Meme lexique statique, meme motif que les maitrises ci-dessus : une
  // langue du SRD n'a pas de fiche de regle propre d'ou tirer un nom traduit
  // (`Languages` est exclue de l'import, scripts/ingest-srd.ts).
  if (locale !== "en") {
    for (const l of languages) l.name = LANGUAGE_LABELS_FR[l.key as LanguageKey] ?? l.name;
  }

  // V3.1-116 : le catalogue des dons, seulement si un choix en désigne un.
  const featCategories = new Set<string | null>();
  for (const s of choiceSources) featCategoriesOf(s.grants, featCategories);
  const featCatalog = featCategories.size > 0 ? await fetchFeatCatalog(supabase, rulesetId, featCategories, locale) : {};

  return {
    ruleset: { classes, features, ...(characterRules ? { characterRules } : {}) },
    remainingChoices,
    proficiencies,
    languages,
    asiGrantedLevels,
    backgroundAbilityScores,
    choiceSources,
    choicePresets,
    featCatalog,
  };
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
function equipmentBlocksFromResolved(resolved: Awaited<ReturnType<typeof resolveEntryBlocksInRuleset>>): EquipmentBlocks | null {
  if (!resolved) return null;
  const customTable = resolved.blocksByType.get("custom_table") as { rows: CustomTableRow[] } | undefined;
  return {
    fields: customTable ? parseCustomTableFields(customTable.rows) : {},
    weapon: resolved.blocksByType.get("weapon") as WeaponBlockData | undefined,
    armor: resolved.blocksByType.get("armor") as ArmorBlockData | undefined,
    itemProperties: resolved.blocksByType.get("item_properties") as ItemPropertiesBlockData | undefined,
  };
}

async function fetchEquipmentBlocks(supabase: TypedClient, rulesetId: string, key: string): Promise<EquipmentBlocks | null> {
  return equipmentBlocksFromResolved(await resolveEntryBlocksInRuleset(supabase, rulesetId, key));
}

/**
 * Armure/arme/poids/cout d'un lot d'objets d'equipement EN UNE PASSE (V2-G1
 * suite ; batch inter-cles, audit de performance ulterieur, retour
 * utilisateur : "lenteur generale" persistante) — appeler
 * `resolveEquipmentArmorData`/`resolveEquipmentWeaponData`/
 * `resolveEquipmentWeight`/`resolveEquipmentCost` separement sur le MEME lot
 * de cles (ce que faisaient l'API et `characterActions.ts`) refaisait
 * `fetchEquipmentBlocks` — chain-walk + surcharges incluses, le plus couteux
 * des deux repartiteurs ci-dessus — 3 ou 4 fois pour chaque objet.
 * `resolveEntryBlocksInRulesetBatch` va plus loin : meme pour un seul appel
 * `fetchEquipmentBlocks` par objet, chaque objet payait son propre
 * aller-retour entree/blocs/surcharges — desormais 3 requetes pour TOUT le
 * lot, quelle que soit sa taille.
 */
export async function resolveEquipmentData(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<{
  armor: Record<string, ArmorData | null>;
  weapon: Record<string, WeaponData | null>;
  weight: Record<string, number | null>;
  cost: Record<string, ItemCost | null>;
}> {
  const armor: Record<string, ArmorData | null> = {};
  const weapon: Record<string, WeaponData | null> = {};
  const weight: Record<string, number | null> = {};
  const cost: Record<string, ItemCost | null> = {};

  const resolvedByKey = await resolveEntryBlocksInRulesetBatch(supabase, rulesetId, keys);
  for (const key of keys) {
    const found = equipmentBlocksFromResolved(resolvedByKey.get(key) ?? null);

    armor[key] = found ? (found.armor ? armorDataFromBlock(found.armor) : parseArmorData(found.fields)) : null;
    weapon[key] = found ? (found.weapon ? weaponDataFromBlock(found.weapon) : parseWeaponData(found.fields)) : null;
    const dedicatedWeight = found?.weapon?.weight ?? found?.armor?.weight ?? found?.itemProperties?.weight;
    weight[key] = found ? (dedicatedWeight !== undefined ? weightFromQuantity(dedicatedWeight) : parseItemWeight(found.fields)) : null;
    const dedicatedCost = found?.weapon?.cost ?? found?.armor?.cost ?? found?.itemProperties?.cost;
    cost[key] = found ? (dedicatedCost !== undefined ? costFromQuantity(dedicatedCost) : parseItemCost(found.fields)) : null;
  }

  return { armor, weapon, weight, cost };
}

/** Donnees mecaniques d'armure d'un objet d'equipement, par cle de regle — `null` si l'entree n'existe pas ou n'a pas de donnees d'armure (une arme, par exemple). */
export async function resolveEquipmentArmorData(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<Record<string, ArmorData | null>> {
  const result: Record<string, ArmorData | null> = {};
  await Promise.all(
    keys.map(async (key) => {
      const found = await fetchEquipmentBlocks(supabase, rulesetId, key);
      result[key] = found ? (found.armor ? armorDataFromBlock(found.armor) : parseArmorData(found.fields)) : null;
    })
  );
  return result;
}

/** Donnees mecaniques d'arme d'un objet d'equipement, par cle de regle — `null` si l'entree n'existe pas ou n'a pas de donnees d'arme (V1-B5, memes principes que resolveEquipmentArmorData). */
export async function resolveEquipmentWeaponData(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<Record<string, WeaponData | null>> {
  const result: Record<string, WeaponData | null> = {};
  await Promise.all(
    keys.map(async (key) => {
      const found = await fetchEquipmentBlocks(supabase, rulesetId, key);
      result[key] = found ? (found.weapon ? weaponDataFromBlock(found.weapon) : parseWeaponData(found.fields)) : null;
    })
  );
  return result;
}

/** Poids (en livres) d'un objet d'equipement, par cle de regle — `null` si l'entree n'existe pas ou n'a pas de poids renseigne (encombrement, V1-C4 suite). */
export async function resolveEquipmentWeight(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<Record<string, number | null>> {
  const result: Record<string, number | null> = {};
  await Promise.all(
    keys.map(async (key) => {
      const found = await fetchEquipmentBlocks(supabase, rulesetId, key);
      const dedicated = found?.weapon?.weight ?? found?.armor?.weight ?? found?.itemProperties?.weight;
      result[key] = found ? (dedicated !== undefined ? weightFromQuantity(dedicated) : parseItemWeight(found.fields)) : null;
    })
  );
  return result;
}

/** Cout d'un objet d'equipement, par cle de regle — `null` si l'entree n'existe pas ou n'a pas de cout renseigne (onglet Inventaire, V1-C11). */
export async function resolveEquipmentCost(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<Record<string, ItemCost | null>> {
  const result: Record<string, ItemCost | null> = {};
  await Promise.all(
    keys.map(async (key) => {
      const found = await fetchEquipmentBlocks(supabase, rulesetId, key);
      const dedicated = found?.weapon?.cost ?? found?.armor?.cost ?? found?.itemProperties?.cost;
      result[key] = found ? (dedicated !== undefined ? costFromQuantity(dedicated) : parseItemCost(found.fields)) : null;
    })
  );
  return result;
}

/** Niveau d'un sort connu, par cle de regle — `null` si l'entree n'existe pas ou n'a pas de niveau renseigne (tri Magie par niveau, V1-C6). */
export async function resolveSpellLevels(
  supabase: TypedClient,
  rulesetId: string,
  keys: readonly string[]
): Promise<Record<string, number | null>> {
  // Locale "en" : seul `fields.level` (numerique, jamais traduit) est lu
  // ici, `fetchEntriesBatch` saute alors la jointure de traduction — meme
  // comportement que l'ancien `fetchEntryFields`, qui ne l'appliquait
  // jamais non plus.
  const batch = await fetchEntriesBatch(supabase, rulesetId, [...keys], "en");
  const result: Record<string, number | null> = {};
  for (const key of keys) {
    const found = batch.get(key);
    result[key] = found ? parseSpellLevel(found.fields) : null;
  }
  return result;
}

/** Reponse de `/api/worlds/[worldSlug]/resolved-ruleset` quand le monde n'a pas de ruleset par defaut. */
const EMPTY_RULESET_VIEW = {
  ruleset: { classes: {}, features: {} },
  remainingChoices: [],
  proficiencies: [],
  languages: [],
  asiGrantedLevels: {},
  backgroundAbilityScores: null,
  choiceSources: [],
  choicePresets: {},
  featCatalog: {},
  equipment: {},
  weaponByKey: {},
  weight: {},
  cost: {},
  spellLevels: {},
};

/**
 * La reponse de `/api/worlds/[worldSlug]/resolved-ruleset`, construite ici
 * pour etre partagee par la route et par la page de la fiche, qui la lance
 * avec elle (V3.1-62, ADR 0056). Ruleset par defaut du monde, sans les choix
 * du personnage : exactement ce que la route a toujours rendu.
 */
export async function buildResolvedRulesetView(
  supabase: TypedClient,
  worldId: string,
  selection: { species?: string; background?: string; classes: { key: string; level: number }[]; equipmentKeys?: string[]; spellKeys?: string[] },
  locale: Locale
) {
  const rulesetId = await getWorldDefaultRulesetId(supabase, worldId);
  if (!rulesetId) return EMPTY_RULESET_VIEW;
  const [assembled, equipmentData, spellLevels] = await Promise.all([
    assembleResolvedRuleset(supabase, rulesetId, selection, locale),
    resolveEquipmentData(supabase, rulesetId, selection.equipmentKeys ?? []),
    resolveSpellLevels(supabase, rulesetId, selection.spellKeys ?? []),
  ]);
  const { armor: equipment, weapon: weaponByKey, weight, cost } = equipmentData;
  return { ...assembled, equipment, weaponByKey, weight, cost, spellLevels };
}
