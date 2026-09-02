import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { layerForFeatureSource, resolveDeclaredModifiers, type DeclaredModifier, type ResolvedClass, type ResolvedFeature, type ResolvedRuleset } from "@/src/core/rules/sheet";
import {
  armorDataFromBlock,
  backgroundFeatKeyFromBlock,
  backgroundModifiersFromBlock,
  costFromQuantity,
  extractAsiGrantedLevels,
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
import type { ArmorBlockData, BackgroundBlockData, ItemPropertiesBlockData, WeaponBlockData } from "@/src/core/schemas/rule-blocks";
import {
  listBlocksForRulesetEntries,
  listEntryTranslationsWithBlocks,
  listRulesetEntries,
  listRulesetEntriesByKeys,
  listRulesetEntryChipsByKeys,
  listTranslationsForEntries,
} from "@/src/server/repos/rules";
import { entryNameFrom, resolveEntryBlocksInRuleset, walkRulesetChain } from "./rules";
import { WEAPON_ARMOR_PROFICIENCY_LABELS_FR } from "@/src/i18n/fr";

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
  kind: "skill" | "language" | "weapon_mastery";
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
    const entries = await listRulesetEntries(supabase, link.rulesetId);
    const weaponEntries = entries.filter((e) => e.entry_type === "weapon" && !result.has(e.entry_key));
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
}

interface BatchEntry {
  name: string;
  fields: Record<string, unknown>;
  progressionRows: ProgressionRow[];
  /** Present uniquement pour une fiche maison resolue via le repli ci-dessous (bloc dedie `background`, jamais de `custom_table`). */
  backgroundBlock?: BackgroundBlockData;
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

      const customTableData = (overrideBlocks.custom_table ?? customTableRow?.data) as { rows: CustomTableRow[] } | undefined;
      const progressionData = (overrideBlocks.class_progression ?? progressionRow?.data) as
        | { rows: ProgressionRow[] }
        | undefined;

      result.set(entry.entry_key, {
        name: translation?.name ?? entryNameFrom(entry),
        fields: customTableData ? parseCustomTableFields(customTableData.rows) : {},
        progressionRows: progressionData?.rows ?? [],
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
      });
      remaining.delete(key);
    }
  }

  return result;
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

  const topKeys = [
    ...(selection.species ? [selection.species] : []),
    ...(selection.background ? [selection.background] : []),
    ...selection.classes.map((c) => c.key),
  ];
  const batch = await fetchEntriesBatch(supabase, rulesetId, topKeys, locale);

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
  const weaponPool = weaponMasteryCounts.size > 0 ? await fetchWeaponPool(supabase, rulesetId) : null;

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
          });
        }

        const featKey = extractBackgroundFeat(found.fields);
        if (featKey) extraFeatureKeys.set(featKey, key);
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
      spellcasting: spellAbility ? { ability: spellAbility, slotsByLevel } : undefined,
    };

    const classProficiencies = mapProficiencies(found.fields);
    proficiencies.push(...classProficiencies.map((p) => ({ ...p, source: label })));

    for (const fk of extractFeatureKeysUpToLevel(found.progressionRows, cl.level)) extraFeatureKeys.set(fk, `class:${cl.key}`);

    asiGrantedLevels[cl.key] = extractAsiGrantedLevels(found.progressionRows, cl.key);

    for (const choice of extractSkillChoices(found.fields)) {
      remainingChoices.push({
        id: `${cl.key}.skills`,
        label: `${label} — compétences`,
        count: choice.count,
        options: choice.options,
        kind: "skill",
      });
    }

    const weaponMasteryCountForClass = weaponMasteryCounts.get(cl.key);
    if (weaponMasteryCountForClass !== undefined && weaponPool) {
      const options = weaponMasteryOptions(
        classProficiencies.map((p) => p.key),
        weaponPool,
        weaponMasteryMeleeOnly(found.progressionRows, cl.level)
      );
      if (options.length > 0) {
        remainingChoices.push({
          id: `${cl.key}.weapon_mastery`,
          label: `${label} — maîtrise d'armes`,
          count: weaponMasteryCountForClass,
          options,
          kind: "weapon_mastery",
        });
      }
    }
  }

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
  if (combinedKeys.length > 0) {
    const chips = await listRulesetEntryChipsByKeys(supabase, rulesetId, combinedKeys);
    const nameByChipEntryId = new Map<string, string>();
    if (locale !== "en" && chips.length > 0) {
      const translations = await listTranslationsForEntries(supabase, chips.map((c) => c.id), locale);
      for (const t of translations) nameByChipEntryId.set(t.entry_id, t.name);
    }
    const chipByKey = new Map(chips.map((c) => [c.entry_key, c]));

    // Modificateurs generiques d'une aptitude/don (bloc `modifiers`, retour
    // utilisateur : "un don maison qui affecte reellement la fiche") — un
    // aller-retour par cle en parallele, meme cout deja accepte pour
    // l'equipement (`fetchEquipmentBlocks`, appele de la meme facon). Passe
    // par `resolveEntryBlocksInRuleset` (override-aware, jamais
    // `listRulesetEntryChipsByKeys` ci-dessus qui ne lit QUE `ruleset_entries` —
    // un don maison qui ne vit que dans `ruleset_overrides`, comme n'importe
    // quelle fiche cree via `importRulesetEntries`, resout quand meme ici).
    const declaredModifiersByKey = new Map(
      await Promise.all(
        featureKeys.map(async (fk): Promise<[string, DeclaredModifier[]]> => {
          const resolved = await resolveEntryBlocksInRuleset(supabase, rulesetId, fk);
          const data = resolved?.blocksByType.get("modifiers") as { modifiers: DeclaredModifier[] } | undefined;
          return [fk, data?.modifiers ?? []];
        })
      )
    );

    for (const fk of featureKeys) {
      const chip = chipByKey.get(fk);
      const source = extraFeatureKeys.get(fk) ?? "class:inconnue";
      const label = chip ? (nameByChipEntryId.get(chip.id) ?? entryNameFrom(chip)) : fk;
      const modifiers = resolveDeclaredModifiers(declaredModifiersByKey.get(fk) ?? [], fk, label, layerForFeatureSource(source));
      features[fk] = chip
        ? { key: fk, label, source, modifiers, prerequisites: mapPrerequisites(chip.source_raw) }
        : // Cle sans entree resolue (rare : feature non importee) — conservee
          // quand meme, label = cle brute, pour que build.featureKeys puisse
          // la referencer sans faire echouer characterSheet().
          { key: fk, label, source, modifiers };
    }

    for (const p of proficiencies) {
      const chip = chipByKey.get(p.key);
      const resolved = chip ? (nameByChipEntryId.get(chip.id) ?? entryNameFrom(chip)) : undefined;
      p.name = resolved ?? (locale !== "en" ? WEAPON_ARMOR_PROFICIENCY_LABELS_FR[p.key] : undefined) ?? p.name;
    }
  }

  return { ruleset: { classes, features }, remainingChoices, proficiencies, languages, asiGrantedLevels };
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

/**
 * Armure/arme/poids/cout d'un lot d'objets d'equipement EN UNE PASSE (V2-G1
 * suite, retour utilisateur : "lenteur generale" persistante) — appeler
 * `resolveEquipmentArmorData`/`resolveEquipmentWeaponData`/
 * `resolveEquipmentWeight`/`resolveEquipmentCost` separement sur le MEME lot
 * de cles (ce que faisaient l'API et `characterActions.ts`) refaisait
 * `fetchEquipmentBlocks` — chain-walk + surcharges incluses, le plus couteux
 * des deux repartiteurs ci-dessus — 3 ou 4 fois pour chaque objet. Ici, une
 * seule fois par objet, les objets entre eux en parallele (`Promise.all`,
 * aucun ne depend d'un autre).
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

  await Promise.all(
    keys.map(async (key) => {
      const found = await fetchEquipmentBlocks(supabase, rulesetId, key);
      armor[key] = found ? (found.armor ? armorDataFromBlock(found.armor) : parseArmorData(found.fields)) : null;
      weapon[key] = found ? (found.weapon ? weaponDataFromBlock(found.weapon) : parseWeaponData(found.fields)) : null;
      const dedicatedWeight = found?.weapon?.weight ?? found?.armor?.weight ?? found?.itemProperties?.weight;
      weight[key] = found ? (dedicatedWeight !== undefined ? weightFromQuantity(dedicatedWeight) : parseItemWeight(found.fields)) : null;
      const dedicatedCost = found?.weapon?.cost ?? found?.armor?.cost ?? found?.itemProperties?.cost;
      cost[key] = found ? (dedicatedCost !== undefined ? costFromQuantity(dedicatedCost) : parseItemCost(found.fields)) : null;
    })
  );

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
