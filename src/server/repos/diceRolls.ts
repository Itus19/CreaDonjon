import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { DiceRollKind } from "@/src/core/dice/rollAttribution";

type TypedClient = SupabaseClient<Database>;

/** Qui lit un jet : tout membre, le MJ seul, ou le lanceur et le MJ (V3.1-33, ADR 0038). */
export type DiceRollVisibility = "public" | "gm" | "roller";

export interface DiceRollRow {
  id: string;
  session_id: string | null;
  campaign_id: string;
  expression: string;
  result: number;
  detail: Json;
  rolled_by: string;
  visibility_level: string;
  created_at: string;
  /** V3.1-89 : le personnage du jet ; null pour un jet libre sans personnage et pour les jets antérieurs. */
  entity_id: string | null;
}

const DICE_ROLL_COLUMNS = "id, session_id, campaign_id, expression, result, detail, rolled_by, visibility_level, created_at, entity_id";

/**
 * V3.1-89 (ADR 0064) : ce que chaque jet dit de lui-même pour les
 * statistiques. OBLIGATOIRE à l'écriture : un chemin qui l'oublie ne compile
 * pas. Le compte qui lance (`rolled_by_user_id`) n'y est pas : la base le
 * pose elle-même (`default auth.uid()`) et refuse toute autre valeur.
 */
export interface DiceRollAttribution {
  entityId: string | null;
  kind: DiceRollKind;
  /** Le d20 gardé (`naturalD20FromTrace`), absent sans d20. */
  naturalD20?: number;
}

/** Un jet ecrit par un bouton de la fiche jouable (V1-B5) ou le volet de lancer de des (V2-M11) : jamais par un modele d'IA (SCHEMA.md §14). */
export async function insertDiceRoll(
  supabase: TypedClient,
  params: {
    sessionId: string | null;
    campaignId: string;
    expression: string;
    ast: Json;
    context: Json;
    result: number;
    detail: Json;
    rolledBy: "player" | "gm" | "ai" | "system";
    /** 'gm' reserve au MJ (RLS `dice_rolls_insert` le refuse sinon) ; 'roller' (V3.1-33) : le lanceur et le MJ — voir `visibility_level`, SCHEMA.md. */
    visibilityLevel: DiceRollVisibility;
    attribution: DiceRollAttribution;
  }
): Promise<DiceRollRow> {
  const base = params.detail && typeof params.detail === "object" && !Array.isArray(params.detail) ? params.detail : {};
  const detail = {
    ...base,
    kind: params.attribution.kind,
    ...(params.attribution.naturalD20 !== undefined ? { naturalD20: params.attribution.naturalD20 } : {}),
  };
  const { data, error } = await supabase
    .from("dice_rolls")
    .insert({
      session_id: params.sessionId,
      campaign_id: params.campaignId,
      expression: params.expression,
      ast: params.ast,
      context: params.context,
      result: params.result,
      detail,
      rolled_by: params.rolledBy,
      visibility_level: params.visibilityLevel,
      entity_id: params.attribution.entityId,
    })
    .select(DICE_ROLL_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Historique d'une campagne pour le volet (onglet Historique, V2-M11) — la RLS `dice_rolls_select` filtre deja les jets `gm` pour un simple joueur, jamais un second filtre ici. */
export async function listDiceRollsForCampaign(
  supabase: TypedClient,
  params: { campaignId: string; limit: number }
): Promise<DiceRollRow[]> {
  const { data, error } = await supabase
    .from("dice_rolls")
    .select(DICE_ROLL_COLUMNS)
    .eq("campaign_id", params.campaignId)
    .order("created_at", { ascending: false })
    .limit(params.limit);
  if (error) throw new Error(error.message);
  return data;
}

/** Un jet tel que les statistiques le lisent (V3.1-89, contrat de V3.1-90). */
export interface RollForStats {
  naturalD20: number | null;
  kind: DiceRollKind | null;
  what: string;
  result: number;
  sessionId: string | null;
  createdAt: string;
}

/**
 * Les jets d'UN personnage pour ses statistiques (V3.1-89, ADR 0064) :
 * seulement les jets PUBLICS. Ni les jets cachés du MJ, ni (V3.1-22) les jets
 * secrets d'un joueur, même lus par leur auteur : un secret ne se déduit pas
 * d'une moyenne. Les jets antérieurs (sans `entity_id`) n'y sont pas.
 * `sinceCreatedAt` : depuis cet instant (le début d'une séance, résolu par le service).
 */
export async function listRollsForStats(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; sinceCreatedAt?: string }
): Promise<RollForStats[]> {
  let query = supabase
    .from("dice_rolls")
    .select("result, detail, session_id, created_at")
    .eq("campaign_id", params.campaignId)
    .eq("entity_id", params.entityId)
    .eq("visibility_level", "public")
    .order("created_at", { ascending: true });
  if (params.sinceCreatedAt) query = query.gte("created_at", params.sinceCreatedAt);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data.map((row) => {
    const detail = (row.detail ?? {}) as { naturalD20?: unknown; kind?: unknown; what?: unknown };
    return {
      naturalD20: typeof detail.naturalD20 === "number" ? detail.naturalD20 : null,
      kind: typeof detail.kind === "string" ? (detail.kind as DiceRollKind) : null,
      what: typeof detail.what === "string" ? detail.what : "",
      result: row.result,
      sessionId: row.session_id,
      createdAt: row.created_at,
    };
  });
}
