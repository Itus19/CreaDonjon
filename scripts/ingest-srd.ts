// Import du SRD (P0-08) : charge data/srd/srd-2014.json et data/srd/srd-2024.json vers
// rulesets + ruleset_entries + ruleset_entry_blocks, sur le projet
// Supabase configure par NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
//
// Lancement : npm run ingest:srd
//
// Le contournement du verrou is_official_base est explicite et localise
// dans les fonctions Postgres app.import_upsert_ruleset / app.import_srd_entries
// (migration 20260730180001, renvois derives ajoutes en 20260802110001) et
// app.import_prune_stale_entries (migration 20260802100001) : ce script ne
// fait jamais de set_config lui-meme, il appelle des RPC qui l'encapsulent.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  type BlockType,
  type EntryType,
  validateBlockData,
} from "../src/core/schemas/rule-blocks";
import { parseFormula } from "../src/core/formula";
import { extractDerivedRefs, type DerivedRef } from "../src/core/rules/refs";

interface ConversionFailure {
  rulesetFile: string;
  category: string;
  entryKey: string;
  entryName: string;
  message: string;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local)."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --------------------------------------------------------------------
// Types minimaux des donnees SRD brutes utilisees par ce script (le reste
// des champs traverse tel quel vers le bloc custom_table).
// --------------------------------------------------------------------

type SrdRecord = Record<string, unknown>;

interface EntryBlock {
  block_type: BlockType;
  display: { label: string; layout: string; collapsed?: boolean };
  data: unknown;
  display_order?: number;
}

interface TransformedEntry {
  entry_key: string;
  entry_type: EntryType;
  ai_digest: string;
  source_attribution: string;
  // Objet JSON source integral (specs/outils-mj.md §1) : le generateur de
  // rencontres et le suivi d'initiative (V2) auront besoin de champs (CR,
  // XP, CA, PV...) non encore transformes en blocs. Le garder maintenant
  // evite un reimport complet le jour ou on en a besoin.
  source_raw: SrdRecord;
  blocks: EntryBlock[];
  // Renvois derives de la structure des blocs (V1-A3, SCHEMA.md §9.3) —
  // recalcules a chaque import, jamais les renvois `declared` (voir
  // app.import_srd_entries, migration 20260802110001).
  refs: DerivedRef[];
}

interface SrdVersionConfig {
  file: string;
  baseSystem: "dnd_srd_51" | "dnd_srd_52";
  rulesetName: string;
  sourceAttribution: string;
  /**
   * srd-2024.json n'est pas un document autonome : c'est un jeu de
   * modifications/ajouts par rapport a 2014 (indique par l'utilisateur,
   * confirme par les donnees — pas de categorie "Spells" du tout, "Monsters"
   * reduit a 3 entrees). Quand ce champ est present, le jeu de donnees
   * complet est reconstruit en partant de `file` de base et en appliquant
   * les entrees de ce fichier par-dessus, index par index (voir
   * buildMergedDataset).
   */
  mergeWithBaseFile?: string;
}

const SRD_VERSIONS: SrdVersionConfig[] = [
  {
    file: "data/srd/srd-2014.json",
    baseSystem: "dnd_srd_51",
    rulesetName: "SRD 5.1 (2014)",
    sourceAttribution: "SRD 5.1",
  },
  {
    file: "data/srd/srd-2024.json",
    baseSystem: "dnd_srd_52",
    rulesetName: "SRD 5.2.1 (2024)",
    sourceAttribution: "SRD 5.2.1",
    mergeWithBaseFile: "data/srd/srd-2014.json",
  },
];

/**
 * Categories renommees entre 2014 et 2024 : meme concept, cle differente.
 * Utilise pour aligner les deux jeux de donnees lors de la fusion.
 */
const CATEGORY_RENAMES_2014_TO_2024: Record<string, string> = {
  Races: "Species",
  Subraces: "Subspecies",
};

/**
 * Fusionne deux tableaux d'objets SRD par leur `index` stable : les
 * elements de `overrides` remplacent entierement ceux de `base` partageant
 * le meme index (jamais un merge champ par champ — une revision 2024 d'un
 * sort est un texte complet, pas un patch), les elements de base sans
 * correspondance sont conserves tels quels, et les elements de overrides
 * sans correspondance sont ajoutes.
 */
function mergeByIndex(base: SrdRecord[], overrides: SrdRecord[]): SrdRecord[] {
  const byIndex = new Map<string, SrdRecord>();
  for (const item of base) byIndex.set(String(item.index), item);
  for (const item of overrides) byIndex.set(String(item.index), item);
  return [...byIndex.values()];
}

/**
 * Reconstruit un jeu de donnees SRD 2024 complet : base 2014 + surcharges
 * et ajouts 2024, categorie par categorie (avec alignement des renommages).
 */
function buildMergedDataset(
  base: Record<string, SrdRecord[]>,
  overrides: Record<string, SrdRecord[]>
): Record<string, SrdRecord[]> {
  const merged: Record<string, SrdRecord[]> = {};

  for (const [baseCategory, baseItems] of Object.entries(base)) {
    const targetCategory = CATEGORY_RENAMES_2014_TO_2024[baseCategory] ?? baseCategory;
    merged[targetCategory] = mergeByIndex(baseItems, overrides[targetCategory] ?? []);
  }

  const handledTargets = new Set(Object.keys(merged));
  for (const [category, items] of Object.entries(overrides)) {
    if (!handledTargets.has(category)) merged[category] = items;
  }

  return merged;
}

// --------------------------------------------------------------------
// Categories reference/enum du SRD : utilisees par d'autres entrees
// (ecole de magie d'un sort, propriete d'une arme...) mais ne sont pas,
// elles-memes, des ruleset_entries — aucun entry_type ferme (SCHEMA.md §9)
// ne leur correspond, et ce ne sont pas des regles qu'on consulte comme un
// sort ou un monstre. Ecarte deliberement (regle des trois) plutot que
// d'elargir le schema pour un besoin qui n'existe pas encore.
// --------------------------------------------------------------------
const SKIPPED_CATEGORIES = new Set([
  "Ability-Scores",
  "Alignments",
  "Damage-Types",
  "Equipment-Categories",
  "Languages",
  "Levels", // consomme via Classes pour class_progression, pas importe seul
  "Magic-Schools",
  "Proficiencies",
  "Skills",
  "Weapon-Properties",
  "Weapon-Mastery-Properties",
]);

// --------------------------------------------------------------------
// Utilitaires de transformation
// --------------------------------------------------------------------

function truncateForDigest(text: string, maxChars = 480): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxChars ? `${clean.slice(0, maxChars - 1)}…` : clean;
}

/** Cherche une prose exploitable dans les formes rencontrees dans le SRD (desc: string[] | string, description: string). */
function extractProse(entry: SrdRecord): string | null {
  const desc = entry.desc;
  if (Array.isArray(desc)) return desc.join("\n\n");
  if (typeof desc === "string" && desc.trim() !== "") return desc;
  const description = entry.description;
  if (typeof description === "string" && description.trim() !== "") return description;
  return null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface FeatureDedup {
  /** entry_key original (specifique a une classe) -> entry_key canonique. Identite si l'entree n'a pas de doublon. */
  canonicalKeyByOriginalKey: Map<string, string>;
  /** Une entree brute par groupe canonique, index reecrit sur la cle canonique. */
  canonicalEntries: SrdRecord[];
}

/**
 * La categorie Features du SRD modelise chaque aptitude generique une fois
 * par classe et par niveau : "Ability Score Improvement" apparait ainsi 63
 * fois (2014 seul), texte strictement identique, seul l'index differe
 * (barbarian-ability-score-improvement-1, fighter-..., etc). Ce n'est pas une
 * erreur d'import, c'est la structure meme de la donnee source — mais le
 * wiki ne doit afficher qu'une seule fiche pour un seul mecanisme.
 *
 * Le regroupement se fait sur (nom, texte) strictement identiques, jamais
 * sur le nom seul : "Divine Domain feature" apparait aussi plusieurs fois
 * mais avec un contenu reellement distinct par classe (ou par palier) — ce
 * n'est pas un doublon, et cette regle le laisse intact (groupe a un seul
 * membre, cle inchangee).
 */
function dedupeFeatures(items: SrdRecord[]): FeatureDedup {
  const groups = new Map<string, SrdRecord[]>();
  for (const item of items) {
    const name = String(item.name ?? "");
    const prose = extractProse(item) ?? "";
    const groupKey = `${name}::${prose}`;
    const group = groups.get(groupKey);
    if (group) group.push(item);
    else groups.set(groupKey, [item]);
  }

  const canonicalKeyByOriginalKey = new Map<string, string>();
  const canonicalEntries: SrdRecord[] = [];
  const usedKeys = new Set(items.map((item) => String(item.index)));

  for (const groupItems of groups.values()) {
    const representative = groupItems[0];
    const originalKey = String(representative.index);

    if (groupItems.length === 1) {
      canonicalKeyByOriginalKey.set(originalKey, originalKey);
      canonicalEntries.push(representative);
      continue;
    }

    const baseSlug = slugify(String(representative.name ?? originalKey));
    let canonicalKey = baseSlug;
    let suffix = 2;
    while (usedKeys.has(canonicalKey)) {
      canonicalKey = `${baseSlug}-${suffix++}`;
    }
    usedKeys.add(canonicalKey);
    for (const item of groupItems) {
      canonicalKeyByOriginalKey.set(String(item.index), canonicalKey);
    }
    canonicalEntries.push({ ...representative, index: canonicalKey });
  }

  return { canonicalKeyByOriginalKey, canonicalEntries };
}

function descriptionBlock(text: string): EntryBlock {
  const data = { segments: [{ text }] };
  validateBlockData("description", data);
  return {
    block_type: "description",
    display: { label: "Description", layout: "prose" },
    data,
    display_order: 100,
  };
}

/** L'echappatoire (specs/regles-blocs.md §5) : rien de la donnee source n'est perdu, meme sans schema type dedie. */
function customTableBlock(entry: SrdRecord): EntryBlock {
  const rows = Object.entries(entry)
    .filter(([key]) => key !== "url")
    .map(([field, value]) => ({
      field,
      value: typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value),
    }));
  const data = { columns: ["field", "value"], rows };
  validateBlockData("custom_table", data);
  return {
    block_type: "custom_table",
    display: { label: "Donnees brutes (SRD)", layout: "table", collapsed: true },
    data,
    display_order: 900,
  };
}

/**
 * Parse une notation de des SRD ("8d6", "3d4 + 3"...) en FormulaNode. Le SRD
 * contient parfois du texte libre a cette place (rare) ; un echec de parsing
 * n'est pas fatal, l'effet reste alors sans formule plutot que de faire
 * echouer toute l'entree — c'est a l'appelant de le consigner.
 */
function tryParseDiceFormula(text: string) {
  try {
    return parseFormula(text);
  } catch {
    return undefined;
  }
}

function spellBlocks(entry: SrdRecord): EntryBlock[] {
  const blocks: EntryBlock[] = [];

  const spellCastingData = {
    level: Number(entry.level ?? 0),
    school: String((entry.school as SrdRecord | undefined)?.name ?? "unknown"),
    casting_time: String(entry.casting_time ?? ""),
    range: String(entry.range ?? ""),
    components: Array.isArray(entry.components) ? (entry.components as string[]) : [],
    material: typeof entry.material === "string" ? entry.material : undefined,
    duration: String(entry.duration ?? ""),
    concentration: Boolean(entry.concentration),
    ritual: Boolean(entry.ritual),
  };
  validateBlockData("spell_casting", spellCastingData);
  blocks.push({
    block_type: "spell_casting",
    display: { label: "Incantation", layout: "key_values" },
    data: spellCastingData,
    display_order: 200,
  });

  const damage = entry.damage as SrdRecord | undefined;
  if (damage) {
    const damageType = (damage.damage_type as SrdRecord | undefined)?.name;

    // Deux formes de montee en puissance existent dans le SRD, mutuellement
    // exclusives : les sorts avec emplacement (damage_at_slot_level, indexee
    // par niveau d'emplacement, palier de base = niveau du sort) et les tours
    // de magie (damage_at_character_level, indexee par niveau de personnage,
    // palier de base = niveau 1). Avant cette version, seule la premiere
    // etait lue : un tour de magie comme Fire Bolt n'avait donc aucune
    // progression du tout.
    const slotLevels = damage.damage_at_slot_level as Record<string, string> | undefined;
    const charLevels = damage.damage_at_character_level as Record<string, string> | undefined;

    const baseLevelKey = slotLevels ? String(entry.level ?? 0) : "1";
    const baseFormulaText = slotLevels?.[baseLevelKey] ?? charLevels?.[baseLevelKey];

    const effectsData = {
      effects: [
        {
          id: "e1",
          damage_type: typeof damageType === "string" ? damageType : undefined,
          formula: baseFormulaText ? tryParseDiceFormula(baseFormulaText) : undefined,
        },
      ],
    };
    validateBlockData("effects", effectsData);
    blocks.push({
      block_type: "effects",
      display: { label: "Effets", layout: "formula_list" },
      data: effectsData,
      display_order: 300,
    });

    if (slotLevels && Object.keys(slotLevels).length > 0) {
      const scalingData = {
        axis: "slot_level" as const,
        base: Number(entry.level ?? 0),
        rule: null,
        table: slotLevels,
      };
      validateBlockData("scaling", scalingData);
      blocks.push({
        block_type: "scaling",
        display: { label: "Montee en puissance", layout: "progression_table" },
        data: scalingData,
        display_order: 400,
      });
    } else if (charLevels && Object.keys(charLevels).length > 0) {
      const scalingData = {
        axis: "character_level" as const,
        base: 1,
        rule: null,
        table: charLevels,
      };
      validateBlockData("scaling", scalingData);
      blocks.push({
        block_type: "scaling",
        display: { label: "Montee en puissance", layout: "progression_table" },
        data: scalingData,
        display_order: 400,
      });
    }
  }

  return blocks;
}

/** Table de progression generique a partir de Levels (§7 de regles-blocs.md), colonnes derivees des cles rencontrees plutot que codees en dur par classe. */
function classProgressionBlock(
  classIndex: string,
  levels: SrdRecord[],
  remapFeatureKey: Map<string, string>
): EntryBlock {
  const ownLevels = levels
    .filter((l) => (l.class as SrdRecord | undefined)?.index === classIndex)
    .sort((a, b) => Number(a.level) - Number(b.level));

  const classSpecificKeys = new Set<string>();
  const spellcastingKeys = new Set<string>();
  for (const lvl of ownLevels) {
    for (const k of Object.keys((lvl.class_specific as SrdRecord | undefined) ?? {})) {
      classSpecificKeys.add(k);
    }
    for (const k of Object.keys((lvl.spellcasting as SrdRecord | undefined) ?? {})) {
      spellcastingKeys.add(k);
    }
  }

  const columns = [
    { key: "level", label: { fr: "Niveau", en: "Level" }, kind: "level" as const },
    { key: "prof_bonus", label: { fr: "Bonus de maitrise", en: "Proficiency bonus" }, kind: "value" as const },
    { key: "features", label: { fr: "Aptitudes", en: "Features" }, kind: "grants" as const },
    ...[...classSpecificKeys].map((k) => ({
      key: `class_specific_${k}`,
      label: { fr: k, en: k },
      kind: "value" as const,
    })),
    ...[...spellcastingKeys].map((k) => ({
      key: `spellcasting_${k}`,
      label: { fr: k, en: k },
      kind: "value" as const,
    })),
  ];

  const rows = ownLevels.map((lvl) => {
    const row: Record<string, unknown> = {
      level: lvl.level,
      prof_bonus: lvl.prof_bonus,
      features: Array.isArray(lvl.features)
        ? (lvl.features as SrdRecord[]).map((f) => {
            const key = String(f.index);
            return { feature: remapFeatureKey.get(key) ?? key };
          })
        : [],
    };
    const classSpecific = (lvl.class_specific as SrdRecord | undefined) ?? {};
    for (const k of classSpecificKeys) row[`class_specific_${k}`] = classSpecific[k];
    const spellcasting = (lvl.spellcasting as SrdRecord | undefined) ?? {};
    for (const k of spellcastingKeys) row[`spellcasting_${k}`] = spellcasting[k];
    return row;
  });

  const data = { max_level: 20, columns, rows };
  validateBlockData("class_progression", data);
  return {
    block_type: "class_progression",
    display: { label: "Progression", layout: "progression_table" },
    data,
    display_order: 200,
  };
}

// --------------------------------------------------------------------
// entry_type par categorie SRD, et split de Equipment par equipment_category
// --------------------------------------------------------------------

const CATEGORY_ENTRY_TYPE: Record<string, EntryType> = {
  Spells: "spell",
  "Magic-Items": "item",
  Poisons: "item",
  Classes: "class",
  Subclasses: "subclass",
  Features: "feature",
  Feats: "feature",
  Traits: "feature",
  Monsters: "monster",
  Conditions: "condition",
  Rules: "rule",
  "Rule-Sections": "rule",
  Backgrounds: "background",
  Races: "species",
  Subraces: "species",
  Species: "species",
  Subspecies: "species",
};

/**
 * 2014 porte une seule categorie (equipment_category, objet singulier),
 * 2024 en porte plusieurs (equipment_categories, tableau) — les deux formes
 * sont couvertes ici plutot que dupliquees par version de SRD.
 */
function equipmentEntryType(entry: SrdRecord): EntryType {
  const single = entry.equipment_category as SrdRecord | undefined;
  const multiple = entry.equipment_categories as SrdRecord[] | undefined;
  const names = [
    ...(single ? [single.name] : []),
    ...(multiple ? multiple.map((c) => c.name) : []),
  ].filter((n): n is string => typeof n === "string");

  if (names.some((n) => /armor|shield/i.test(n))) return "armor";
  if (names.some((n) => /weapon/i.test(n))) return "weapon";
  return "item";
}

// --------------------------------------------------------------------
// Transformation d'une entree brute -> entree typee (blocs)
// --------------------------------------------------------------------

function transformEntry(
  category: string,
  entry: SrdRecord,
  sourceAttribution: string,
  levelsByCategory: SrdRecord[] | undefined,
  remapFeatureKey: Map<string, string>
): TransformedEntry {
  const entryType: EntryType = category === "Equipment" ? equipmentEntryType(entry) : CATEGORY_ENTRY_TYPE[category];

  const blocks: EntryBlock[] = [];

  const prose = extractProse(entry);
  if (prose) {
    blocks.push(descriptionBlock(prose));
  } else if (entryType === "monster") {
    const size = entry.size;
    const type = entry.type;
    const alignment = entry.alignment;
    const ac = entry.armor_class;
    const hp = entry.hit_points;
    const hitDice = entry.hit_dice;
    const cr = entry.challenge_rating;
    blocks.push(
      descriptionBlock(
        `${String(entry.name)} — ${String(size)} ${String(type)}, ${String(alignment)}. ` +
          `CA ${JSON.stringify(ac)}, PV ${String(hp)} (${String(hitDice)}). FP ${String(cr)}.`
      )
    );
  } else {
    blocks.push(descriptionBlock(`${String(entry.name)} — voir le tableau de donnees pour le detail.`));
  }

  if (entryType === "spell") {
    blocks.push(...spellBlocks(entry));
  }

  if (entryType === "class" && levelsByCategory) {
    blocks.push(classProgressionBlock(String(entry.index), levelsByCategory, remapFeatureKey));
  }

  blocks.push(customTableBlock(entry));

  const digestSource = prose ?? String(entry.name);
  const ai_digest = truncateForDigest(`${String(entry.name)} (${entryType}) — ${digestSource}`);

  return {
    entry_key: String(entry.index),
    entry_type: entryType,
    ai_digest,
    source_attribution: sourceAttribution,
    source_raw: entry,
    blocks,
    refs: extractDerivedRefs(blocks),
  };
}

// --------------------------------------------------------------------
// Import d'une version du SRD
// --------------------------------------------------------------------

function readSrdFile(file: string): Record<string, SrdRecord[]> {
  const filePath = resolve(process.cwd(), file);
  return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, SrdRecord[]>;
}

interface ImportResult {
  counts: Record<EntryType, number>;
  blocksTotal: number;
  refsTotal: number;
  failures: ConversionFailure[];
}

async function importSrdVersion(config: SrdVersionConfig): Promise<ImportResult> {
  const ownData = readSrdFile(config.file);
  const raw = config.mergeWithBaseFile
    ? buildMergedDataset(readSrdFile(config.mergeWithBaseFile), ownData)
    : ownData;

  const { data: rulesetId, error: rulesetError } = await supabase.rpc("import_upsert_ruleset", {
    p_base_system: config.baseSystem,
    p_name: config.rulesetName,
  });
  if (rulesetError) throw new Error(`import_upsert_ruleset (${config.file}) : ${rulesetError.message}`);

  const levels = raw["Levels"];
  const counts: Partial<Record<EntryType, number>> = {};
  const failures: ConversionFailure[] = [];
  let blocksTotal = 0;
  let refsTotal = 0;

  // Regroupe en amont les aptitudes generiques identiques (V1-A2) : le
  // remap doit exister avant de traiter la categorie Classes, quel que soit
  // l'ordre d'iteration des categories dans le fichier source.
  const featureItems = raw["Features"];
  const featureDedup = Array.isArray(featureItems) ? dedupeFeatures(featureItems) : undefined;
  if (featureDedup) {
    const dedupedCount = featureItems!.length - featureDedup.canonicalEntries.length;
    if (dedupedCount > 0) {
      console.log(
        `  aptitudes generiques : ${featureItems!.length} entrees -> ${featureDedup.canonicalEntries.length} fiches (${dedupedCount} doublons fusionnes)`
      );
    }
  }
  const remapFeatureKey = featureDedup?.canonicalKeyByOriginalKey ?? new Map<string, string>();

  // Deux passes : la premiere transforme tout et desambiguise les
  // collisions d'entry_key entre categories (le SRD a par exemple a la
  // fois un background et un monstre nommes "Acolyte" — meme index, types
  // differents). La cle canonique reste stable et deterministe : seule
  // l'entree en collision recoit un suffixe de type, jamais la premiere
  // rencontree dans l'ordre naturel du fichier.
  const byCategory: { category: string; entries: TransformedEntry[] }[] = [];
  const seenKeys = new Set<string>();

  for (const [category, items] of Object.entries(raw)) {
    if (SKIPPED_CATEGORIES.has(category)) continue;
    if (!Array.isArray(items)) continue;
    const isMapped = category === "Equipment" || category in CATEGORY_ENTRY_TYPE;
    if (!isMapped) continue;

    const sourceItems = category === "Features" && featureDedup ? featureDedup.canonicalEntries : items;

    const transformed: TransformedEntry[] = [];
    for (const item of sourceItems) {
      try {
        const t = transformEntry(category, item, config.sourceAttribution, levels, remapFeatureKey);
        transformed.push(t);
        blocksTotal += t.blocks.length;
        refsTotal += t.refs.length;
      } catch (err) {
        failures.push({
          rulesetFile: config.file,
          category,
          entryKey: String(item.index ?? "?"),
          entryName: String(item.name ?? "?"),
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    for (const t of transformed) {
      if (seenKeys.has(t.entry_key)) {
        const disambiguated = `${t.entry_key}-${t.entry_type}`;
        console.warn(
          `  collision d'entry_key '${t.entry_key}' (categorie ${category}) -> renomme en '${disambiguated}'`
        );
        t.entry_key = disambiguated;
      }
      seenKeys.add(t.entry_key);
      counts[t.entry_type] = (counts[t.entry_type] ?? 0) + 1;
    }

    byCategory.push({ category, entries: transformed });
  }

  for (const { category, entries } of byCategory) {
    if (entries.length === 0) continue;
    const { error } = await supabase.rpc("import_srd_entries", {
      p_ruleset_id: rulesetId,
      p_entries: entries,
    });
    if (error) {
      throw new Error(`import_srd_entries (${config.file}, ${category}) : ${error.message}`);
    }
  }

  // Purge les entry_key qui n'existent plus dans ce jeu de donnees (ex :
  // les anciennes variantes par classe d'une aptitude generique, fusionnees
  // par dedupeFeatures) — sans ca, rejouer l'import laisserait des fiches
  // mortes en base indefiniment (blocs et traductions cascadent avec elles).
  const { data: prunedCount, error: pruneError } = await supabase.rpc("import_prune_stale_entries", {
    p_ruleset_id: rulesetId,
    p_valid_keys: [...seenKeys],
  });
  if (pruneError) throw new Error(`import_prune_stale_entries (${config.file}) : ${pruneError.message}`);
  if (typeof prunedCount === "number" && prunedCount > 0) {
    console.log(`  fiches obsoletes retirees : ${prunedCount}`);
  }

  return { counts: counts as Record<EntryType, number>, blocksTotal, refsTotal, failures };
}

async function main() {
  console.log("Import SRD — aucune donnee hors data/srd/srd-2014.json / data/srd/srd-2024.json n'est consultee.\n");

  const allFailures: ConversionFailure[] = [];

  for (const config of SRD_VERSIONS) {
    console.log(`--- ${config.rulesetName} ---`);
    const { counts, blocksTotal, refsTotal, failures } = await importSrdVersion(config);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    for (const [entryType, count] of Object.entries(counts).sort()) {
      console.log(`  ${entryType.padEnd(12)} ${count}`);
    }
    console.log(`  ${"total".padEnd(12)} ${total}`);
    console.log(`  ${"blocs".padEnd(12)} ${blocksTotal}`);
    console.log(`  ${"renvois".padEnd(12)} ${refsTotal}`);
    console.log(`  ${"echecs".padEnd(12)} ${failures.length}\n`);
    allFailures.push(...failures);
  }

  if (allFailures.length > 0) {
    console.log(`--- Echecs de conversion (${allFailures.length}) ---`);
    for (const f of allFailures) {
      console.log(`  [${f.rulesetFile}] ${f.category}/${f.entryKey} ("${f.entryName}") : ${f.message}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Aucun echec de conversion.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
