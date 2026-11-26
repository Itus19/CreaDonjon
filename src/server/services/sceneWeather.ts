import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { listPartOfRelationsForWorld } from "@/src/server/repos/relations";
import { getCalendar } from "@/src/server/services/worlds";
import { climateOf, DEFAULT_WORLD_CLIMATE } from "@/src/core/weather/climate";
import { zRoomsBlockData, type RoomsBlockData } from "@/src/core/schemas/blocks/rooms";
import { zSettlementBlockData } from "@/src/core/schemas/blocks/settlement";
import { deriveSeed } from "@/src/core/worldgen/seed";
import type { WeatherContext } from "@/src/core/weather/sceneWeather";

type TypedClient = SupabaseClient<Database>;

/**
 * ME-5 (specs/meteo.md §3, §6) — ce qu'il faut pour calculer la météo d'une
 * scène, lu une fois : le calendrier du monde, et les blocs `settlement`,
 * `rooms`, `price_list` du lieu et de sa ville (`part_of`). Deux lectures
 * en parallèle (trois sans les arêtes déjà connues de l'appelant) ; la
 * météo elle-même se recalcule ensuite sans relire (`weatherForScene`).
 *
 * Toujours le monde de la partie : son calendrier, ses villes, sa graine
 * (§2.6). Sans bloc `settlement`, le climat par défaut et une graine tirée
 * de l'identifiant du monde et de la ville.
 *
 * Pas de filtrage de visibilité ici, et c'est voulu : rien de ces blocs ne
 * part vers le client ou le modèle, seulement la météo calculée et
 * l'exposition de la pièce où se trouve déjà le personnage (règle 5).
 */
export async function loadWeatherContext(
  supabase: TypedClient,
  params: { worldId: string; locationId: string; partOfEdges?: { source_entity_id: string; target_entity_id: string }[] }
): Promise<WeatherContext> {
  const edges = params.partOfEdges ?? (await listPartOfRelationsForWorld(supabase, params.worldId));
  const cityId = edges.find((e) => e.source_entity_id === params.locationId)?.target_entity_id ?? null;
  const ids = cityId ? [params.locationId, cityId] : [params.locationId];
  const [calendar, blocks] = await Promise.all([
    getCalendar(supabase, params.worldId),
    listBlocksByTypesForEntities(supabase, ids, ["settlement", "rooms", "price_list"]),
  ]);

  const settlementOf = (entityId: string) => {
    for (const b of blocks) {
      if (b.entity_id !== entityId || b.block_type !== "settlement") continue;
      const parsed = zSettlementBlockData.safeParse(b.data);
      if (parsed.success) return parsed.data;
      console.error("Bloc settlement illisible, ignoré pour la météo", b.id, parsed.error.issues);
    }
    return null;
  };
  // Le lieu lui-même s'il est une ville, sinon sa ville.
  const settlement = settlementOf(params.locationId) ?? (cityId ? settlementOf(cityId) : null);

  const roomBlocks: RoomsBlockData[] = [];
  for (const b of blocks) {
    if (b.entity_id !== params.locationId || b.block_type !== "rooms") continue;
    const parsed = zRoomsBlockData.safeParse(b.data);
    if (parsed.success) roomBlocks.push(parsed.data);
    else console.error("Bloc rooms illisible, ignoré pour la météo", b.id, parsed.error.issues);
  }

  return {
    climate: climateOf(settlement, DEFAULT_WORLD_CLIMATE),
    seed: settlement ? deriveSeed(settlement.seed, "meteo") : deriveSeed(0, "meteo", params.worldId, cityId ?? params.locationId),
    calendar,
    roomBlocks,
    buildingHint: blocks.some((b) => b.entity_id === params.locationId && b.block_type === "price_list"),
  };
}
