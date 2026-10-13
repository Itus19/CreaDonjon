import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { applyCurrencyDelta, type CurrencyDelta } from "@/src/core/rules/currency";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { listBlocksForEntity } from "@/src/server/repos/blocks";
import { createBlock, updateBlockContent } from "@/src/server/services/blocks";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-24 (ADR 0036 §1) — les pièces et l'équipement restent dans le bloc
 * `inventory` ; ces services en sont le seul chemin d'écriture depuis la fiche
 * et la Table. Ils relisent le bloc, appliquent la règle du noyau
 * (`applyCurrencyDelta` : `depositCoins` / `spendCoins`, platine et électrum hors du
 * regroupement) et l'écrivent avec contrôle de version, par `updateBlockContent` :
 * droit d'édition de l'entité, validation Zod du bloc et UNE révision par geste
 * (l'économie de campagne et le journal lisent le porte-monnaie dans les
 * révisions). Jamais un renvoi du bloc entier par le client.
 */
export type InventoryActionError = "not_found" | "forbidden" | "conflict" | "insufficient_funds" | "item_not_found";

export interface InventoryActionOutcome {
  /** Le bloc tel qu'il est écrit — de quoi rafraîchir l'écran sans le recharger (`onBlockRefreshed`). */
  block: { id: string; version: number; data: InventoryBlockData };
}

const EMPTY_INVENTORY: InventoryBlockData = { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } };

interface LoadedInventory {
  id: string;
  version: number;
  display: Json;
  data: InventoryBlockData;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

/** Le bloc `inventory` de l'entité, ou `null` si elle n'en a pas encore. */
async function loadInventory(supabase: TypedClient, entityId: string): Promise<LoadedInventory | null> {
  const row = (await listBlocksForEntity(supabase, entityId)).find((b) => b.block_type === "inventory");
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    display: row.display,
    data: row.data as unknown as InventoryBlockData,
    visibilityLevel: row.visibility_level,
    visibilityScopeId: row.visibility_scope_id,
  };
}

async function writeInventory(
  supabase: TypedClient,
  current: LoadedInventory,
  next: InventoryBlockData,
  actorUserId: string
): Promise<InventoryActionOutcome | { error: InventoryActionError }> {
  const result = await updateBlockContent(supabase, {
    id: current.id,
    expectedVersion: current.version,
    display: current.display,
    data: next,
    visibilityLevel: current.visibilityLevel,
    visibilityScopeId: current.visibilityScopeId,
    changedBy: actorUserId,
  });
  if (!result.ok) return { error: result.reason === "forbidden" ? "forbidden" : result.reason === "conflict" ? "conflict" : "not_found" };
  return { block: { id: result.block.id, version: result.block.version, data: next } };
}

/**
 * Dépôt (delta positif) et dépense (delta négatif) par pièce. Refus sans rien
 * écrire (`insufficient_funds`) si le total ne suffit pas, même en cassant de
 * plus grosses pièces. Une fiche sans bloc `inventory` en reçoit un à la volée
 * pour un dépôt, comme l'écran le faisait avant.
 */
export async function changeCurrency(
  supabase: TypedClient,
  params: { entityId: string; delta: CurrencyDelta; actorUserId: string }
): Promise<InventoryActionOutcome | { error: InventoryActionError }> {
  let current = await loadInventory(supabase, params.entityId);
  const base = current?.data ?? EMPTY_INVENTORY;
  const currency = applyCurrencyDelta(base.currency, params.delta);
  if (!currency) return { error: "insufficient_funds" };

  if (!current) {
    const created = await createBlock(supabase, {
      entityId: params.entityId,
      blockType: "inventory",
      label: "Inventaire",
      visibilityLevel: "public",
      visibilityScopeId: null,
      createdBy: params.actorUserId,
    });
    if (!created.ok) return { error: created.reason === "forbidden" ? "forbidden" : "conflict" };
    current = {
      id: created.block.id,
      version: created.block.version,
      display: created.block.display as unknown as Json,
      data: EMPTY_INVENTORY,
      visibilityLevel: created.block.visibilityLevel,
      visibilityScopeId: created.block.visibilityScopeId,
    };
  }
  return writeInventory(supabase, current, { ...base, currency }, params.actorUserId);
}

/** Équipe ou déséquipe un objet de l'inventaire. */
export async function setItemEquipped(
  supabase: TypedClient,
  params: { entityId: string; itemId: string; equipped: boolean; actorUserId: string }
): Promise<InventoryActionOutcome | { error: InventoryActionError }> {
  const current = await loadInventory(supabase, params.entityId);
  if (!current) return { error: "item_not_found" };
  if (!current.data.items.some((item) => item.id === params.itemId)) return { error: "item_not_found" };
  const items = current.data.items.map((item) => (item.id === params.itemId ? { ...item, equipped: params.equipped } : item));
  return writeInventory(supabase, current, { ...current.data, items }, params.actorUserId);
}
