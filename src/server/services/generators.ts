import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Rng } from "@/src/core/dice/rng";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { zGeneratorBlockData, type GeneratorBlockData } from "@/src/core/schemas/blocks/generator";
import { isProseSlot } from "@/src/core/generators/types";
import { drawOnce, drawMultiple } from "@/src/core/tables/roll";
import { getBlockById, listBlocksForEntity } from "@/src/server/repos/blocks";
import { findTableBlockByKey, resolveCascade } from "@/src/server/services/tables";
import type { PendingProseSlot } from "@/src/server/ai/generatorProse";
import { GENERATOR_TOOLS, toolForSectionKey, type GeneratorToolConfig } from "@/src/core/generators/tools";
import { resolveVariantValue, orderedNeighbors } from "@/src/core/generators/variants";
import { renderGeneratorTemplate, joinMultiDrawTexts } from "@/src/core/generators/render";

type TypedClient = SupabaseClient<Database>;

export interface GeneratorSlotResult {
  key: string;
  text: string;
  refs: BlockReference[];
  /** Notation de de et resultat brut du tirage (V2-J1 Phase 2, outil MJ decompose) — presents seulement pour un emplacement `table` : c'est ce que le panneau "Détails des tirages" affiche a cote du texte resolu. */
  die?: string;
  rolled?: number;
  /** Textes individuels d'un emplacement a tirage multiple (V2-J9, `count`), AVANT assemblage dans `text` — permet au client de les afficher en tableau (ex. Menu de taverne) plutot qu'en un seul bloc de texte. Absent pour un tirage simple. */
  items?: string[];
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
  const resolvedVariant: Record<string, ResolvedVariantValue> = {};
  const variantKeys: Record<string, string> = {};
  for (const axis of tool?.variants ?? []) {
    const chosen = options?.variant?.[axis.key] ?? axis.options[0]?.key ?? "";
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

  const slots: GeneratorSlotResult[] = [];
  const slotTexts: Record<string, string> = {};
  const proseSlots: PendingProseSlot[] = [];

  for (const slot of slotsToProcess) {
    if (isProseSlot(slot)) {
      proseSlots.push({ key: slot.key, instruction: slot.prose });
      continue;
    }

    const tableKey = renderGeneratorTemplate(slot.table, variantKeys);
    const table = await findTableBlockByKey(supabase, block.entity_id, tableKey);
    if (!table || table.entries.length === 0) continue;

    if (slot.count && slot.count > 1) {
      // V2-J9 : plusieurs tirages sur la MEME table pour cet emplacement
      // (ex. un menu de taverne) — `drawMultiple` respecte deja
      // `unique_draws`, aucun die/rolled unique a exposer pour un emplacement
      // a plusieurs jets (le panneau "Détails des tirages" l'affiche alors
      // sans cette colonne, deja gere par son rendu conditionnel).
      const draws = drawMultiple(table, slot.count, rng);
      const texts: string[] = [];
      const refs: BlockReference[] = [];
      for (const draw of draws) {
        const resolved = await resolveCascade(supabase, block.entity_id, draw, rng, new Set([table.key]), 1);
        texts.push(resolved.text);
        refs.push(...resolved.refs);
      }
      const text = joinMultiDrawTexts(texts);
      slots.push({ key: slot.key, text, refs, items: texts });
      slotTexts[slot.key] = text;
      continue;
    }

    const draw = drawOnce(table, rng);
    const resolved = await resolveCascade(supabase, block.entity_id, draw, rng, new Set([table.key]), 1);
    slots.push({ key: slot.key, text: resolved.text, refs: resolved.refs, die: table.die, rolled: draw.roll });
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
