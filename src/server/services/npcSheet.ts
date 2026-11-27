import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getRuleEntryForWorld } from "@/src/server/services/rules";
import { createBlockWithData } from "@/src/server/services/blocks";
import { statblockFromMonsterBlocks } from "@/src/core/rules/srdMapping";
import { npcSheetFrom, npcSheetKey } from "@/src/core/rules/npcSheet";
import { npcGear } from "@/src/core/rules/npcGear";
import type { SettlementWealth } from "@/src/core/schemas/blocks/settlement";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { archetypeCalcule } from "@/src/core/rules/sceneLife";
import { deriveSeed } from "@/src/core/worldgen/seed";
import { isWorldAdmin } from "@/src/server/services/permissions";
import type { ActionsBlockData, LegendaryActionsBlockData, StatBlockBlockData, TraitsBlockData } from "@/src/core/schemas/rule-blocks";

type TypedClient = SupabaseClient<Database>;

export type GiveNpcSheetOutcome =
  | { ok: true; templateKey: string; fallback: boolean }
  | { ok: false; reason: "template_not_found" | "forbidden" };

/**
 * V3.2-47 (ADR 0118) — Donne sa fiche allégée à un PNJ qui vient de naître
 * dans le wiki : la fiche du SRD choisie d'après son archétype de vie,
 * ajustée à graine fixe (`npcSheetFrom`), dans un bloc `statblock` réservé au
 * MJ. La personne qui joue la découvrira par indices (V3.2-49, 50).
 *
 * Coût : une lecture de la fiche de règle (et de sa chaîne de rulesets), une
 * création de bloc. Seulement à l'ancrage d'un PNJ, jamais à chaque tour.
 */
export async function giveNpcSheet(
  supabase: TypedClient,
  params: { worldId: string; entityId: string; archetype?: string; seed: number; callerId: string }
): Promise<GiveNpcSheetOutcome> {
  const { key, fallback } = npcSheetKey(params.archetype);
  // Le nom des blocs ne sert pas ici : seules les valeurs du `stat_block` sont reprises.
  const entry = await getRuleEntryForWorld(supabase, params.worldId, key, "fr");
  const statBlock = entry?.blocks.find((b) => b.blockType === "stat_block")?.data as StatBlockBlockData | undefined;
  if (!entry || !statBlock) return { ok: false, reason: "template_not_found" };

  const base = statblockFromMonsterBlocks({
    statBlock,
    traits: entry.blocks.find((b) => b.blockType === "traits")?.data as TraitsBlockData | undefined,
    actions: entry.blocks.find((b) => b.blockType === "actions")?.data as ActionsBlockData | undefined,
    legendaryActions: entry.blocks.find((b) => b.blockType === "legendary_actions")?.data as LegendaryActionsBlockData | undefined,
  });
  const sheet = npcSheetFrom(base, { templateKey: key, ...(params.archetype !== undefined ? { archetype: params.archetype } : {}), seed: params.seed });

  const created = await createBlockWithData(supabase, {
    entityId: params.entityId,
    blockType: "statblock",
    label: "Fiche",
    visibilityLevel: "gm",
    visibilityScopeId: null,
    createdBy: params.callerId,
    data: sheet,
  });
  return created.ok ? { ok: true, templateKey: key, fallback } : { ok: false, reason: "forbidden" };
}

/**
 * V3.2-48 (ADR 0118) — L'équipement probable et la bourse d'un PNJ, dans un
 * bloc `inventory` réservé au MJ (`npcGear`). Les objets portés et visibles se
 * découvriront dès que le PNJ est vu ; les objets cachés, par indice.
 *
 * Coût : une création de bloc, une fois par PNJ.
 */
export async function giveNpcGear(
  supabase: TypedClient,
  params: { entityId: string; archetype?: string; seed: number; wealth: SettlementWealth; callerId: string }
): Promise<{ ok: boolean }> {
  const gear = npcGear({ ...(params.archetype !== undefined ? { archetype: params.archetype } : {}), seed: params.seed, wealth: params.wealth });
  return createBlockWithData(supabase, {
    entityId: params.entityId,
    blockType: "inventory",
    label: "Équipement",
    visibilityLevel: "gm",
    visibilityScopeId: null,
    createdBy: params.callerId,
    data: gear,
  });
}

/** Sans ville en agrégat connue : une richesse moyenne. */
export const DEFAULT_NPC_WEALTH: SettlementWealth = "correcte";

/** Au plus tant de fiches rattrapées par tour : un lieu bondé se remplit en quelques tours, jamais d'un coup. */
const CATCH_UP_PER_TURN = 4;

/**
 * V3.2-47 (retour de l'auteur, 27 novembre) — Le rattrapage : un PNJ présent
 * dans la scène solo sans fiche de personnage (`character`, un PJ ou un PNJ
 * bâti à la main) reçoit ce qui lui manque : fiche allégée (`statblock`) et
 * équipement (`inventory`, V3.2-48).
 * C'est ce qui donne sa fiche à Mabelle, ancrée avant V3.2-47, et à tout PNJ
 * créé à la main sans fiche.
 *
 * Personne calculée (lien `works_at` avec sa graine) : son archétype de vie.
 * Sinon : Roturier, à graine dérivée de l'identifiant de la fiche.
 *
 * Réservé au MJ du monde (en solo : la personne qui joue, propriétaire). Une
 * joueuse ne lit pas les blocs `gm` : elle croirait chaque fiche absente et
 * ne pourrait de toute façon pas l'écrire.
 *
 * Coût : le droit de MJ, une lecture de la scène et une lecture groupée des
 * blocs des présents, à chaque tour ; une fiche de règle lue et un bloc créé par PNJ
 * rattrapé, une seule fois.
 */
export async function ensureNpcSheetsForPresents(
  supabase: TypedClient,
  params: { campaignId: string; worldId: string; actorEntityId: string; callerId: string }
): Promise<{ given: string[] }> {
  if (!(await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.callerId }))) return { given: [] };
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene) return { given: [] };
  const ids = [...new Set(scene.present.map((p) => p.entityId))].filter((id) => id !== params.actorEntityId);
  if (ids.length === 0) return { given: [] };

  const blocks = await listBlocksByTypesForEntities(supabase, ids, ["statblock", "inventory", "character"]);
  const has = (id: string, type: string) => blocks.some((b) => b.entity_id === id && b.block_type === type);
  // Une fiche de personnage (un PJ, un PNJ bâti à la main) n'est jamais complétée d'office.
  const missing = ids
    .filter((id) => !has(id, "character"))
    .map((id) => ({ id, sheet: !has(id, "statblock"), gear: !has(id, "inventory") }))
    .filter((m) => m.sheet || m.gear)
    .slice(0, CATCH_UP_PER_TURN);
  const wealth = scene.life?.settlement.wealth ?? DEFAULT_NPC_WEALTH;

  const given: string[] = [];
  for (const m of missing) {
    const seed = scene.life?.workers.find((w) => w.entityId === m.id)?.seed;
    const archetype = seed !== undefined ? (archetypeCalcule(scene, seed) ?? undefined) : undefined;
    const who = { entityId: m.id, ...(archetype !== undefined ? { archetype } : {}), seed: seed ?? deriveSeed(0, m.id), callerId: params.callerId };
    let ok = true;
    if (m.sheet) {
      const outcome = await giveNpcSheet(supabase, { worldId: params.worldId, ...who });
      if (!outcome.ok) {
        ok = false;
        console.warn(`Pas de fiche allégée rattrapée pour ${m.id} (${outcome.reason})`);
      }
    }
    if (m.gear) {
      const outcome = await giveNpcGear(supabase, { ...who, wealth });
      if (!outcome.ok) {
        ok = false;
        console.warn(`Pas d'équipement rattrapé pour ${m.id}`);
      }
    }
    if (ok) given.push(m.id);
  }
  return { given };
}
