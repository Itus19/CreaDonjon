import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabase/server";
import type { Database, Json } from "@/src/types/database";
import {
  dataSchemaForBlockType,
  validateBlockData,
  zWeaponBlockData,
  type AddEntryPayload,
  type BackgroundBlockData,
  type BackgroundEquipmentItem,
  type BackgroundEquipmentOption,
  type BlockType,
  type ClassEquipmentBlockData,
  type ClassProgressionBlockData,
  type EffectsBlockData,
  type EntryType,
  type ItemPropertiesBlockData,
  type ReferencePrimitive,
  type ScalingBlockData,
  type SpeciesTraitsBlockData,
  type StatBlockBlockData,
  type SubclassSlotBlockData,
  type WeaponBlockData,
  zAddEntryPayload,
  zBlockDisplay,
} from "@/src/core/schemas/rule-blocks";
import { generateScalingTable, resolveScalingTarget } from "@/src/core/rules/scaling";
import { computeProgressionRows } from "@/src/core/rules/progression";
import { missingRequiredBlocks } from "@/src/core/rules/requiredBlocks";
import { nextSlugCandidate, slugify } from "@/src/core/slug/slug";
import {
  applyOverrides,
  mergeHomebrewEntries,
  MAX_RULESET_CHAIN_DEPTH,
  RulesetChainCycleError,
  RulesetChainDepthError,
  type OverrideInput,
  type ResolvableBlock,
  type ResolvableEntry,
} from "@/src/core/rules/resolve";
import {
  deleteRuleset,
  getEntryTranslation,
  getOfficialBaseRulesetId,
  getRulesetById,
  getRulesetEntryByKey,
  getRulesetEntryByKeyAcrossRulesets,
  getRulesetEntriesByKeysAcrossRulesets,
  insertRulesetVariant,
  listBlocksForRulesetEntry,
  listBlocksForRulesetEntries,
  listEntryLevelOverridesForRuleset,
  listEntryTranslationsWithBlocks,
  listIncomingRefsForKey,
  listOutgoingRefs,
  listOverridesForRuleset,
  listOverridesAcrossRulesets,
  listOverridesAcrossRulesetsForKeys,
  listRulesetEntries,
  listRulesetEntriesByKeys,
  listSelectableRulesets,
  listTranslationsForEntries,
  upsertRulesetOverride,
  type DeleteRulesetOutcome,
  type SelectableRulesetRow,
  type RulesetEntryRow,
  type RulesetOverrideRow,
} from "@/src/server/repos/rules";
import { getWorldDefaultRulesetId, setWorldDefaultRuleset } from "@/src/server/repos/worlds";
import { listCampaignsForWorld, updateCampaignRuleset } from "@/src/server/repos/campaigns";
import { getWorldBySlug } from "@/src/server/services/worlds";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

const SLOT_LEVEL_MAX = 9;
const CHARACTER_LEVEL_MAX = 20;

export interface RulesetChainLink {
  rulesetId: string;
  parentRulesetId: string | null;
  /** V1-D5, specs/ruleset-personnel.md — sert a marquer une fiche "reference personnelle" quand une surcharge de ce niveau la touche reellement. */
  contentOrigin: string;
}

/**
 * Chaine de heritage d'un ruleset, du plus specifique (celui du monde) au
 * plus ancestral (l'officiel, en general) — feuille -> racine. Detection de
 * cycle explicite (V1-A4, SCHEMA.md §9.4) : un ensemble visite, pas
 * seulement la borne de profondeur, pour distinguer une vraie boucle
 * (erreur) d'une chaine simplement longue (erreur differente).
 *
 * `React.cache()` (audit de performance, retour utilisateur) — meme motif
 * que `getAuthUser`/`getWorldBySlug` (lib/supabase/server.ts, worlds.ts) :
 * borne a UNE seule requete, ne fait un hit que parce que `supabase`
 * (createClient(), deja memoise) est un objet reference-stable sur cette
 * requete. Sans ceci, `resolveEntryBlocksInRuleset` — la fonction la plus
 * reutilisee du moteur mecanique (equipement, dons, modificateurs, appelee
 * une fois par cle pour chaque objet d'un inventaire) — re-marchait
 * integralement la MEME chaine (autant de requetes sequentielles que de
 * niveaux d'heritage) a chaque cle resolue, alors qu'elle est identique
 * pour tout un calcul de fiche de personnage.
 */
export const walkRulesetChain = cache(async function walkRulesetChain(supabase: TypedClient, startRulesetId: string): Promise<RulesetChainLink[]> {
  const chain: RulesetChainLink[] = [];
  const visited = new Set<string>();
  let currentId: string | null = startRulesetId;

  while (currentId) {
    if (visited.has(currentId)) throw new RulesetChainCycleError(currentId);
    visited.add(currentId);
    if (chain.length >= MAX_RULESET_CHAIN_DEPTH) throw new RulesetChainDepthError();

    const ruleset = await getRulesetById(supabase, currentId);
    if (!ruleset) break;
    chain.push({ rulesetId: currentId, parentRulesetId: ruleset.parent_ruleset_id, contentOrigin: ruleset.content_origin });
    currentId = ruleset.parent_ruleset_id;
  }

  return chain;
});

/**
 * Un monde variante n'a d'entrees que pour ce qu'il surcharge (V1-A4) —
 * aujourd'hui zero, tant que les surcharges ne sont pas construites. Sans
 * remonter au parent, aucune fiche de regle n'existe jamais pour un monde
 * dont le ruleset par defaut est une variante. Remonter n'est pas encore
 * de la resolution de surcharge (pas de patch/replace/disable appliques
 * ici) : c'est le minimum pour qu'un ruleset "sans rien a soi" ait un sens.
 */
export async function findEntryInRulesetChain(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string
): Promise<RulesetEntryRow | null> {
  let currentId: string | null = rulesetId;
  for (let hop = 0; currentId && hop < MAX_RULESET_CHAIN_DEPTH; hop++) {
    const entry = await getRulesetEntryByKey(supabase, currentId, entryKey);
    if (entry) return entry;
    const ruleset = await getRulesetById(supabase, currentId);
    currentId = ruleset?.parent_ruleset_id ?? null;
  }
  return null;
}

export interface ResolvedEntryBlocks {
  entryType: EntryType;
  /** Donnee de chaque bloc deja validee par son schema Zod, indexee par block_type — jamais la ligne brute. */
  blocksByType: Map<string, unknown>;
  /**
   * Nom de l'entree, JAMAIS traduit (contrairement a `getRuleEntryForWorld`,
   * qui n'appelle pas cette fonction et gere sa propre traduction) : pour
   * une fiche maison, `homebrewName` (charge utile `add_entry`, meme lecture
   * que `getRuleEntryForWorld`) — jamais de traduction possible, une fiche
   * maison n'en a par definition aucune. Pour une fiche officielle,
   * `entryNameFrom(entry)` (le nom source, anglais ou francais selon le
   * SRD importe) — les appelants mecaniques (`resolvedRuleset.ts`) qui ont
   * besoin d'un nom traduit continuent de le faire eux-memes, comme avant.
   * `null` si l'entree n'existe nulle part.
   */
  name: string | null;
}

/**
 * Cherche une regle par cle a travers toute une chaine deja resolue, en une
 * seule requete (audit de performance, retour utilisateur) — remplace un
 * `getRulesetEntryByKey` appele niveau par niveau, sequentiellement,
 * jusqu'a trouver une reponse. `chain` reste feuille -> racine : on garde
 * la ligne du ruleset le PLUS specifique parmi celles renvoyees, exactement
 * le comportement de l'ancienne boucle qui s'arretait au premier trouve.
 * Partagee par `resolveEntryBlocksInRuleset` et `getRuleEntryForWorld`, les
 * deux consommateurs de ce motif.
 */
async function entryFromChainByKey(supabase: TypedClient, chain: RulesetChainLink[], entryKey: string): Promise<RulesetEntryRow | null> {
  const candidates = await getRulesetEntryByKeyAcrossRulesets(
    supabase,
    chain.map((link) => link.rulesetId),
    entryKey
  );
  if (candidates.length === 0) return null;
  const byRulesetId = new Map(candidates.map((c) => [c.ruleset_id, c]));
  for (const link of chain) {
    const found = byRulesetId.get(link.rulesetId);
    if (found) return found;
  }
  return null;
}

/**
 * Resout une entree jusqu'a ses blocs valides : base (si elle existe dans
 * la chaine) + TOUTES les surcharges de la chaine, racine -> feuille
 * (V1-A4/V1-D4) — meme moteur (`applyOverrides`) que `getRuleEntryForWorld`,
 * mais sans ses etapes d'affichage (traductions, renvois, augmentation de
 * noms) : pour les consommateurs mecaniques (`resolvedRuleset.ts`, actions
 * de jeu) qui n'ont besoin que de la donnee brute d'un bloc, jamais de sa
 * mise en page. Contrairement a `findEntryInRulesetChain` (utilise par ce
 * meme fichier pour d'autres besoins, jamais surcharge-aware), une fiche
 * qui n'existe que par une surcharge `add_entry` (aucune ligne
 * `ruleset_entries`, V1-D4) resout ici correctement. `null` si l'entree
 * n'existe nulle part dans la chaine (ni base, ni `add_entry`) ou si une
 * surcharge l'a desactivee.
 */
/**
 * Coeur partage entre `resolveEntryBlocksInRuleset` (une cle) et
 * `resolveEntryBlocksInRulesetBatch` (plusieurs) — assemble une entree deja
 * trouvee + ses blocs + ses surcharges (deja groupees par ruleset) en
 * `ResolvedEntryBlocks`. Aucun acces base ici : les deux appelants font
 * leur propre fetch (single ou batch), ce coeur ne fait que la resolution
 * en memoire (`applyOverrides`).
 */
function resolveOneEntryBlocks(
  chain: RulesetChainLink[],
  entryKey: string,
  entry: RulesetEntryRow | undefined,
  blockRows: { block_type: string; display: Json; data: Json; display_order: number }[],
  overridesByRuleset: Map<string, RulesetOverrideRow[]>
): ResolvedEntryBlocks | null {
  const baseEntry: ResolvableEntry | null = entry
    ? {
        entry_key: entry.entry_key,
        entry_type: entry.entry_type,
        blocks: blockRows.map(
          (row): ResolvableBlock => ({
            block_type: row.block_type,
            display: row.display,
            data: row.data,
            display_order: row.display_order,
          })
        ),
      }
    : null;

  const overrides: OverrideInput[] = [];
  let homebrewName: string | null = null;
  for (const link of [...chain].reverse()) {
    const rows = overridesByRuleset.get(link.rulesetId) ?? [];
    for (const row of rows) {
      if (row.action === "add_entry") {
        const addEntry = zAddEntryPayload.parse(row.payload);
        homebrewName = addEntry.name;
        overrides.push({
          block_type: null,
          action: "add_entry",
          payload: { entry_key: entryKey, entry_type: addEntry.entry_type, blocks: [] } satisfies ResolvableEntry,
          patch: null,
        });
        continue;
      }
      overrides.push({
        block_type: row.block_type,
        action: row.action as OverrideInput["action"],
        payload: row.payload,
        patch: row.patch,
      });
    }
  }

  const resolved = applyOverrides(baseEntry, overrides);
  if (!resolved || resolved.disabled) return null;

  const blocksByType = new Map<string, unknown>();
  for (const block of resolved.blocks) {
    blocksByType.set(block.block_type, dataSchemaForBlockType(block.block_type as BlockType).parse(block.data));
  }

  return { entryType: resolved.entry_type as EntryType, blocksByType, name: homebrewName ?? (entry ? entryNameFrom(entry) : null) };
}

export async function resolveEntryBlocksInRuleset(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string
): Promise<ResolvedEntryBlocks | null> {
  const chain = await walkRulesetChain(supabase, rulesetId);
  const entry = await entryFromChainByKey(supabase, chain, entryKey);
  const blockRows = entry ? await listBlocksForRulesetEntry(supabase, entry.id) : [];
  const overridesByRuleset = await listOverridesAcrossRulesets(supabase, chain.map((link) => link.rulesetId), entryKey);
  return resolveOneEntryBlocks(chain, entryKey, entry ?? undefined, blockRows, overridesByRuleset);
}

/**
 * Meme resolution, PLUSIEURS cles a la fois en 3 requetes au lieu de 3×N
 * (audit de performance, retour utilisateur : "reference-chips/resolved-ruleset
 * lent") — `fetchEquipmentBlocks` (resolvedRuleset.ts) appelait
 * `resolveEntryBlocksInRuleset` une fois par objet d'inventaire, en
 * parallele (`Promise.all`) mais chacun payait quand meme son propre
 * aller-retour d'entree/blocs/surcharges.
 */
export async function resolveEntryBlocksInRulesetBatch(
  supabase: TypedClient,
  rulesetId: string,
  entryKeys: readonly string[]
): Promise<Map<string, ResolvedEntryBlocks>> {
  const result = new Map<string, ResolvedEntryBlocks>();
  const keys = [...new Set(entryKeys)];
  if (keys.length === 0) return result;

  const chain = await walkRulesetChain(supabase, rulesetId);
  const rulesetIds = chain.map((link) => link.rulesetId);

  const [entries, overridesByKey] = await Promise.all([
    getRulesetEntriesByKeysAcrossRulesets(supabase, rulesetIds, keys),
    listOverridesAcrossRulesetsForKeys(supabase, rulesetIds, keys),
  ]);

  // Une entree par cle : celle du ruleset le plus specifique (chain est
  // feuille -> racine) parmi celles trouvees pour cette cle.
  const entryByKey = new Map<string, RulesetEntryRow>();
  for (const link of chain) {
    for (const row of entries) {
      if (row.ruleset_id === link.rulesetId && !entryByKey.has(row.entry_key)) entryByKey.set(row.entry_key, row);
    }
  }

  const entryIds = [...entryByKey.values()].map((e) => e.id);
  const allBlockRows = await listBlocksForRulesetEntries(supabase, entryIds);
  const blockRowsByEntryId = new Map<string, typeof allBlockRows>();
  for (const row of allBlockRows) {
    const list = blockRowsByEntryId.get(row.entry_id) ?? [];
    list.push(row);
    blockRowsByEntryId.set(row.entry_id, list);
  }

  for (const key of keys) {
    const entry = entryByKey.get(key);
    const blockRows = entry ? (blockRowsByEntryId.get(entry.id) ?? []) : [];
    const overridesByRuleset = overridesByKey.get(key) ?? new Map<string, RulesetOverrideRow[]>();
    const resolved = resolveOneEntryBlocks(chain, key, entry, blockRows, overridesByRuleset);
    if (resolved) result.set(key, resolved);
  }

  return result;
}

export interface RuleEntryBlockView {
  id: string;
  blockType: BlockType;
  display: { label: string; layout: string; collapsed?: boolean };
  data: unknown;
  displayOrder: number;
  /** Donnee avant surcharge (V1-A4) — present seulement si ce bloc est dans modifiedBlockTypes, pour le badge "modifiee dans ta variante". */
  originalData?: unknown;
}

/** Un renvoi affiche (V1-A3) : `key` designe l'AUTRE entree — la cible pour un renvoi sortant, la source pour un renvoi entrant. `entryType` absent = renvoi non resolu (cible disparue ou jamais importee). `level`/`description` (V1-D7, retour utilisateur) : uniquement pour un renvoi sortant `grants` (classe -> aptitude accordee a un niveau) — le niveau vient du `path`, le texte de la fiche visee, pour qu'un joueur voie l'effet sans quitter la fiche de classe. */
export interface RuleRefView {
  key: string;
  name: string;
  entryType: EntryType | null;
  refKind: string;
  path: string | null;
  level?: number;
  description?: string;
}

export interface RuleEntryDetail {
  id: string;
  entryKey: string;
  entryType: EntryType;
  name: string;
  sourceAttribution: string | null;
  blocks: RuleEntryBlockView[];
  missingBlocks: string[];
  outgoingRefs: RuleRefView[];
  incomingRefs: RuleRefView[];
  /** Types de blocs modifies par une surcharge de la variante courante (V1-A4) — badge "modifiee dans ta variante". */
  modifiedBlockTypes: string[];
  /** V1-D5, specs/ruleset-personnel.md — badge "reference personnelle" : au moins une surcharge d'un ruleset personal_reference de la chaine touche reellement cette fiche. */
  personalReference: boolean;
  /** Fiche maison (V1-D4, `add_entry` sans aucune ligne de base dans la chaine officielle) — n'existe QUE par surcharge, jamais materialisee dans `ruleset_entries`. Seule condition pour proposer "Supprimer cette fiche" : une fiche officielle ou heritee reste intouchable. */
  isHomebrew: boolean;
}

function maxLevelForAxis(axis: ScalingBlockData["axis"]): number {
  return axis === "slot_level" ? SLOT_LEVEL_MAX : CHARACTER_LEVEL_MAX;
}

export function entryNameFrom(entry: { entry_key: string; source_raw: unknown }): string {
  const sourceRaw = entry.source_raw as { name?: unknown } | null;
  const name = sourceRaw && typeof sourceRaw.name === "string" ? sourceRaw.name : null;
  return name ?? entry.entry_key;
}

/**
 * Renvois sortants d'une fiche, prets a afficher (V1-A3). Les cles cibles
 * sont resolues en un seul lot dans le ruleset courant — le cas normal tant
 * que les surcharges (V1-A4) n'existent pas — puis, pour les cles absentes
 * du lot, une par une via la remontee de chaine (rare : cible d'un ruleset
 * parent, ou renvoi non resolu si elle n'existe nulle part).
 */
async function resolveOutgoingRefs(
  supabase: TypedClient,
  rulesetId: string,
  rulesetEntryId: string,
  locale: Locale
): Promise<RuleRefView[]> {
  const refs = await listOutgoingRefs(supabase, rulesetEntryId);
  if (refs.length === 0) return [];

  const targetKeys = [...new Set(refs.map((r) => r.target_key))];
  const batched = await listRulesetEntriesByKeys(supabase, rulesetId, targetKeys);
  const byKey = new Map(batched.map((e) => [e.entry_key, e]));

  // Cible sans ligne de base nulle part dans la chaine : fiche maison
  // (`add_entry`, V1-D4) resolue a part, `RulesetEntryRow` n'a pas de forme
  // pour elle (pas d'id ni de `source_raw`) — voir `resolveHomebrewEntryDisplay`.
  const homebrewByKey = new Map<string, { name: string; entryType: EntryType }>();
  for (const key of targetKeys) {
    if (byKey.has(key)) continue;
    const found = await findEntryInRulesetChain(supabase, rulesetId, key);
    if (found) {
      byKey.set(key, found);
      continue;
    }
    const homebrew = await resolveHomebrewEntryDisplay(supabase, rulesetId, key);
    if (homebrew) homebrewByKey.set(key, { name: homebrew.name, entryType: homebrew.entryType });
  }

  const translationByEntryId = new Map<string, string>();
  if (locale !== "en" && byKey.size > 0) {
    const translations = await listTranslationsForEntries(
      supabase,
      [...byKey.values()].map((e) => e.id),
      locale
    );
    for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
  }

  // V1-D7 (retour utilisateur) : un renvoi "grants" (le seul produit
  // aujourd'hui, cf. extractDerivedRefs) affiche aussi le texte de
  // l'aptitude visee et son niveau dans le panneau de renvois sortants, pour
  // qu'un joueur voie l'effet sans quitter la fiche de classe. Uniquement ce
  // ref_kind : un futur ref_kind sans niveau/texte pertinent (requires,
  // see_also...) resterait un simple nom.
  const grantsKeys = [...new Set(refs.filter((r) => r.ref_kind === "grants").map((r) => r.target_key))];
  const grantsDescriptions = new Map(
    (
      await Promise.all(
        grantsKeys.map(async (key) => [key, await resolveEntryDetail(supabase, rulesetId, key, locale)] as const)
      )
    ).map(([key, detail]) => [key, detail?.description])
  );

  return refs.map((ref) => {
    const target = byKey.get(ref.target_key);
    const homebrewTarget = target ? undefined : homebrewByKey.get(ref.target_key);
    const levelMatch = ref.ref_kind === "grants" ? ref.path?.match(/rows\[(\d+)\]/) : null;
    return {
      key: ref.target_key,
      name: target
        ? (translationByEntryId.get(target.id) ?? entryNameFrom(target))
        : (homebrewTarget?.name ?? ref.target_key),
      entryType: target ? (target.entry_type as EntryType) : (homebrewTarget?.entryType ?? null),
      refKind: ref.ref_kind,
      path: ref.path,
      level: levelMatch ? Number(levelMatch[1]) : undefined,
      description: grantsDescriptions.get(ref.target_key) || undefined,
    };
  });
}

/** Renvois entrants vers une fiche, prets a afficher (V1-A3) : tout ce qui la cite. */
async function resolveIncomingRefs(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string,
  locale: Locale
): Promise<RuleRefView[]> {
  const refs = await listIncomingRefsForKey(supabase, rulesetId, entryKey);
  if (refs.length === 0) return [];

  const translationByEntryId = new Map<string, string>();
  if (locale !== "en") {
    const translations = await listTranslationsForEntries(
      supabase,
      refs.map((r) => r.source_entry_id),
      locale
    );
    for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
  }

  return refs.map((ref) => ({
    key: ref.source_entry_key,
    name:
      translationByEntryId.get(ref.source_entry_id) ??
      entryNameFrom({ entry_key: ref.source_entry_key, source_raw: ref.source_source_raw }),
    entryType: ref.source_entry_type as EntryType,
    refKind: ref.ref_kind,
    path: ref.path,
  }));
}

/**
 * `background.feat` (V1-D7) augmente de son propre nom et de sa propre
 * description au moment de la lecture — jamais stocke ainsi (le bloc en
 * base ne porte que la reference `{kind, key}`), memes noms que
 * `BackgroundBlockData` en plus. Portee volontairement limitee a ce seul
 * bloc : le mecanisme general de renvois (`outgoingRefs`/`RuleRefView`) ne
 * transporte que des noms, jamais de texte de description, et l'etendre
 * pour ce seul besoin aurait touche le panneau de renvois existant pour
 * rien — cf. plan approuve, ne pas generaliser sans un deuxieme cas concret.
 */
export type ResolvedBackgroundEquipmentItem = BackgroundEquipmentItem & {
  resolved_label: string;
  /** Membres reels d'une categorie "au choix" (V2-G1, retour utilisateur), pour la liste deroulante du joueur — absent si `category_options` l'etait deja. */
  resolved_category_options?: { key: string; resolved_label: string }[];
};
export type ResolvedBackgroundEquipmentOption = Omit<BackgroundEquipmentOption, "items"> & {
  items: ResolvedBackgroundEquipmentItem[];
};
export type ResolvedBackgroundBlockData = Omit<BackgroundBlockData, "equipment_options"> & {
  feat_name: string;
  feat_description: string;
  equipment_options: ResolvedBackgroundEquipmentOption[];
};

/**
 * `class_equipment.fixed`/`.choices[].options` (V2-G1, point 9 du retour
 * utilisateur) augmentes du nom resolu de chaque objet reference, meme
 * motif exact que `ResolvedBackgroundBlockData` ci-dessus (memes types
 * d'item/d'option, reutilises tels quels — un choix d'equipement de classe
 * n'est jamais qu'un choix d'historique avec plusieurs choix INDEPENDANTS
 * au lieu d'un seul, pas une forme differente).
 */
export type ResolvedClassEquipmentBlockData = {
  fixed: ResolvedBackgroundEquipmentItem[];
  choices: { options: ResolvedBackgroundEquipmentOption[] }[];
};

/**
 * `subclass_slot.options` (V1-D7, retour utilisateur : le lien de chaque
 * sous-classe affichait sa cle technique brute, ex. "evoker") augmente d'un
 * nom resolu par option, meme motif que `ResolvedBackgroundBlockData`
 * ci-dessus — jamais stocke ainsi, calcule a la lecture.
 */
export type ResolvedSubclassSlotBlockData = Omit<SubclassSlotBlockData, "options"> & {
  options?: (ReferencePrimitive & { resolved_name: string })[];
};

/**
 * `weapon.properties`/`weapon.mastery` (V1-D7, retour utilisateur : d'abord
 * un simple lien, puis "il faut que ça soit directement visible sur la
 * fiche" — meme niveau de detail que `feat_name`/`feat_description` du bloc
 * `background`) augmentes du nom ET du texte de chaque propriete/botte,
 * jamais dupliques en base : lus a la lecture depuis leur propre fiche
 * `feature` existante (V1-C12/V1-D7), meme motif que `resolveEntryDetail`.
 */
export type ResolvedWeaponBlockData = Omit<WeaponBlockData, "properties" | "mastery"> & {
  properties: (ReferencePrimitive & { resolved_name: string; resolved_description: string })[];
  mastery?: ReferencePrimitive & { resolved_name: string; resolved_description: string };
};

/**
 * `species_traits.traits` (V1-D7, retour utilisateur — meme niveau de
 * detail que les proprietes d'arme ci-dessus) augmentes du nom ET de la
 * description de chaque trait, jamais dupliques en base.
 */
export type ResolvedSpeciesTraitsBlockData = Omit<SpeciesTraitsBlockData, "traits"> & {
  traits: (ReferencePrimitive & { resolved_name: string; resolved_description: string })[];
};

/**
 * `item_properties.contents` (V1-D7, passe Objet — paquetages d'aventurier)
 * augmente du nom resolu de chaque objet contenu, meme motif que
 * `background.equipment_options[].items` : seul le nom est necessaire (pas
 * de description imbriquee, contrairement a `weapon`/`species_traits`), donc
 * `resolveEntryNames` suffit plutot que `resolveEntryDetails`.
 */
export type ResolvedItemPropertiesBlockData = Omit<ItemPropertiesBlockData, "contents"> & {
  contents?: { ref?: ReferencePrimitive; label: string; quantity: number; resolved_label: string }[];
};

/**
 * Nom + type d'une entree qui n'existe QUE par une surcharge `add_entry`
 * d'un ruleset de la chaine (V1-D4/V1-D8) — jamais de ligne
 * `ruleset_entries`. Complement de `findEntryInRulesetChain`, qui ne
 * regarde que la base : a appeler seulement apres son echec, jamais en
 * remplacement (le cas courant reste une entree officielle ou heritee).
 * Bug reel trouve en verifiant en direct : sans ceci, toute fiche maison
 * CIBLEE par la reference d'une autre fiche maison (ex: le don d'un
 * historique personnalise, tous deux crees par le meme import) affichait sa
 * cle technique brute au lieu de son nom — `findEntryInRulesetChain` ne
 * trouvait rien, faute de ligne de base, alors que la fiche de l'entree
 * elle-meme se resout correctement via `getRuleEntryForWorld` (qui, lui,
 * applique deja les surcharges). Reutilise `resolveEntryBlocksInRuleset`
 * (deja override-aware) pour le type et le bloc description plutot que de
 * dupliquer la boucle base+surcharges une troisieme fois ; seule la
 * recherche du nom (porte par la charge utile `add_entry`, absente de ce
 * que renvoie `resolveEntryBlocksInRuleset`) est refaite ici.
 */
export async function resolveHomebrewEntryDisplay(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string
): Promise<{ name: string; entryType: EntryType; description: string } | null> {
  const resolved = await resolveEntryBlocksInRuleset(supabase, rulesetId, entryKey);
  if (!resolved) return null;

  const chain = await walkRulesetChain(supabase, rulesetId);
  const overridesByRuleset = await listOverridesAcrossRulesets(supabase, chain.map((link) => link.rulesetId), entryKey);
  let name: string | null = null;
  for (const link of chain) {
    const rows = overridesByRuleset.get(link.rulesetId) ?? [];
    const addEntryRow = rows.find((r) => r.action === "add_entry");
    if (addEntryRow) {
      name = zAddEntryPayload.parse(addEntryRow.payload).name;
      break;
    }
  }
  // `resolved` non-null sans `add_entry` trouve signifierait une entree de
  // base normale (pas homebrew) : ne devrait pas arriver, l'appelant ne
  // passe ici qu'apres l'echec de `findEntryInRulesetChain`.
  if (name === null) return null;

  const descriptionData = resolved.blocksByType.get("description") as { segments?: { text: string }[] } | undefined;
  const description = descriptionData?.segments?.map((s) => s.text).join("\n\n") ?? "";

  return { name, entryType: resolved.entryType, description };
}

/**
 * Nom + description (deja traduite si `locale !== "en"`) d'une entree
 * quelconque de la chaine de ruleset. `null` seulement si la cle ne resout
 * dans aucun ruleset de la chaine (donnee source incoherente) — l'appelant
 * retombe alors sur la cle brute plutot que d'echouer la fiche entiere pour
 * un seul champ manquant. Utilise par `background.feat` (nom d'origine,
 * resolveFeatDetail) et par l'enrichissement des renvois "grants" du
 * panneau de renvois sortants (V1-D7, retour utilisateur) — generalisee au
 * deuxieme cas concret plutot que dupliquee.
 */
async function resolveEntryDetail(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string,
  locale: Locale
): Promise<{ name: string; description: string } | null> {
  const featEntry = await findEntryInRulesetChain(supabase, rulesetId, entryKey);
  if (!featEntry) return resolveHomebrewEntryDisplay(supabase, rulesetId, entryKey);

  const translation = locale !== "en" ? await getEntryTranslation(supabase, featEntry.id, locale) : null;
  const translatedBlocks = (translation?.blocks ?? {}) as Record<string, unknown>;

  let description = "";
  const translatedDescription = translatedBlocks.description as { segments?: { text: string }[] } | undefined;
  if (translatedDescription?.segments) {
    description = translatedDescription.segments.map((s) => s.text).join("\n\n");
  } else {
    const blockRows = await listBlocksForRulesetEntry(supabase, featEntry.id);
    const descriptionRow = blockRows.find((b) => b.block_type === "description");
    const data = descriptionRow?.data as { segments?: { text: string }[] } | undefined;
    description = data?.segments?.map((s) => s.text).join("\n\n") ?? "";
  }

  return { name: translation?.name ?? entryNameFrom(featEntry), description };
}

/**
 * `resolveEntryDetail` sur un lot de cles uniques, en parallele (V1-D7,
 * troisieme appelant apres `weapon` et `species_traits` — generalise plutot
 * que duplique une troisieme fois, meme raison que `resolveEntryDetail`
 * lui-meme). Peu de cles par appelant (1 a 10), un `Promise.all` suffit,
 * pas besoin du lot SQL batche de `resolveEntryNames`.
 */
async function resolveEntryDetails(
  supabase: TypedClient,
  rulesetId: string,
  keys: string[],
  locale: Locale
): Promise<Map<string, { name: string; description: string } | null>> {
  const uniqueKeys = [...new Set(keys)];
  const entries = await Promise.all(
    uniqueKeys.map(async (key) => [key, await resolveEntryDetail(supabase, rulesetId, key, locale)] as const)
  );
  return new Map(entries);
}

/**
 * Nom (deja traduit si `locale !== "en"`) de chaque cle donnee, resolue
 * dans le ruleset ou sa chaine — meme lot batche + repli chaine que
 * `resolveOutgoingRefs`, extrait ici pour etre reutilise par
 * `background.equipment_options[].items[].ref` (V1-D7) sans dupliquer la
 * logique. Une cle absente du resultat n'a pas de fiche resoluble ;
 * l'appelant retombe alors sur le libelle fige ecrit a l'import.
 */
async function resolveEntryNames(
  supabase: TypedClient,
  rulesetId: string,
  keys: string[],
  locale: Locale
): Promise<Map<string, string>> {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) return new Map();

  const batched = await listRulesetEntriesByKeys(supabase, rulesetId, uniqueKeys);
  const byKey = new Map(batched.map((e) => [e.entry_key, e]));
  for (const key of uniqueKeys) {
    if (byKey.has(key)) continue;
    const found = await findEntryInRulesetChain(supabase, rulesetId, key);
    if (found) byKey.set(key, found);
  }

  const translationByEntryId = new Map<string, string>();
  if (locale !== "en" && byKey.size > 0) {
    const translations = await listTranslationsForEntries(supabase, [...byKey.values()].map((e) => e.id), locale);
    for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
  }

  const result = new Map<string, string>();
  for (const key of uniqueKeys) {
    const entry = byKey.get(key);
    if (entry) result.set(key, translationByEntryId.get(entry.id) ?? entryNameFrom(entry));
  }

  // Cles restantes : aucune ligne de base nulle part dans la chaine — le
  // cas d'une fiche maison (`add_entry` sans base, V1-D4), voir
  // `resolveHomebrewEntryDisplay`. Pas de traduction pour ces fiches, meme
  // convention que `getRuleEntryForWorld.homebrewName`.
  for (const key of uniqueKeys) {
    if (result.has(key)) continue;
    const homebrew = await resolveHomebrewEntryDisplay(supabase, rulesetId, key);
    if (homebrew) result.set(key, homebrew.name);
  }
  return result;
}

/**
 * Assemble une fiche de regle complete pour l'affichage : resout le
 * ruleset du monde, trouve l'entree, valide chaque bloc via son schema
 * (le moteur ne recoit jamais une forme non garantie), engendre la table
 * du bloc scaling a partir de sa regle quand il en a une, calcule les
 * colonnes formule d'un class_progression, et signale les blocs requis
 * manquants sans jamais rejeter l'entree (specs/regles-blocs.md §5-§7).
 */
export async function getRuleEntryForWorld(
  supabase: TypedClient,
  worldId: string,
  entryKey: string,
  locale: Locale
): Promise<RuleEntryDetail | null> {
  const rulesetId = await getWorldDefaultRulesetId(supabase, worldId);
  if (!rulesetId) return null;

  const chain = await walkRulesetChain(supabase, rulesetId);
  const entry = await entryFromChainByKey(supabase, chain, entryKey);

  // L'anglais est deja la langue source (source_raw.name) : aucune
  // recherche de traduction n'est necessaire pour cette locale. Une fiche
  // maison (V1-D4, `entry` absent de toute base de la chaine) n'a par
  // definition ni traduction ni bloc en base — son contenu voyage entier
  // dans les surcharges collectees plus bas.
  const translation = entry && locale !== "en" ? await getEntryTranslation(supabase, entry.id, locale) : null;
  const blockRows = entry ? await listBlocksForRulesetEntry(supabase, entry.id) : [];
  // Surcharges de traduction par block_type (V1-A5, ex: description) : posees
  // sur la base AVANT resolution des surcharges de variante, pour qu'une
  // surcharge de variante (ecrite par un MJ, potentiellement dans une autre
  // langue) l'emporte toujours si elle vise le meme bloc.
  const translatedBlocks = (translation?.blocks ?? {}) as Record<string, unknown>;
  const baseEntry: ResolvableEntry | null = entry
    ? {
        entry_key: entry.entry_key,
        entry_type: entry.entry_type,
        blocks: blockRows.map(
          (row): ResolvableBlock => ({
            block_type: row.block_type,
            display: row.display,
            data: translatedBlocks[row.block_type] ?? row.data,
            display_order: row.display_order,
          })
        ),
      }
    : null;

  // Surcharges collectees racine -> feuille (chain est feuille -> racine) :
  // la variante la plus specifique s'applique en dernier (SCHEMA.md §9.4).
  // `add_entry` porte une charge utile courte (`zAddEntryPayload` : nom +
  // type, V1-D4) — traduite ici en la forme `ResolvableEntry` complete
  // (cle + type + blocs vides, les blocs arrivent par des `add_block`
  // separes) qu'attend `applyOverrides`, pour que le coeur pur reste
  // ignorant de ce detail d'encodage.
  const overrides: OverrideInput[] = [];
  let homebrewName: string | null = null;
  // V1-D5, specs/ruleset-personnel.md : le badge "reference personnelle" ne
  // marque que les fiches reellement touchees par une surcharge d'un niveau
  // personal_reference — jamais une fiche purement heritee de la base
  // officielle qu'on regarde "a travers" une telle variante (une variante
  // personal_reference peut tres bien ne rien surcharger sur telle entree).
  let personalReference = false;
  const overridesByRuleset = await listOverridesAcrossRulesets(supabase, chain.map((link) => link.rulesetId), entryKey);
  for (const link of [...chain].reverse()) {
    const rows = overridesByRuleset.get(link.rulesetId) ?? [];
    if (rows.length > 0 && link.contentOrigin === "personal_reference") personalReference = true;
    for (const row of rows) {
      if (row.action === "add_entry") {
        const addEntry = zAddEntryPayload.parse(row.payload);
        homebrewName = addEntry.name;
        overrides.push({
          block_type: null,
          action: "add_entry",
          payload: { entry_key: entryKey, entry_type: addEntry.entry_type, blocks: [] } satisfies ResolvableEntry,
          patch: null,
        });
        continue;
      }
      overrides.push({
        block_type: row.block_type,
        action: row.action as OverrideInput["action"],
        payload: row.payload,
        patch: row.patch,
      });
    }
  }

  const resolved = applyOverrides(baseEntry, overrides);
  // Desactivee dans cette variante : traitee comme absente, pas comme une erreur.
  // Ni base ni `add_entry` : la fiche n'existe simplement pas.
  if (!resolved || resolved.disabled) return null;

  // id stable pour l'affichage (cle React) : celui de la ligne d'origine
  // quand elle existe encore, sinon un id synthetique (bloc introduit par
  // une surcharge add_block/replace_block sans ligne source).
  const originalIdByBlockType = new Map(blockRows.map((row) => [row.block_type, row.id]));
  // Donnee avant surcharge de variante, pour le badge "modifiee" + comparaison
  // (V1-A4) — depuis baseEntry (deja traduite si une traduction existe,
  // V1-A5), pas les lignes brutes anglaises : la comparaison doit rester
  // dans la meme langue des deux cotes, seule la surcharge de variante doit
  // faire la difference. Vide pour une fiche maison : rien a comparer, elle
  // n'a pas d'"avant".
  const originalDataByBlockType = new Map((baseEntry?.blocks ?? []).map((b) => [b.block_type, b.data]));

  const validated = resolved.blocks.map((block) => ({
    id: originalIdByBlockType.get(block.block_type) ?? `override:${block.block_type}`,
    blockType: block.block_type as BlockType,
    data: dataSchemaForBlockType(block.block_type as BlockType).parse(block.data),
    displayOrder: block.display_order,
    rawDisplay: block.display,
    originalData: resolved.modifiedBlockTypes.includes(block.block_type)
      ? originalDataByBlockType.get(block.block_type)
      : undefined,
  }));

  const effectsData = validated.find((b) => b.blockType === "effects")?.data as
    | EffectsBlockData
    | undefined;

  const blocks: RuleEntryBlockView[] = validated.map(({ id, blockType, data, displayOrder, rawDisplay, originalData }) => {
    const display = zBlockDisplay.parse(rawDisplay);

    if (blockType === "scaling") {
      const scalingData = data as ScalingBlockData;
      const baseFormula = scalingData.rule
        ? resolveScalingTarget(scalingData.rule.target, effectsData)
        : undefined;
      const table = generateScalingTable(scalingData, maxLevelForAxis(scalingData.axis), baseFormula);
      return { id, blockType, display, data: { ...scalingData, table }, displayOrder, originalData };
    }

    if (blockType === "class_progression") {
      const progressionData = data as ClassProgressionBlockData;
      return {
        id,
        blockType,
        display,
        data: { ...progressionData, rows: computeProgressionRows(progressionData) },
        displayOrder,
        originalData,
      };
    }

    return { id, blockType, display, data, displayOrder, originalData };
  });

  // Le SRD porte les PX de chaque monstre (`source_raw.xp`), mais
  // l'extraction initiale du bloc `stat_block` (V1-D3b) ne l'a jamais copie
  // dans ses donnees — retour utilisateur : injecte a la lecture, jamais un
  // backfill des lignes stockees, jamais une valeur inventee si absente de
  // la source (monstres sans XP dans le SRD, rares mais existants).
  if (entry?.entry_type === "monster") {
    const rawXp = (entry.source_raw as { xp?: unknown } | null)?.xp;
    if (typeof rawXp === "number") {
      const statBlock = blocks.find((b) => b.blockType === "stat_block");
      if (statBlock) statBlock.data = { ...(statBlock.data as StatBlockBlockData), xp: rawXp };
    }
  }

  // Une fiche maison n'a pas de `ruleset_entry_refs` (la table exige un
  // `source_entry_id` reel) : aucun renvoi sortant deduit pour elle, mais
  // elle peut toujours etre visee par le renvoi ENTRANT d'une autre fiche
  // (`resolveIncomingRefs` ne prend qu'une cle, jamais un id).
  const [outgoingRefs, incomingRefs] = await Promise.all([
    entry ? resolveOutgoingRefs(supabase, rulesetId, entry.id, locale) : Promise.resolve([]),
    resolveIncomingRefs(supabase, rulesetId, entryKey, locale),
  ]);

  // Augmente le bloc `background` avec le nom+description de son don et le
  // nom de chaque objet d'equipement reference (V1-D7) — cf.
  // ResolvedBackgroundBlockData, meme motif que `scaling`/`class_progression`
  // ci-dessus (donnee calculee a la lecture, ajoutee a la forme validee).
  const backgroundBlockIndex = blocks.findIndex((b) => b.blockType === "background");
  if (backgroundBlockIndex !== -1) {
    const bgData = blocks[backgroundBlockIndex].data as BackgroundBlockData;
    const itemKeys = [
      ...bgData.equipment_options.flatMap((opt) => opt.items.flatMap((it) => (it.ref ? [it.ref.key] : []))),
      ...bgData.equipment_options.flatMap((opt) => opt.items.flatMap((it) => it.category_options?.map((c) => c.key) ?? [])),
    ];
    const [featDetail, itemNames] = await Promise.all([
      resolveEntryDetail(supabase, rulesetId, bgData.feat.key, locale),
      resolveEntryNames(supabase, rulesetId, itemKeys, locale),
    ]);
    blocks[backgroundBlockIndex] = {
      ...blocks[backgroundBlockIndex],
      data: {
        ...bgData,
        feat_name: featDetail?.name ?? bgData.feat.key,
        feat_description: featDetail?.description ?? "",
        equipment_options: bgData.equipment_options.map((opt) => ({
          ...opt,
          items: opt.items.map((it) => ({
            ...it,
            resolved_label: it.ref ? (itemNames.get(it.ref.key) ?? it.label) : it.label,
            resolved_category_options: it.category_options?.map((c) => ({ key: c.key, resolved_label: itemNames.get(c.key) ?? c.key })),
          })),
        })),
      } satisfies ResolvedBackgroundBlockData,
    };
  }

  // Augmente le bloc `class_equipment` avec le nom de chaque objet
  // reference (V2-G1, point 9) — meme motif exact que `background`
  // ci-dessus, sur `fixed` ET chaque `choices[].options[]`.
  const classEquipmentBlockIndex = blocks.findIndex((b) => b.blockType === "class_equipment");
  if (classEquipmentBlockIndex !== -1) {
    const ceData = blocks[classEquipmentBlockIndex].data as ClassEquipmentBlockData;
    const itemKeys = [
      ...ceData.fixed.flatMap((it) => (it.ref ? [it.ref.key] : [])),
      ...ceData.fixed.flatMap((it) => it.category_options?.map((c) => c.key) ?? []),
      ...ceData.choices.flatMap((c) => c.options.flatMap((opt) => opt.items.flatMap((it) => (it.ref ? [it.ref.key] : [])))),
      ...ceData.choices.flatMap((c) => c.options.flatMap((opt) => opt.items.flatMap((it) => it.category_options?.map((co) => co.key) ?? []))),
    ];
    const itemNames = await resolveEntryNames(supabase, rulesetId, itemKeys, locale);
    const resolveItem = (it: BackgroundEquipmentItem) => ({
      ...it,
      resolved_label: it.ref ? (itemNames.get(it.ref.key) ?? it.label) : it.label,
      resolved_category_options: it.category_options?.map((c) => ({ key: c.key, resolved_label: itemNames.get(c.key) ?? c.key })),
    });
    blocks[classEquipmentBlockIndex] = {
      ...blocks[classEquipmentBlockIndex],
      data: {
        fixed: ceData.fixed.map(resolveItem),
        choices: ceData.choices.map((c) => ({ options: c.options.map((opt) => ({ ...opt, items: opt.items.map(resolveItem) })) })),
      } satisfies ResolvedClassEquipmentBlockData,
    };
  }

  // Augmente le bloc `subclass_slot` avec le nom resolu de chaque option
  // (V1-D7, retour utilisateur : le lien affichait la cle technique brute,
  // ex. "evoker") — meme motif que `background` ci-dessus.
  const subclassSlotBlockIndex = blocks.findIndex((b) => b.blockType === "subclass_slot");
  if (subclassSlotBlockIndex !== -1) {
    const slotData = blocks[subclassSlotBlockIndex].data as SubclassSlotBlockData;
    const optionKeys = slotData.options?.map((o) => o.key) ?? [];
    const optionNames = await resolveEntryNames(supabase, rulesetId, optionKeys, locale);
    blocks[subclassSlotBlockIndex] = {
      ...blocks[subclassSlotBlockIndex],
      data: {
        ...slotData,
        options: slotData.options?.map((o) => ({ ...o, resolved_name: optionNames.get(o.key) ?? o.key })),
      } satisfies ResolvedSubclassSlotBlockData,
    };
  }

  // Augmente le bloc `weapon` avec le nom ET le texte de chaque propriete et
  // de la botte d'arme (V1-D7, retour utilisateur : d'abord un lien, puis
  // "il faut que ca soit directement visible sur la fiche", meme niveau de
  // detail que le Don d'un `background` ci-dessus).
  const weaponBlockIndex = blocks.findIndex((b) => b.blockType === "weapon");
  if (weaponBlockIndex !== -1) {
    const weaponData = blocks[weaponBlockIndex].data as WeaponBlockData;
    const propertyKeys = weaponData.properties.map((p) => p.key);
    const keysToResolve = weaponData.mastery ? [...propertyKeys, weaponData.mastery.key] : propertyKeys;
    const details = await resolveEntryDetails(supabase, rulesetId, keysToResolve, locale);
    blocks[weaponBlockIndex] = {
      ...blocks[weaponBlockIndex],
      data: {
        ...weaponData,
        properties: weaponData.properties.map((p) => ({
          ...p,
          resolved_name: details.get(p.key)?.name ?? p.key,
          resolved_description: details.get(p.key)?.description ?? "",
        })),
        mastery: weaponData.mastery
          ? {
              ...weaponData.mastery,
              resolved_name: details.get(weaponData.mastery.key)?.name ?? weaponData.mastery.key,
              resolved_description: details.get(weaponData.mastery.key)?.description ?? "",
            }
          : undefined,
      } satisfies ResolvedWeaponBlockData,
    };
  }

  // Augmente le bloc `species_traits` avec le nom ET le texte de chaque
  // trait (V1-D7, retour utilisateur : "botte et caracteristiques... un
  // bloc comme pour Don") — meme motif que `weapon` ci-dessus, applique des
  // le depart a la description plutot qu'au seul nom.
  const speciesTraitsBlockIndex = blocks.findIndex((b) => b.blockType === "species_traits");
  if (speciesTraitsBlockIndex !== -1) {
    const traitsData = blocks[speciesTraitsBlockIndex].data as SpeciesTraitsBlockData;
    const details = await resolveEntryDetails(
      supabase,
      rulesetId,
      traitsData.traits.map((t) => t.key),
      locale
    );
    blocks[speciesTraitsBlockIndex] = {
      ...blocks[speciesTraitsBlockIndex],
      data: {
        ...traitsData,
        traits: traitsData.traits.map((t) => ({
          ...t,
          resolved_name: details.get(t.key)?.name ?? t.key,
          resolved_description: details.get(t.key)?.description ?? "",
        })),
      } satisfies ResolvedSpeciesTraitsBlockData,
    };
  }

  // Augmente le bloc `item_properties` avec le nom resolu de chaque objet
  // d'un paquetage (V1-D7, passe Objet) — meme motif que
  // `background.equipment_options` ci-dessus, seul le nom est necessaire.
  const itemPropertiesBlockIndex = blocks.findIndex((b) => b.blockType === "item_properties");
  if (itemPropertiesBlockIndex !== -1) {
    const itemData = blocks[itemPropertiesBlockIndex].data as ItemPropertiesBlockData;
    const contentKeys = itemData.contents?.flatMap((c) => (c.ref ? [c.ref.key] : [])) ?? [];
    const contentNames = await resolveEntryNames(supabase, rulesetId, contentKeys, locale);
    blocks[itemPropertiesBlockIndex] = {
      ...blocks[itemPropertiesBlockIndex],
      data: {
        ...itemData,
        contents: itemData.contents?.map((c) => ({ ...c, resolved_label: c.ref ? (contentNames.get(c.ref.key) ?? c.label) : c.label })),
      } satisfies ResolvedItemPropertiesBlockData,
    };
  }

  // `entry` peut etre absent (fiche maison, V1-D4) : `resolved` porte alors
  // le type resolu depuis la charge utile `add_entry`, et `homebrewName` son
  // nom (aucun des deux ne passe par `entryNameFrom`/la table de traduction,
  // qui exigent tous deux une ligne `ruleset_entries` reelle).
  return {
    id: entry?.id ?? entryKey,
    entryKey,
    entryType: resolved.entry_type as EntryType,
    name: entry ? (translation?.name ?? entryNameFrom(entry)) : (homebrewName ?? entryKey),
    sourceAttribution: entry?.source_attribution ?? null,
    blocks,
    missingBlocks: missingRequiredBlocks(
      resolved.entry_type as EntryType,
      resolved.blocks.map((b) => b.block_type)
    ),
    outgoingRefs,
    incomingRefs,
    modifiedBlockTypes: resolved.modifiedBlockTypes,
    personalReference,
    isHomebrew: entry === null,
  };
}

export interface RuleEntrySummary {
  key: string;
  entryType: EntryType;
  name: string;
  /**
   * Cle de la classe parente, pour `entryType === "subclass"` (V1-C4 suite,
   * filtrage sous-classe/classe) ou `entryType === "feature"` (ticket #57,
   * sur retour utilisateur : desambiguer les aptitudes homonymes dans la
   * sidebar — sept classes ont chacune leur propre "Sorts", une quinzaine
   * partagent "Amélioration de caractéristique"). Jamais utilisé pour nicher
   * les Aptitudes sous leur classe comme les sous-classes : la sidebar
   * s'en sert seulement pour afficher un suffixe de classe sur les noms en
   * double. `undefined` si la source ne porte pas ce champ (dons, propriétés
   * d'arme, traits d'espèce... aucun lien de classe).
   */
  parentClassKey?: string;
  /**
   * Cle de l'espece parente (V1-D7, retour utilisateur : nicher les
   * sous-especes sous leur espece dans la sidebar, meme motif que
   * `parentClassKey`). Difference cle avec Classe/Sous-classe : la 5.2.1 ne
   * porte pas d'`entry_type` distinct pour les sous-especes — une ascendance
   * draconique, une lignee elfique... sont `entry_type: "species"` au meme
   * titre que l'espece elle-meme, seule la presence de ce champ les distingue.
   */
  parentSpeciesKey?: string;
}

/** Lit `source_raw.class.index` (forme SRD des sous-classes, verifiee en base : `{"class":{"index":"wizard",...}}`) — tolerant, jamais d'exception si la forme differe (contenu importe autrement). */
function subclassParentClassKey(sourceRaw: unknown): string | undefined {
  if (!sourceRaw || typeof sourceRaw !== "object") return undefined;
  const cls = (sourceRaw as Record<string, unknown>).class;
  if (!cls || typeof cls !== "object") return undefined;
  const index = (cls as Record<string, unknown>).index;
  return typeof index === "string" ? index : undefined;
}

/**
 * Lit `source_raw.species.index` (SRD 2024, "Subspecies" -> `{"species":
 * {"index":"dragonborn",...}}`) OU `source_raw.race.index` (SRD 2014,
 * "Subraces" -> `{"race":{"index":"dwarf",...}}`, bug reel trouve en
 * verifiant l'assistant : "Nain des collines" remontait comme espece de
 * base independante, jamais nichee sous "Nain", car cette fonction ne
 * lisait que la forme 2024) — meme tolerance que `subclassParentClassKey`.
 */
function speciesParentKey(sourceRaw: unknown): string | undefined {
  if (!sourceRaw || typeof sourceRaw !== "object") return undefined;
  const record = sourceRaw as Record<string, unknown>;
  const parent = record.species ?? record.race;
  if (!parent || typeof parent !== "object") return undefined;
  const index = (parent as Record<string, unknown>).index;
  return typeof index === "string" ? index : undefined;
}

/**
 * Meme remontee que findEntryInRulesetChain, mais pour lister plutot que
 * chercher une cle : s'arrete au premier ruleset de la chaine qui a des
 * entrees a lui (un monde variante sans rien a soi remonte jusqu'a son
 * ancetre officiel). Les surcharges `add_entry`/`disable_entry` de CHAQUE
 * niveau traverse (V1-D4) sont collectees au passage puis fusionnees une
 * fois la base atteinte via `mergeHomebrewEntries` — une fiche maison n'a
 * de sens qu'a la fusion : elle n'a par definition pas de fiche de base
 * correspondante, seul son entry_key/entry_type/name portes par la
 * surcharge elle-meme la decrivent.
 */
async function listEntriesInRulesetChain(
  supabase: TypedClient,
  rulesetId: string,
  locale: Locale
): Promise<RuleEntrySummary[]> {
  let currentId: string | null = rulesetId;
  const homebrewEntries: RuleEntrySummary[] = [];
  const disabledKeys = new Set<string>();

  for (let hop = 0; currentId && hop < MAX_RULESET_CHAIN_DEPTH; hop++) {
    const levelOverrides = await listEntryLevelOverridesForRuleset(supabase, currentId);
    for (const ov of levelOverrides) {
      if (ov.action === "disable_entry") {
        disabledKeys.add(ov.entry_key);
      } else if (ov.action === "add_entry") {
        const payload = zAddEntryPayload.parse(ov.payload);
        homebrewEntries.push({ key: ov.entry_key, entryType: payload.entry_type as EntryType, name: payload.name });
      }
    }

    const entries = await listRulesetEntries(supabase, currentId);
    if (entries.length > 0) {
      const translationByEntryId = new Map<string, string>();
      if (locale !== "en") {
        const translations = await listTranslationsForEntries(supabase, entries.map((e) => e.id), locale);
        for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
      }
      const baseSummaries = entries.map((e) => ({
        key: e.entry_key,
        entryType: e.entry_type as EntryType,
        name: translationByEntryId.get(e.id) ?? entryNameFrom(e),
        parentClassKey:
          e.entry_type === "subclass" || e.entry_type === "feature" ? subclassParentClassKey(e.source_raw) : undefined,
        parentSpeciesKey: e.entry_type === "species" ? speciesParentKey(e.source_raw) : undefined,
      }));
      return mergeHomebrewEntries(baseSummaries, homebrewEntries, disabledKeys);
    }
    const ruleset = await getRulesetById(supabase, currentId);
    currentId = ruleset?.parent_ruleset_id ?? null;
  }
  return mergeHomebrewEntries([], homebrewEntries, disabledKeys);
}

/** Barre laterale de l'onglet Regles : `null` si le monde est introuvable, liste vide si aucun ruleset n'est assigne. */
export async function listRuleEntriesForWorld(
  supabase: TypedClient,
  worldSlug: string,
  locale: Locale
): Promise<RuleEntrySummary[] | null> {
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return null;
  const rulesetId = await getWorldDefaultRulesetId(supabase, world.id);
  if (!rulesetId) return [];
  return listEntriesInRulesetChain(supabase, rulesetId, locale);
}

export interface RawRuleEntryBlock {
  blockType: string;
  data: unknown;
}

/**
 * Blocs bruts (assistant de creation de personnage, V2-G1 suite) pour un LOT
 * de cles — jamais une par une via `getRuleEntryForWorld`/`getRuleEntryPageData`,
 * qui refont chacune tout le travail (monde, chaine de rulesets, entree,
 * traduction, blocs) depuis zero. Bug reel trouve en verifiant l'etape
 * Sorts : la liste candidate (jusqu'a 339 sorts) prenait plusieurs secondes,
 * chaque cle valant une demi-douzaine d'allers-retours DB independants.
 *
 * Simplification assumee par rapport a `getRuleEntryForWorld` : les
 * surcharges de variante (`ruleset_entry_overrides`, V1-A4) ne sont PAS
 * appliquees ici. Cet endpoint sert uniquement l'assistant, un outil
 * d'aide au choix pendant la creation — la fiche reelle de l'entite creee
 * ne passe jamais par ce chemin, elle referme la cle choisie et la resout
 * normalement (overrides inclus) partout ailleurs dans l'app. Un sort
 * dont le texte est surcharge par une variante maison montrerait donc le
 * texte officiel pendant le choix, jamais dans le personnage cree.
 */
/**
 * `resolveEntryNames`/`resolveEntryDetails` fusionnes puis rendus batches
 * (V2-G1 suite, retour utilisateur : les fiches de l'assistant montraient
 * "undefined" a la place du nom d'un trait, d'une option de sous-classe ou
 * d'un objet d'equipement resolu depuis une reference). Meme chaine de
 * rulesets que `listRuleEntryBlocksByKeys` ci-dessous, mais parcourue UNE
 * fois pour tout le lot de cles referencees plutot qu'un aller-retour par
 * cle (`resolveEntryDetail` fait ce dernier, tolerable pour les 1 a 10 cles
 * d'une seule fiche via `getRuleEntryForWorld`, pas pour le batch entier de
 * l'assistant).
 */
async function resolveNamesAndDescriptionsBatched(
  supabase: TypedClient,
  rulesetId: string,
  keys: string[],
  locale: Locale
): Promise<Map<string, { name: string; description: string }>> {
  const result = new Map<string, { name: string; description: string }>();
  const remaining = new Set(keys);
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
    const descriptionRowByEntryId = new Map(
      blockRows.filter((r) => r.block_type === "description").map((r) => [r.entry_id, r.data])
    );

    for (const entry of entries) {
      const translation = translationByEntryId.get(entry.id);
      const name = translation?.name ?? entryNameFrom(entry);
      const overrideDescription = (translation?.blocks as Record<string, unknown> | undefined)?.description;
      const rawDescription = overrideDescription ?? descriptionRowByEntryId.get(entry.id);
      const segments = (rawDescription as { segments?: { text: string }[] } | undefined)?.segments;
      result.set(entry.entry_key, { name, description: segments?.map((s) => s.text).join("\n\n") ?? "" });
      remaining.delete(entry.entry_key);
    }
  }

  return result;
}

export async function listRuleEntryBlocksByKeys(
  supabase: TypedClient,
  worldId: string,
  entryKeys: string[],
  locale: Locale
): Promise<Record<string, RawRuleEntryBlock[]>> {
  const result: Record<string, RawRuleEntryBlock[]> = {};
  const rulesetId = await getWorldDefaultRulesetId(supabase, worldId);
  if (!rulesetId) return result;

  const chain = await walkRulesetChain(supabase, rulesetId);
  const remaining = new Set(entryKeys);

  for (const link of chain) {
    if (remaining.size === 0) break;
    const entries = await listRulesetEntriesByKeys(supabase, link.rulesetId, [...remaining]);
    if (entries.length === 0) continue;

    const entryIds = entries.map((e) => e.id);
    const [blockRows, translations] = await Promise.all([
      listBlocksForRulesetEntries(supabase, entryIds),
      locale !== "en" ? listEntryTranslationsWithBlocks(supabase, entryIds, locale) : Promise.resolve([]),
    ]);

    const translationByEntryId = new Map(translations.map((t) => [t.entry_id, (t.blocks ?? {}) as Record<string, unknown>]));
    const blocksByEntryId = new Map<string, RawRuleEntryBlock[]>();
    for (const row of blockRows) {
      const overrides = translationByEntryId.get(row.entry_id) ?? {};
      const list = blocksByEntryId.get(row.entry_id) ?? [];
      list.push({ blockType: row.block_type, data: overrides[row.block_type] ?? row.data });
      blocksByEntryId.set(row.entry_id, list);
    }

    for (const entry of entries) {
      result[entry.entry_key] = blocksByEntryId.get(entry.id) ?? [];
      remaining.delete(entry.entry_key);
    }
  }

  // Repli override-aware pour les cles encore introuvables (V2-?, retour
  // utilisateur : "l'historique/l'espece choisi par un joueur n'est jamais
  // une fiche maison" — hypothese vraie a l'ecriture de la boucle
  // ci-dessus, plus depuis l'outil de creation d'historique). `entries`
  // ci-dessus ne lit QUE `ruleset_entries` (`listRulesetEntriesByKeys`) :
  // une fiche qui n'existe que par un `add_entry` (aucune ligne officielle)
  // n'y apparait jamais. `resolveEntryBlocksInRuleset` est le meme moteur
  // que `getRuleEntryForWorld` (la page de la fiche elle-meme), donc
  // resout ces cles correctement — juste jamais applique ici avant.
  if (remaining.size > 0) {
    const fallbackResults = await Promise.all(
      [...remaining].map(async (key) => [key, await resolveEntryBlocksInRuleset(supabase, rulesetId, key)] as const)
    );
    for (const [key, resolved] of fallbackResults) {
      if (!resolved) continue;
      result[key] = [...resolved.blocksByType.entries()].map(([blockType, data]) => ({ blockType: blockType as BlockType, data }));
      remaining.delete(key);
    }
  }

  // Deuxieme passe : resout les references internes que certains blocs
  // portent comme simple cle technique (don d'un historique, options d'une
  // sous-classe, proprietes/botte d'une arme, traits d'une espece, contenu
  // d'un paquetage) — memes "Resolved*BlockData" que `getRuleEntryForWorld`,
  // en un seul lot pour tout le batch plutot qu'un aller-retour par entree.
  // Bug reel corrige ici : sans cette passe, ces champs restaient absents
  // et `blockContentRenderer.tsx` affichait litteralement "undefined" a la
  // place du nom (`ResolvedRefLink`), ou une description vide.
  const refKeys = new Set<string>();
  for (const blocks of Object.values(result)) {
    for (const block of blocks) {
      if (block.blockType === "background") {
        const data = block.data as BackgroundBlockData;
        refKeys.add(data.feat.key);
        for (const opt of data.equipment_options)
          for (const it of opt.items) {
            if (it.ref) refKeys.add(it.ref.key);
            for (const c of it.category_options ?? []) refKeys.add(c.key);
          }
      } else if (block.blockType === "subclass_slot") {
        const data = block.data as SubclassSlotBlockData;
        for (const o of data.options ?? []) refKeys.add(o.key);
      } else if (block.blockType === "weapon") {
        const data = block.data as WeaponBlockData;
        for (const p of data.properties) refKeys.add(p.key);
        if (data.mastery) refKeys.add(data.mastery.key);
      } else if (block.blockType === "species_traits") {
        const data = block.data as SpeciesTraitsBlockData;
        for (const t of data.traits) refKeys.add(t.key);
      } else if (block.blockType === "item_properties") {
        const data = block.data as ItemPropertiesBlockData;
        for (const c of data.contents ?? []) if (c.ref) refKeys.add(c.ref.key);
      } else if (block.blockType === "class_equipment") {
        const data = block.data as ClassEquipmentBlockData;
        for (const it of data.fixed) {
          if (it.ref) refKeys.add(it.ref.key);
          for (const c of it.category_options ?? []) refKeys.add(c.key);
        }
        for (const c of data.choices)
          for (const opt of c.options)
            for (const it of opt.items) {
              if (it.ref) refKeys.add(it.ref.key);
              for (const co of it.category_options ?? []) refKeys.add(co.key);
            }
      }
    }
  }

  if (refKeys.size > 0) {
    const resolved = await resolveNamesAndDescriptionsBatched(supabase, rulesetId, [...refKeys], locale);
    for (const blocks of Object.values(result)) {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (block.blockType === "background") {
          const data = block.data as BackgroundBlockData;
          blocks[i] = {
            ...block,
            data: {
              ...data,
              feat_name: resolved.get(data.feat.key)?.name ?? data.feat.key,
              feat_description: resolved.get(data.feat.key)?.description ?? "",
              equipment_options: data.equipment_options.map((opt) => ({
                ...opt,
                items: opt.items.map((it) => ({
                  ...it,
                  resolved_label: it.ref ? (resolved.get(it.ref.key)?.name ?? it.label) : it.label,
                  resolved_category_options: it.category_options?.map((c) => ({
                    key: c.key,
                    resolved_label: resolved.get(c.key)?.name ?? c.key,
                  })),
                })),
              })),
            } satisfies ResolvedBackgroundBlockData,
          };
        } else if (block.blockType === "subclass_slot") {
          const data = block.data as SubclassSlotBlockData;
          blocks[i] = {
            ...block,
            data: {
              ...data,
              options: data.options?.map((o) => ({ ...o, resolved_name: resolved.get(o.key)?.name ?? o.key })),
            } satisfies ResolvedSubclassSlotBlockData,
          };
        } else if (block.blockType === "weapon") {
          const data = block.data as WeaponBlockData;
          blocks[i] = {
            ...block,
            data: {
              ...data,
              properties: data.properties.map((p) => ({
                ...p,
                resolved_name: resolved.get(p.key)?.name ?? p.key,
                resolved_description: resolved.get(p.key)?.description ?? "",
              })),
              mastery: data.mastery
                ? {
                    ...data.mastery,
                    resolved_name: resolved.get(data.mastery.key)?.name ?? data.mastery.key,
                    resolved_description: resolved.get(data.mastery.key)?.description ?? "",
                  }
                : undefined,
            } satisfies ResolvedWeaponBlockData,
          };
        } else if (block.blockType === "species_traits") {
          const data = block.data as SpeciesTraitsBlockData;
          blocks[i] = {
            ...block,
            data: {
              ...data,
              traits: data.traits.map((t) => ({
                ...t,
                resolved_name: resolved.get(t.key)?.name ?? t.key,
                resolved_description: resolved.get(t.key)?.description ?? "",
              })),
            } satisfies ResolvedSpeciesTraitsBlockData,
          };
        } else if (block.blockType === "item_properties") {
          const data = block.data as ItemPropertiesBlockData;
          blocks[i] = {
            ...block,
            data: {
              ...data,
              contents: data.contents?.map((c) => ({
                ...c,
                resolved_label: c.ref ? (resolved.get(c.ref.key)?.name ?? c.label) : c.label,
              })),
            } satisfies ResolvedItemPropertiesBlockData,
          };
        } else if (block.blockType === "class_equipment") {
          const data = block.data as ClassEquipmentBlockData;
          const resolveItem = (it: BackgroundEquipmentItem) => ({
            ...it,
            resolved_label: it.ref ? (resolved.get(it.ref.key)?.name ?? it.label) : it.label,
            resolved_category_options: it.category_options?.map((c) => ({
              key: c.key,
              resolved_label: resolved.get(c.key)?.name ?? c.key,
            })),
          });
          blocks[i] = {
            ...block,
            data: {
              fixed: data.fixed.map(resolveItem),
              choices: data.choices.map((c) => ({ options: c.options.map((opt) => ({ ...opt, items: opt.items.map(resolveItem) })) })),
            } satisfies ResolvedClassEquipmentBlockData,
          };
        }
      }
    }
  }

  return result;
}

/** Composition pour la route `/m/[worldSlug]/regles/[cle]` : `null` si le monde ou la regle sont introuvables — la page traduit ça en 404. */
export async function getRuleEntryPageData(
  supabase: TypedClient,
  worldSlug: string,
  entryKey: string,
  locale: Locale
): Promise<RuleEntryDetail | null> {
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return null;
  return getRuleEntryForWorld(supabase, world.id, entryKey, locale);
}

// --- Selection du ruleset actif (V1-C5) ---------------------------------

/** `null` si personne n'est authentifie — l'appelant (route) traduit ça en 401 plutot que de renvoyer une liste vide trompeuse. */
export async function listSelectableRulesetsForCurrentUser(supabase: TypedClient): Promise<SelectableRulesetRow[] | null> {
  const user = await getAuthUser(supabase);
  if (!user) return null;
  return listSelectableRulesets(supabase, user.id);
}

/**
 * Change le ruleset actif d'un monde. `false` si le monde est introuvable,
 * si le ruleset cible n'est pas lisible par l'appelant (RLS sur la lecture
 * de `rulesets`), ou si l'appelant n'est pas le proprietaire du monde (RLS
 * sur l'ecriture de `worlds` — `setWorldDefaultRuleset` renvoie alors
 * `updated: false` plutot qu'une erreur).
 *
 * Propage aussi a la campagne unique du monde (V2-G1 suite, "un monde = une
 * campagne") : le verrou "une campagne epingle son ruleset, jamais
 * retroactif" (SCHEMA.md §9.5) protegeait a l'origine les AUTRES campagnes
 * d'un meme monde — un risque qui n'existe plus a une seule campagne par
 * monde. Sans cette propagation, changer le ruleset ici n'aurait aucun
 * effet sur les jets/fiches reels, contradiction constatee en direct
 * (l'ecran d'accueil affichait 2014 alors que Reglages affichait 2024).
 */
export async function setActiveRuleset(supabase: TypedClient, worldSlug: string, rulesetId: string): Promise<boolean> {
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return false;
  const ruleset = await getRulesetById(supabase, rulesetId);
  if (!ruleset) return false;
  const { updated } = await setWorldDefaultRuleset(supabase, world.id, rulesetId);
  if (!updated) return false;

  const campaigns = await listCampaignsForWorld(supabase, world.id);
  if (campaigns.length > 0) {
    await updateCampaignRuleset(supabase, { campaignId: campaigns[0].id, rulesetId });
  }
  return true;
}

/**
 * Cree une variante vierge a partir d'un ruleset officiel (V1-C5) : aucune
 * surcharge propre pour l'instant, la chaine de resolution (V1-A4) fait
 * remonter chaque entree jusqu'a l'officiel tant que rien ne la surcharge —
 * un MJ peut donc commencer a jouer avec sa variante des sa creation, puis
 * l'editer entree par entree plus tard (V1-D2).
 *
 * `personalReference` (V1-D5, specs/ruleset-personnel.md §2) : pose
 * `content_origin = 'personal_reference'` plutot que `user_created` —
 * verrouille en base des la creation (aucune bascule possible ensuite,
 * migration 20260817130001). Exige un parent officiel, jamais une autre
 * variante : "un ruleset personnel derivant d'une base SRD" (§4.1), pas
 * une reference imbriquee dans une regle maison.
 */
export async function createRulesetVariant(
  supabase: TypedClient,
  params: { name: string; parentRulesetId: string; personalReference?: boolean }
): Promise<{ id: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const parent = await getRulesetById(supabase, params.parentRulesetId);
  if (!parent) return null;
  if (params.personalReference && !parent.is_official_base) return null;
  return insertRulesetVariant(supabase, {
    name: params.name,
    baseSystem: parent.base_system,
    parentRulesetId: parent.id,
    createdBy: user.id,
    contentOrigin: params.personalReference ? "personal_reference" : "user_created",
  });
}

/**
 * Supprime une variante — jamais un officiel (verifie explicitement en plus
 * de la RLS, qui l'interdirait de toute facon via `created_by = auth.uid()`
 * puisqu'un officiel n'a pas de createur : demande utilisateur au pied de
 * la lettre, « un bouton de suppression pour les regles autres que srd 5.1
 * et 5.2 »).
 */
export async function deleteRulesetVariant(supabase: TypedClient, rulesetId: string): Promise<DeleteRulesetOutcome> {
  const ruleset = await getRulesetById(supabase, rulesetId);
  if (!ruleset || ruleset.is_official_base) return "not_found";
  return deleteRuleset(supabase, rulesetId);
}

const zCreateHomebrewWeaponInput = z.object({
  rulesetId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  weapon: zWeaponBlockData,
  note: z.string().min(1).optional(),
});
export type CreateHomebrewWeaponInput = z.infer<typeof zCreateHomebrewWeaponInput>;

/**
 * Cree une arme maison (V1-D4) : deux surcharges dans le meme ruleset,
 * l'`add_entry` qui fait exister la fiche (nom + entry_type, forme
 * `AddEntryPayload`) puis l'`add_block` qui lui donne son bloc `weapon`
 * (meme enveloppe que l'import SRD — `weaponBlock` dans
 * `scripts/ingest-srd.ts`). Seul type de fiche en portee pour ce ticket :
 * un formulaire dedie par type de bloc plutot qu'un moteur generique
 * (regle des trois), la fonction porte donc son nom plutot qu'un
 * `blockType` en parametre.
 *
 * La cle est deduite du nom (`slugify`) et desambiguee si necessaire
 * contre TOUTE la chaine de ruleset, pas seulement ce niveau : une cle qui
 * collisionnerait avec une entree heritee masquerait silencieusement
 * l'entree de base au lieu de creer une nouvelle fiche a cote.
 */
export async function createHomebrewWeapon(
  supabase: TypedClient,
  input: CreateHomebrewWeaponInput
): Promise<{ entryKey: string; rulesetId: string }> {
  const parsed = zCreateHomebrewWeaponInput.parse(input);

  const existingKeys = new Set((await listEntriesInRulesetChain(supabase, parsed.rulesetId, "fr")).map((e) => e.key));
  const baseSlug = slugify(parsed.name);
  let entryKey = baseSlug;
  for (let attempt = 1; existingKeys.has(entryKey); attempt++) {
    entryKey = nextSlugCandidate(baseSlug, attempt);
  }

  const addEntryPayload: AddEntryPayload = zAddEntryPayload.parse({ name: parsed.name, entry_type: "weapon" });
  const rulesetIdAfterEntry = await upsertRulesetOverride(supabase, {
    rulesetId: parsed.rulesetId,
    entryKey,
    blockType: null,
    action: "add_entry",
    payload: addEntryPayload as unknown as Json,
    patch: null,
    note: parsed.note ?? null,
  });

  // "Reutilise l'id renvoye par le premier appel" (voir commentaire plus bas) :
  // chaque add_block suivant doit viser le meme id, mis a jour a chaque etape.
  let rulesetIdAfterBlocks = rulesetIdAfterEntry;

  if (parsed.description?.trim()) {
    const descriptionBlock: ResolvableBlock = {
      block_type: "description",
      display: { label: "Description", layout: "prose" },
      data: { segments: [{ text: parsed.description.trim() }] },
      // Avant le bloc `weapon` (display_order 150) — meme ordre de lecture
      // que les historiques/dons maison (Description avant les valeurs
      // mecaniques, voir listOverridesForRuleset : les add_block d'une meme
      // entree se trient par display_order, pas par ordre d'ecriture).
      display_order: 100,
    };
    rulesetIdAfterBlocks = await upsertRulesetOverride(supabase, {
      rulesetId: rulesetIdAfterBlocks,
      entryKey,
      blockType: "description",
      action: "add_block",
      payload: descriptionBlock as unknown as Json,
      patch: null,
      note: parsed.note ?? null,
    });
  }

  const weaponBlock: ResolvableBlock = {
    block_type: "weapon",
    display: { label: "Arme", layout: "key_values" },
    data: parsed.weapon,
    display_order: 150,
  };
  const rulesetIdAfterBlock = await upsertRulesetOverride(supabase, {
    // Reutilise l'id renvoye par le premier appel, pas parsed.rulesetId :
    // si le ruleset etait deja publie, le premier appel a fork une v+1 —
    // ce second appel doit viser cette meme nouvelle version, pas l'originale figee.
    rulesetId: rulesetIdAfterBlocks,
    entryKey,
    blockType: "weapon",
    action: "add_block",
    payload: weaponBlock as unknown as Json,
    patch: null,
    note: parsed.note ?? null,
  });

  return { entryKey, rulesetId: rulesetIdAfterBlock };
}

/** Gabarit label/mise en page par defaut (retour utilisateur, import JSON) — meme table que `scripts/ingest-srd.ts`, pour qu'un fichier ecrit a la main n'ait pas a connaitre les six mises en page (specs/regles-blocs.md §4) juste pour un premier import. Toujours ecrasable par un `display` explicite dans le fichier. */
const DEFAULT_BLOCK_DISPLAY: Record<BlockType, { label: string; layout: string }> = {
  description: { label: "Description", layout: "prose" },
  spell_casting: { label: "Incantation", layout: "key_values" },
  effects: { label: "Effets", layout: "formula_list" },
  scaling: { label: "Montée en puissance", layout: "progression_table" },
  class_progression: { label: "Progression", layout: "progression_table" },
  custom_table: { label: "Table", layout: "table" },
  weapon: { label: "Arme", layout: "key_values" },
  armor: { label: "Armure", layout: "key_values" },
  item_properties: { label: "Propriétés", layout: "key_values" },
  charges: { label: "Charges", layout: "key_values" },
  stat_block: { label: "Caractéristiques", layout: "key_values" },
  traits: { label: "Aptitudes spéciales", layout: "key_values" },
  actions: { label: "Actions", layout: "key_values" },
  legendary_actions: { label: "Actions légendaires", layout: "key_values" },
  prerequisites: { label: "Prérequis", layout: "chips" },
  class_basics: { label: "Bases de classe", layout: "key_values" },
  spellcasting_progression: { label: "Incantation", layout: "key_values" },
  subclass_slot: { label: "Sous-classe", layout: "key_values" },
  background: { label: "Historique", layout: "key_values" },
  condition_effects: { label: "Effets", layout: "key_values" },
  subclass_features: { label: "Sous-classe", layout: "progression_table" },
  species_traits: { label: "Traits", layout: "key_values" },
  class_equipment: { label: "Équipement de départ", layout: "key_values" },
  modifiers: { label: "Effets chiffrés", layout: "key_values" },
};

export interface ImportRulesetEntryInput {
  entry_key?: string;
  name: string;
  entry_type: EntryType;
  blocks: { block_type: BlockType; display?: { label?: string; layout?: string; collapsed?: boolean }; data: unknown }[];
  note?: string;
}

export interface ImportRulesetEntriesResult {
  imported: { entryKey: string; name: string }[];
  errors: { entryKey: string | null; name: string; message: string }[];
  rulesetId: string;
}

/**
 * Import JSON de regles (retour utilisateur, "regles actives") — meme
 * mecanisme que `createHomebrewWeapon` (deux surcharges par entree,
 * `add_entry` puis `add_block` par bloc, via `upsert_ruleset_override` — le
 * seul chemin d'ecriture pour une variante, la RPC refuse deja une cible
 * officielle), generalise a n'importe quel `block_type`/`entry_type` plutot
 * que fige sur `weapon`. Chaque entree est independante : une entree
 * invalide (cle en collision, bloc qui echoue son schema Zod) est ecartee
 * dans `errors`, jamais toute l'importation — un fichier de dix monstres
 * dont un seul a une faute de frappe importe quand meme les neuf autres.
 * `rulesetId` de sortie : suit le fork-sur-publication a travers TOUTE la
 * boucle (meme piege documente dans `createHomebrewWeapon`), jamais
 * `input.rulesetId` tel quel une fois la premiere ecriture faite.
 */
export async function importRulesetEntries(supabase: TypedClient, input: { rulesetId: string; entries: ImportRulesetEntryInput[] }): Promise<ImportRulesetEntriesResult> {
  const imported: { entryKey: string; name: string }[] = [];
  const errors: { entryKey: string | null; name: string; message: string }[] = [];

  let currentRulesetId = input.rulesetId;
  const existingKeys = new Set((await listEntriesInRulesetChain(supabase, currentRulesetId, "fr")).map((e) => e.key));

  for (const entry of input.entries) {
    try {
      let entryKey = entry.entry_key?.trim();
      if (entryKey) {
        if (existingKeys.has(entryKey)) {
          throw new Error(`La clé « ${entryKey} » existe déjà dans ce ruleset ou l'un de ses parents.`);
        }
      } else {
        const baseSlug = slugify(entry.name);
        entryKey = baseSlug;
        for (let attempt = 1; existingKeys.has(entryKey); attempt++) {
          entryKey = nextSlugCandidate(baseSlug, attempt);
        }
      }

      // Valide TOUS les blocs avant d'ecrire quoi que ce soit pour cette
      // entree — jamais une entree a moitie ecrite si son deuxieme bloc
      // echoue son schema.
      const validatedBlocks = entry.blocks.map((b) => ({
        block_type: b.block_type,
        display: { ...DEFAULT_BLOCK_DISPLAY[b.block_type], ...b.display },
        data: validateBlockData(b.block_type, b.data),
      }));

      const addEntryPayload: AddEntryPayload = zAddEntryPayload.parse({ name: entry.name, entry_type: entry.entry_type });
      currentRulesetId = await upsertRulesetOverride(supabase, {
        rulesetId: currentRulesetId,
        entryKey,
        blockType: null,
        action: "add_entry",
        payload: addEntryPayload as unknown as Json,
        patch: null,
        note: entry.note ?? null,
      });

      for (const [index, block] of validatedBlocks.entries()) {
        const blockPayload: ResolvableBlock = {
          block_type: block.block_type,
          display: block.display,
          data: block.data,
          display_order: (index + 1) * 100,
        };
        currentRulesetId = await upsertRulesetOverride(supabase, {
          rulesetId: currentRulesetId,
          entryKey,
          blockType: block.block_type,
          action: "add_block",
          payload: blockPayload as unknown as Json,
          patch: null,
          note: entry.note ?? null,
        });
      }

      existingKeys.add(entryKey);
      imported.push({ entryKey, name: entry.name });
    } catch (error) {
      const message =
        error instanceof z.ZodError ? (error.issues[0]?.message ?? "Donnée invalide.") : error instanceof Error ? error.message : "Erreur inconnue.";
      errors.push({ entryKey: entry.entry_key ?? null, name: entry.name, message });
    }
  }

  return { imported, errors, rulesetId: currentRulesetId };
}

export interface RulesetExport {
  name: string;
  baseSystem: string;
  entries: ImportRulesetEntryInput[];
}

/**
 * Export d'un ruleset au format "notre format" (V2-J4,
 * specs/arbitrage-modifications.md §1.2) — le vrai miroir de
 * `importRulesetEntries` : meme forme exacte (`ImportRulesetEntryInput[]`),
 * consommable telle quelle par `createRulesetFromImport` ci-dessous.
 *
 * Bug reel trouve en verifiant en direct : une premiere version lisait
 * `listRulesetEntries` (table `ruleset_entries`) — vide pour une variante
 * homebrew, qui n'y materialise jamais rien. Une fiche creee via
 * `upsertRulesetOverride` (add_entry/add_block, meme chemin que
 * `importRulesetEntries`/`createHomebrewWeapon`) vit UNIQUEMENT dans
 * `ruleset_overrides`, resolue a la lecture — jamais copiee dans
 * `ruleset_entries` (reserve au contenu officiel materialise par
 * `scripts/ingest-srd.ts`). Reutilise donc `listEntryLevelOverridesForRuleset`
 * (toutes les cles `add_entry` de CE niveau, meme fonction que la barre
 * laterale) puis `applyOverrides` (le meme resolveur pur que
 * `resolveEntryBlocksInRuleset`, scope a CE seul niveau — jamais la chaine
 * heritee, un ruleset exporte ses propres entrees, jamais le SRD dont il
 * herite).
 */
export async function exportRulesetEntries(supabase: TypedClient, rulesetId: string): Promise<RulesetExport | null> {
  const ruleset = await getRulesetById(supabase, rulesetId);
  if (!ruleset) return null;

  const levelOverrides = await listEntryLevelOverridesForRuleset(supabase, rulesetId);
  const entryKeys = [...new Set(levelOverrides.filter((o) => o.action === "add_entry").map((o) => o.entry_key))];

  const entries: ImportRulesetEntryInput[] = [];
  for (const entryKey of entryKeys) {
    const rows = await listOverridesForRuleset(supabase, rulesetId, entryKey);
    // `add_entry` porte {name, entry_type} (zAddEntryPayload) — `applyOverrides`
    // attend un `ResolvableEntry` complet ({entry_key, entry_type, blocks: []})
    // pour amorcer l'entree, meme reecriture que `resolveEntryBlocksInRuleset`
    // ci-dessus. Les autres actions (add_block...) portent deja la forme attendue.
    let name = entryKey;
    const overrides: OverrideInput[] = rows.map((row) => {
      if (row.action === "add_entry") {
        const addEntry = zAddEntryPayload.parse(row.payload);
        name = addEntry.name;
        return {
          block_type: null,
          action: "add_entry",
          payload: { entry_key: entryKey, entry_type: addEntry.entry_type, blocks: [] } satisfies ResolvableEntry,
          patch: null,
        };
      }
      return { block_type: row.block_type, action: row.action as OverrideInput["action"], payload: row.payload, patch: row.patch };
    });
    const resolved = applyOverrides(null, overrides);
    if (!resolved || resolved.disabled) continue;

    entries.push({
      entry_key: entryKey,
      name,
      entry_type: resolved.entry_type as EntryType,
      blocks: resolved.blocks.map((b) => ({
        block_type: b.block_type as BlockType,
        display: b.display as { label?: string; layout?: string; collapsed?: boolean },
        data: b.data,
      })),
    });
  }

  return { name: ruleset.name, baseSystem: ruleset.base_system, entries };
}

/**
 * Import "notre format" → NOUVEAU ruleset personnel (V2-J4), plutot que
 * d'ajouter dans la variante deja active (`importRulesetEntries` seul,
 * comportement existant, inchange). Cree la variante `personal_reference`
 * (`createRulesetVariant`, memes verrous en base que toute autre —
 * `content_origin` seul suffit, rien a re-ecrire ici) a partir du ruleset
 * officiel correspondant a `baseSystem`, puis y importe les entrees par le
 * MEME chemin que l'ajout dans une variante existante — un seul mecanisme
 * d'ecriture, jamais un second.
 */
export async function createRulesetFromImport(
  supabase: TypedClient,
  input: { name: string; baseSystem: string; entries: ImportRulesetEntryInput[] }
): Promise<{ ok: true; result: ImportRulesetEntriesResult } | { ok: false; reason: "unknown_base_system" | "forbidden" }> {
  const parentRulesetId = await getOfficialBaseRulesetId(supabase, input.baseSystem);
  if (!parentRulesetId) return { ok: false, reason: "unknown_base_system" };

  const created = await createRulesetVariant(supabase, { name: input.name, parentRulesetId, personalReference: true });
  if (!created) return { ok: false, reason: "forbidden" };

  const result = await importRulesetEntries(supabase, { rulesetId: created.id, entries: input.entries });
  return { ok: true, result };
}

export type DisableRulesetEntryResult = "ok" | "not_found" | "official";

/**
 * "Supprimer cette fiche" pour une fiche maison (retour utilisateur,
 * suite V2-J4) — reutilise `disable_entry`, deja lu partout
 * (`applyOverrides`/`mergeHomebrewEntries`) mais jamais ecrit nulle part
 * avant ce ticket. Meme cle de conflit que `add_entry`
 * (`overrides_target_uniq` sur `(ruleset_id, entry_key, coalesce(block_type,''))`,
 * SCHEMA.md §9.4) : pour une fiche entierement maison, cet upsert REMPLACE
 * la ligne `add_entry` existante — plus aucune donnee pour la reconstruire,
 * `applyOverrides` renvoie `null`, la fiche disparait reellement des
 * listings. Jamais de suppression physique de ligne : coherent avec
 * `ruleset_overrides` en journal append-only (SCHEMA.md §9.4), juste une
 * nouvelle ligne qui rend l'ancienne sans effet.
 */
export async function disableRulesetEntry(
  supabase: TypedClient,
  params: { rulesetId: string; entryKey: string }
): Promise<DisableRulesetEntryResult> {
  const ruleset = await getRulesetById(supabase, params.rulesetId);
  if (!ruleset) return "not_found";
  if (ruleset.is_official_base) return "official";

  await upsertRulesetOverride(supabase, {
    rulesetId: params.rulesetId,
    entryKey: params.entryKey,
    blockType: null,
    action: "disable_entry",
    payload: {},
    patch: null,
    note: null,
  });
  return "ok";
}
