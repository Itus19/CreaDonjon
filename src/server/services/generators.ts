import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Rng } from "@/src/core/dice/rng";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { zGeneratorBlockData, type GeneratorBlockData } from "@/src/core/schemas/blocks/generator";
import { isProseSlot, type GeneratorTableSlotTier } from "@/src/core/generators/types";
import { drawOnce, drawMultiple, buildFilteredTable } from "@/src/core/tables/roll";
import { getBlockById, listBlocksForEntity } from "@/src/server/repos/blocks";
import { findTableBlockByKey, resolveCascade } from "@/src/server/services/tables";
import type { PendingProseSlot } from "@/src/server/ai/generatorProse";
import { GENERATOR_TOOLS, toolForSectionKey, type GeneratorToolConfig } from "@/src/core/generators/tools";
import { resolveVariantValue, orderedNeighbors, entriesUpToTier, entriesAtExactTier } from "@/src/core/generators/variants";
import { renderGeneratorTemplate, joinMultiDrawTexts } from "@/src/core/generators/render";
import { zRandomTableBlockData, type RandomTableBlockData } from "@/src/core/schemas/blocks/randomTable";
import { toVisibleBlock, type VisibleBlock } from "@/src/server/services/blocks";
import type { TableEntryPrice } from "@/src/core/tables/types";

type TypedClient = SupabaseClient<Database>;

/** Un resultat individuel d'emplacement a tirage multiple (V2-J9, `items`) — `price` structure (retour utilisateur) plutot qu'encode dans `text`. */
export interface GeneratorSlotItem {
  text: string;
  price?: TableEntryPrice;
}

export interface GeneratorSlotResult {
  key: string;
  text: string;
  refs: BlockReference[];
  /** Notation de de et resultat brut du tirage (V2-J1 Phase 2, outil MJ decompose) — presents seulement pour un emplacement `table` : c'est ce que le panneau "Détails des tirages" affiche a cote du texte resolu. */
  die?: string;
  rolled?: number;
  /** Prix STRUCTURE de l'entree tiree (retour utilisateur) — absent pour une table sans notion de prix ou un emplacement a tirage multiple (voir `items`). */
  price?: TableEntryPrice;
  /** Resultats individuels d'un emplacement a tirage multiple (V2-J9, `count`), AVANT assemblage dans `text` — permet au client de les afficher en tableau (ex. Menu de taverne) plutot qu'en un seul bloc de texte. Absent pour un tirage simple. */
  items?: GeneratorSlotItem[];
}

export interface GeneratorResult {
  text: string;
  slots: GeneratorSlotResult[];
  /** Cle d'option resolue par axe (V2-J7) — le client met a jour son etat local pour qu'un "aleatoire" reste fige sur la valeur tiree entre deux tirages/relances de la meme section, plutot que de retirer un axe different a chaque relance individuelle. */
  resolvedVariant: Record<string, string>;
}

/** Valeur resolue d'un axe de variante (V2-J7) — `key` pour interpoler la CLE de table d'un emplacement (`"objets-{type}"`), `label` pour interpoler le GABARIT final (l'appelant les fusionne dans `allSlotTexts`). */
export interface ResolvedVariantValue {
  key: string;
  label: string;
}

export interface GeneratorTableDraw {
  generator: GeneratorBlockData;
  slots: GeneratorSlotResult[];
  slotTexts: Record<string, string>;
  /** Emplacements `prose` (V2-J1) en attente — jamais resolus ici, ce module ne connait aucun fournisseur IA (CLAUDE.md regle 12, "aucun appel d'IA hors de src/server/ai/"). */
  proseSlots: PendingProseSlot[];
  /** Axes de variante de l'outil (V2-J7) resolus pour ce tirage — vide si la section n'appartient a aucun outil a variantes. */
  resolvedVariant: Record<string, ResolvedVariantValue>;
}

/**
 * Resout les axes de variante d'un outil (V2-J7) pour un tirage donne —
 * partagee entre `drawTableSlotsFromGeneratorBlock` (tirage reel) et
 * `listGeneratorSectionTables` (V2-J9bis, juste lister les tables sans
 * tirer) : les deux ont besoin exactement du meme calcul de cle resolue +
 * voisins de richesse, jamais divergent. `RANDOM_VARIANT_VALUE` tire une
 * option reelle via `rng` meme ici — lister les tables d'une section dont
 * l'axe est laisse sur "Aleatoire" doit montrer une table concrete, pas un
 * gabarit non resolu.
 */
function resolveGeneratorVariant(
  tool: GeneratorToolConfig | undefined,
  variant: Record<string, string>,
  rng: Rng
): { resolvedVariant: Record<string, ResolvedVariantValue>; variantKeys: Record<string, string> } {
  const resolvedVariant: Record<string, ResolvedVariantValue> = {};
  const variantKeys: Record<string, string> = {};
  for (const axis of tool?.variants ?? []) {
    const chosen = variant[axis.key] ?? axis.options[0]?.key ?? "";
    const resolvedKey = resolveVariantValue(axis, chosen, rng);
    const label = axis.options.find((o) => o.key === resolvedKey)?.label ?? resolvedKey;
    resolvedVariant[axis.key] = { key: resolvedKey, label };
    variantKeys[axis.key] = resolvedKey;
    // V2-J9, retour utilisateur : une fenetre de 3 positions autour de la
    // valeur choisie ("Menu" de taverne — le prix ne doit jamais sauter du
    // miserable au luxe pour une seule taverne), disponible pour tout
    // emplacement qui en a besoin via `{axe_below}`/`{axe_above}` dans sa
    // cle de table — l'emplacement au centre continue a utiliser `{axe}`.
    const { below, above } = orderedNeighbors(axis, resolvedKey);
    variantKeys[`${axis.key}_below`] = below;
    variantKeys[`${axis.key}_above`] = above;
  }
  return { resolvedVariant, variantKeys };
}

/**
 * Applique le filtre par palier d'un emplacement (V2-J9quater, "un
 * fonctionnement qui marche partout pareil" — retour utilisateur) AVANT le
 * tirage — la table peut porter tous les paliers confondus, ce filtre
 * decide lesquelles de ses entrees sont eligibles pour CE tirage. Retourne
 * `table` inchangee si l'emplacement n'a pas de filtre, ou si son axe est
 * introuvable sur l'outil (config incoherente, jamais un echec silencieux
 * de tout le tirage). `null` si le filtre ne laisse aucune entree eligible
 * — l'appelant traite ca comme "table introuvable" (le `{cle}` du gabarit
 * reste tel quel).
 */
function applyTierFilter(
  table: RandomTableBlockData,
  tierConfig: GeneratorTableSlotTier | undefined,
  tool: GeneratorToolConfig | undefined,
  variantKeys: Record<string, string>
): RandomTableBlockData | null {
  if (!tierConfig) return table;
  const axis = tool?.variants?.find((a) => a.key === tierConfig.axis);
  if (!axis) return table;

  const eligible =
    tierConfig.match === "exact"
      ? entriesAtExactTier(renderGeneratorTemplate(tierConfig.target ?? "", variantKeys), table.entries)
      : entriesUpToTier(axis, variantKeys[tierConfig.axis] ?? "", table.entries);

  if (eligible.length === 0) return null;
  return eligible.length === table.entries.length ? table : buildFilteredTable(table, eligible);
}

/**
 * Tire les emplacements `table` du bloc `generator` `blockId` (V1-E2/V2-J1,
 * specs/outils-mj.md §3) : un tirage par emplacement, sur une table
 * `random_table` de la MEME entite (meme discipline que la cascade de
 * V1-E1 — reutilise `findTableBlockByKey`/`resolveCascade` telles quelles,
 * aucun moteur separe). Un emplacement dont la table est introuvable ou
 * illisible (RLS) laisse son `{cle}` tel quel dans le gabarit plutot que
 * de faire echouer tout le tirage — meme discipline que `{table:cle}` dans
 * une cascade, un generateur mal configure reste visible pour etre
 * corrige. Les emplacements `prose` sont collectes, jamais resolus ici
 * (l'appelant les passe a `resolveGeneratorProseSlots`,
 * `src/server/ai/generatorProse.ts`, avec ou sans fournisseur configure).
 * `null` si le bloc n'existe pas ou n'est pas un generateur.
 *
 * `onlySlotKey` (V2-J1 Phase 2, outil MJ decompose "Détails des tirages") :
 * ne traite QUE l'emplacement designe (relance individuelle d'un seul jet)
 * plutot que tous les emplacements du bloc — l'appelant (la route) fusionne
 * alors ce resultat unique avec les valeurs deja connues des autres
 * emplacements (envoyees par le client, qui les conserve en etat React, le
 * serveur restant sans etat comme pour un tirage complet).
 *
 * `variant` (V2-J7) : valeurs choisies par le MJ pour les axes de l'outil
 * auquel appartient cette section (`toolForSectionKey`) — resolues une
 * fois ici (une valeur "aleatoire" tire une option reelle via `rng`), puis
 * la cle de chaque option resolue interpole `{axe}` dans la CLE de table
 * d'un emplacement AVANT sa recherche (`renderGeneratorTemplate`, meme
 * remplaceur generique `{cle}` que pour un gabarit de section).
 */
export async function drawTableSlotsFromGeneratorBlock(
  supabase: TypedClient,
  blockId: string,
  rng: Rng,
  options?: { onlySlotKey?: string; variant?: Record<string, string> }
): Promise<GeneratorTableDraw | null> {
  const block = await getBlockById(supabase, blockId);
  if (!block || block.block_type !== "generator") return null;

  const generator = zGeneratorBlockData.parse(block.data);
  const slotsToProcess = options?.onlySlotKey ? generator.slots.filter((s) => s.key === options.onlySlotKey) : generator.slots;

  const tool: GeneratorToolConfig | undefined = generator.key ? toolForSectionKey(generator.key) : undefined;
  const { resolvedVariant, variantKeys } = resolveGeneratorVariant(tool, options?.variant ?? {}, rng);

  const slots: GeneratorSlotResult[] = [];
  const slotTexts: Record<string, string> = {};
  const proseSlots: PendingProseSlot[] = [];

  for (const slot of slotsToProcess) {
    if (isProseSlot(slot)) {
      proseSlots.push({ key: slot.key, instruction: slot.prose });
      continue;
    }

    const tableKey = renderGeneratorTemplate(slot.table, variantKeys);
    const rawTable = await findTableBlockByKey(supabase, block.entity_id, tableKey);
    if (!rawTable || rawTable.entries.length === 0) continue;
    const table = applyTierFilter(rawTable, slot.tier, tool, variantKeys);
    if (!table) continue;

    if (slot.count && slot.count > 1) {
      // V2-J9 : plusieurs tirages sur la MEME table pour cet emplacement
      // (ex. un menu de taverne) — `drawMultiple` respecte deja
      // `unique_draws`, aucun die/rolled unique a exposer pour un emplacement
      // a plusieurs jets (le panneau "Détails des tirages" l'affiche alors
      // sans cette colonne, deja gere par son rendu conditionnel).
      const draws = drawMultiple(table, slot.count, rng);
      const texts: string[] = [];
      const items: GeneratorSlotItem[] = [];
      const refs: BlockReference[] = [];
      for (const draw of draws) {
        const resolved = await resolveCascade(supabase, block.entity_id, draw, rng, new Set([table.key]), 1);
        texts.push(resolved.text);
        items.push({ text: resolved.text, price: resolved.price });
        refs.push(...resolved.refs);
      }
      const text = joinMultiDrawTexts(texts);
      slots.push({ key: slot.key, text, refs, items });
      slotTexts[slot.key] = text;
      continue;
    }

    const draw = drawOnce(table, rng);
    const resolved = await resolveCascade(supabase, block.entity_id, draw, rng, new Set([table.key]), 1);
    slots.push({ key: slot.key, text: resolved.text, refs: resolved.refs, price: resolved.price, die: table.die, rolled: draw.roll });
    slotTexts[slot.key] = resolved.text;
  }

  return { generator, slots, slotTexts, proseSlots, resolvedVariant };
}

/**
 * Retrouve le bloc `generator` d'une entite par sa cle technique
 * (`GeneratorBlockData.key`, V2-J1 Phase 2) — meme motif que
 * `findTableBlockByKey` pour `random_table` : necessaire seulement quand
 * plusieurs generateurs coexistent sur une entite et doivent etre adresses
 * par cle plutot que par blockId (les sections d'un outil MJ). Retourne
 * l'id du bloc, jamais son contenu — l'appelant relit via `getBlockById`
 * s'il en a besoin.
 */
export async function findGeneratorBlockIdByKey(supabase: TypedClient, entityId: string, key: string): Promise<string | null> {
  const blocks = await listBlocksForEntity(supabase, entityId);
  for (const block of blocks) {
    if (block.block_type !== "generator") continue;
    const parsed = zGeneratorBlockData.safeParse(block.data);
    if (parsed.success && parsed.data.key === key) return block.id;
  }
  return null;
}

/** Une section resolue de l'outil "Générateurs" (V2-J1 Phase 2, fenetre MJ) — le bloc `generator` complet (slots+template), pour que le client sache quoi tirer sans un second aller-retour. */
export interface GeneratorToolSectionWindowData {
  key: string;
  label: string;
  blockId: string;
  data: GeneratorBlockData;
}

export interface GeneratorToolWindowData {
  key: string;
  label: string;
  sections: GeneratorToolSectionWindowData[];
  /** Axes de variante du registre (V2-J7), passes tels quels — absent = aucun selecteur affiche cote client. */
  variants?: GeneratorToolConfig["variants"];
  /** Configuration de promotion du registre (V2-J2), passee telle quelle — absente = bouton "Créer la fiche" masque cote client. */
  promote?: {
    nameSectionKey: string;
    entityKind: string;
    withCreature?: boolean;
    personalitySectionKey?: string;
    withWorldview?: boolean;
    questSectionKey?: string;
  };
}

/**
 * Resout `GENERATOR_TOOLS` (src/core/generators/tools.ts) contre les blocs
 * `generator` reellement presents sur l'entite "Générateurs de MJ"
 * (V2-J1 Phase 2) — une section dont le bloc n'existe pas encore (jamais
 * cense arriver apres `ensureGeneratorToolsEntity`, mais l'appelant ne doit
 * jamais planter si un bloc a ete supprime a la main) est simplement omise
 * plutot que de casser tout l'outil.
 */
export async function resolveGeneratorToolsForEntity(supabase: TypedClient, entityId: string): Promise<GeneratorToolWindowData[]> {
  const blocks = await listBlocksForEntity(supabase, entityId);
  const byKey = new Map<string, { blockId: string; data: GeneratorBlockData }>();
  for (const block of blocks) {
    if (block.block_type !== "generator") continue;
    const parsed = zGeneratorBlockData.safeParse(block.data);
    if (parsed.success && parsed.data.key) byKey.set(parsed.data.key, { blockId: block.id, data: parsed.data });
  }
  return GENERATOR_TOOLS.map((tool) => ({
    key: tool.key,
    label: tool.label,
    sections: tool.sections.flatMap((section) => {
      const found = byKey.get(section.key);
      return found ? [{ key: section.key, label: section.label, blockId: found.blockId, data: found.data }] : [];
    }),
    variants: tool.variants,
    promote: tool.promote,
  }));
}

/**
 * Liste les blocs `random_table` REELLEMENT utilises par une section de
 * generateur pour la variante donnee (V2-J9bis) — le panneau MJ
 * Generateurs n'a aujourd'hui aucun lien vers les tables qu'il tire, il
 * faut naviguer la fiche wiki "Générateurs de MJ" a la main parmi ~90
 * blocs pour en editer une. Reutilise `resolveGeneratorVariant` (meme
 * calcul de cle resolue + voisins de richesse que le tirage reel) pour que
 * "les tables de cette section" corresponde exactement a ce qu'un tirage
 * tirerait avec les memes selecteurs, jamais une liste devinee a part.
 * `null` si le bloc n'existe pas ou n'est pas un generateur — un emplacement
 * dont la table est introuvable est simplement absent du resultat, meme
 * discipline que le tirage lui-meme (`{cle}` reste tel quel plutot que
 * d'echouer tout l'appel).
 */
export async function listGeneratorSectionTables(
  supabase: TypedClient,
  blockId: string,
  rng: Rng,
  variant?: Record<string, string>
): Promise<VisibleBlock[] | null> {
  const block = await getBlockById(supabase, blockId);
  if (!block || block.block_type !== "generator") return null;

  const generator = zGeneratorBlockData.parse(block.data);
  const tool: GeneratorToolConfig | undefined = generator.key ? toolForSectionKey(generator.key) : undefined;
  const { variantKeys } = resolveGeneratorVariant(tool, variant ?? {}, rng);

  const tableKeys = new Set<string>();
  for (const slot of generator.slots) {
    if (isProseSlot(slot)) continue;
    tableKeys.add(renderGeneratorTemplate(slot.table, variantKeys));
  }

  const entityBlocks = await listBlocksForEntity(supabase, block.entity_id);
  const tables: VisibleBlock[] = [];
  for (const key of tableKeys) {
    const row = entityBlocks.find((b) => {
      if (b.block_type !== "random_table") return false;
      const parsed = zRandomTableBlockData.safeParse(b.data);
      return parsed.success && parsed.data.key === key;
    });
    if (row) tables.push(toVisibleBlock(row));
  }
  return tables;
}
