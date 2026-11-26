import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { SeededRng } from "@/src/core/dice/rng";
import { GENERATOR_TOOLS } from "@/src/core/generators/tools";
import { resolveSceneVariant } from "@/src/core/generators/sceneVariant";
import { zCustomTableBlockData } from "@/src/core/schemas/blocks/customTable";
import { buildPriceList, lodgingPriceFromRows, lodgingTierForWealth, seedFromId, type MenuSlotDraw } from "@/src/core/rules/priceList";
import { zPriceListBlockData, type OfferPrice, type PriceListBlockData } from "@/src/core/schemas/blocks/priceList";
import { findEntityByKind, getEntityById } from "@/src/server/repos/entities";
import { getBlockById, listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { createBlockWithData } from "@/src/server/services/blocks";
import { canUserEditEntityById } from "@/src/server/services/permissions";
import { listPartOfRelationsForWorld } from "@/src/server/repos/relations";
import { drawTableSlotsFromGeneratorBlock, findGeneratorBlockIdByKey } from "@/src/server/services/generators";
import { infoboxEntriesByPlace, placeChain } from "@/src/server/services/sceneGeneration";
import { getRuleEntryForWorld } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/** L'outil et la section du générateur qui tirent la carte. */
const TAVERN_TOOL_KEY = "taverne";
const MENU_SECTION_KEY = "taverne-menu";
/** La fiche du SRD 2024 qui porte le prix d'une nuit (V2-J14, `scripts/write-lifestyle-expenses-2024.ts`). */
const LIFESTYLE_ENTRY_KEY = "lifestyle-expenses";

export type PriceListDrawError = "no_generators" | "no_menu";
export type PriceListBlockDrawError = PriceListDrawError | "not_found" | "not_a_price_list" | "forbidden";
export type ScenePriceListError = PriceListDrawError | "no_scene" | "not_found" | "forbidden" | "write_failed";

/** Le prix d'une nuit au palier donné, lu dans les tableaux de la fiche « Train de vie » du monde ; `null` si la fiche ou la ligne manque. */
async function lodgingPrice(supabase: TypedClient, worldId: string, tier: string, locale: Locale): Promise<OfferPrice | null> {
  const entry = await getRuleEntryForWorld(supabase, worldId, LIFESTYLE_ENTRY_KEY, locale);
  if (!entry) return null;
  for (const block of entry.blocks) {
    if (block.blockType !== "custom_table") continue;
    const table = zCustomTableBlockData.safeParse(block.data);
    if (!table.success) continue;
    const price = lodgingPriceFromRows(table.data.rows, tier);
    if (price) return price;
  }
  return null;
}

/**
 * V3.2-9 (ADR 0110) — tire la carte d'un lieu, sans rien écrire.
 *
 * La graine vient de l'identifiant du lieu : tirer deux fois la carte du même
 * lieu rend la même carte, tant que les tables n'ont pas changé. La richesse
 * vient de l'infobox du lieu puis de ses parents (`resolveSceneVariant`, la
 * même lecture que le solo) ; à défaut, elle est tirée par la même graine et
 * retenue dans le bloc. La nuit vient de la fiche « Train de vie », le reste
 * du Menu de la Taverne. Aucun prix n'est inventé ici.
 *
 * Coût (docs/QUOTAS.md) : une lecture des relations du monde, une des
 * infobox de la chaîne de lieux, une recherche de l'entité des générateurs et
 * de la section, le tirage lui-même (une lecture par table de la section),
 * et la résolution d'une fiche de règle. Appelé sur un geste, jamais en boucle.
 */
export async function drawPriceListForLocation(
  supabase: TypedClient,
  params: { worldId: string; locationId: string; locale: Locale }
): Promise<{ data: PriceListBlockData } | { error: PriceListDrawError }> {
  const tool = GENERATOR_TOOLS.find((t) => t.key === TAVERN_TOOL_KEY);
  const generatorsEntity = await findEntityByKind(supabase, params.worldId, "generateur");
  if (!tool || !generatorsEntity) return { error: "no_generators" };
  const menuBlockId = await findGeneratorBlockIdByKey(supabase, generatorsEntity.id, MENU_SECTION_KEY);
  if (!menuBlockId) return { error: "no_menu" };

  const edges = await listPartOfRelationsForWorld(supabase, params.worldId);
  const places = await infoboxEntriesByPlace(supabase, placeChain(params.locationId, edges));

  const seed = seedFromId(params.locationId);
  const rng = new SeededRng(seed);
  const variant = resolveSceneVariant(tool.variants ?? [], places, {}, rng);
  const variantKeys = Object.fromEntries(Object.entries(variant).map(([axis, v]) => [axis, v.key]));
  const wealth = variant.wealth?.key ?? null;

  const draw = await drawTableSlotsFromGeneratorBlock(supabase, menuBlockId, rng, { variant: variantKeys });
  if (!draw) return { error: "no_menu" };
  const menuSlots: MenuSlotDraw[] = draw.slots.map((slot) => ({
    key: slot.key,
    text: slot.text,
    ...(slot.price ? { price: slot.price } : {}),
    ...(slot.items ? { items: slot.items } : {}),
  }));

  const tier = wealth ? lodgingTierForWealth(wealth) : null;
  const lodging = tier ? await lodgingPrice(supabase, params.worldId, tier, params.locale) : null;

  return { data: buildPriceList({ wealth, seed, lodging, menuSlots }) };
}

/**
 * Le bouton « Tirer la carte » d'un bloc `price_list` du wiki : tire la carte
 * du lieu qui porte le bloc et la RENVOIE, sans l'écrire. L'éditeur la pose
 * dans son état et l'enregistre par le chemin ordinaire des blocs (version
 * attendue comprise), comme toute autre modification : aucune seconde voie
 * d'écriture. Réservé à qui peut modifier la fiche (`canUserEditEntityById`) :
 * le tirage lit les tables du MJ.
 */
export async function drawPriceListForBlock(
  supabase: TypedClient,
  params: { blockId: string; userId: string; locale: Locale }
): Promise<{ data: PriceListBlockData } | { error: PriceListBlockDrawError }> {
  const block = await getBlockById(supabase, params.blockId);
  if (!block) return { error: "not_found" };
  // « Refusé » avant tout autre motif (docs/SECURITE.md §2).
  const allowed = await canUserEditEntityById(supabase, { entityId: block.entity_id, userId: params.userId });
  if (!allowed) return { error: "forbidden" };
  if (block.block_type !== "price_list") return { error: "not_a_price_list" };
  const entity = await getEntityById(supabase, block.entity_id);
  if (!entity) return { error: "not_found" };
  return drawPriceListForLocation(supabase, { worldId: entity.world_id, locationId: entity.id, locale: params.locale });
}

/**
 * V3.2-10 — « Tirer la carte du lieu », depuis le solo : un achat demandé dans
 * un lieu qui n'a pas encore de carte. Tire la carte du lieu de la scène (même
 * tirage, même graine que le bouton du wiki) et l'ÉCRIT sur sa page, dans un
 * bloc « Carte et tarifs » public : elle ne bouge plus ensuite (ADR 0104, un
 * détail se fige quand on le découvre), et l'auteur peut la corriger.
 *
 * Un lieu qui a déjà une carte la garde : rien n'est retiré ni réécrit, et
 * elle est rendue telle quelle. La carte rendue part à l'écran, qui la lit
 * aussitôt sans relire toute la page (docs/CABLAGE.md). Le
 * droit d'écrire est vérifié avant le tirage (docs/SECURITE.md §2) ; il est
 * vérifié une seconde fois par `createBlock`, qui reste la seule porte.
 *
 * Coût (docs/QUOTAS.md) : la scène, une lecture des cartes du lieu, le droit,
 * le tirage (voir `drawPriceListForLocation`), puis la création du bloc (une
 * insertion, une mise à jour, deux révisions). Sur un geste, une fois par lieu.
 */
export async function drawPriceListForScene(
  supabase: TypedClient,
  params: { campaignId: string; worldId: string; userId: string; locale: Locale }
): Promise<{ created: boolean; priceList: PriceListBlockData } | { error: ScenePriceListError }> {
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene) return { error: "no_scene" };
  const location = await getEntityById(supabase, scene.locationId);
  if (!location || location.world_id !== params.worldId) return { error: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: location.id, userId: params.userId });
  if (!allowed) return { error: "forbidden" };

  const existing = await listBlocksByTypeForEntities(supabase, [location.id], "price_list");
  if (existing.length > 0) {
    const parsed = zPriceListBlockData.safeParse(existing[0].data);
    if (parsed.success) return { created: false, priceList: parsed.data };
    console.error("Carte du lieu illisible, gardée telle quelle", location.id, parsed.error.issues);
    return { error: "write_failed" };
  }

  const drawn = await drawPriceListForLocation(supabase, { worldId: params.worldId, locationId: location.id, locale: params.locale });
  if ("error" in drawn) return drawn;
  const written = await createBlockWithData(supabase, {
    entityId: location.id,
    blockType: "price_list",
    label: "Carte et tarifs",
    visibilityLevel: "public",
    visibilityScopeId: null,
    createdBy: params.userId,
    data: drawn.data,
  });
  return written.ok ? { created: true, priceList: drawn.data } : { error: "write_failed" };
}
