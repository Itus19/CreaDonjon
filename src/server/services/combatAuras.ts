import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { aurasCovering, type AuraSource } from "@/src/core/rules/auras";
import { distance, type Point } from "@/src/core/rules/geometry";
import type { ActiveEffect } from "@/src/core/rules/sheet";
import { getActiveCombatForCampaign, listCombatParticipants, type CombatParticipantRow } from "@/src/server/repos/combats";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { resolveCharacterActionContext, type CharacterActionContext } from "@/src/server/services/characterActions";
import { actorNumbersFor } from "@/src/server/services/actorNumbers";
import { readCombatParticipantsSigned } from "@/src/server/services/engineSigning";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/** Aucune aura du SRD ne dépasse 9 m (Aura étendue) ; une marge, pour ne charger que les fiches proches. */
const PORTEE_MAX_AURA = 18;

const posOf = (p: CombatParticipantRow): Point | null => (p.pos_x !== null && p.pos_y !== null ? { x: Number(p.pos_x), y: Number(p.pos_y) } : null);
const conditionsOf = (p: CombatParticipantRow) => (Array.isArray(p.conditions) ? p.conditions.filter((c): c is string => typeof c === "string") : []);

function sourcesOf(ctx: Pick<CharacterActionContext, "characterData" | "sheet">, row: CombatParticipantRow, team: string): AuraSource[] {
  return ctx.sheet.features
    .filter((f) => (f.auras ?? []).length > 0)
    .map((f) => ({ id: row.id, pos: posOf(row), team, conditions: conditionsOf(row), numbers: actorNumbersFor(ctx, f.key), label: f.label, auras: f.auras ?? [] }));
}

/**
 * V3.1-169 (ADR 0077) — les auras qu'un personnage reçoit sur le plan du
 * combat en cours : celles des PJ posés près de lui (Aura de protection), et
 * les siennes si elles le couvrent (`self`). Rendues comme des effets en
 * couche 7, à passer à `resolveCharacterActionContext` ; recalculées à chaque
 * jet, jamais stockées (règle 16). Rien hors combat, ou sans position.
 *
 * `self` : la fiche déjà chargée du personnage (ses propres auras), pour ne
 * pas la relire.
 *
 * Coût (QUOTAS) : le combat, ses participants (lecture signée chez une
 * joueuse), les PJ de la campagne, et une fiche par AUTRE PJ posé à 18 m ou
 * moins ; appelé seulement par les jets qui lisent une aura (sauvegardes).
 */
export async function receivedAurasFor(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string; locale: Locale; callerIsGm: boolean; self?: CharacterActionContext },
): Promise<ActiveEffect[]> {
  const combat = await getActiveCombatForCampaign(supabase, params.campaignId);
  if (!combat || (combat.status !== "running" && combat.status !== "rolling")) return [];
  const participants = params.callerIsGm
    ? await listCombatParticipants(supabase, combat.id)
    : await readCombatParticipantsSigned(supabase, { campaignId: params.campaignId, combatId: combat.id });
  const cible = participants.find((p) => p.entity_id === params.entityId);
  const posCible = cible ? posOf(cible) : null;
  if (!cible || !posCible) return [];

  const pcs = new Set((await listCampaignCharacters(supabase, params.campaignId)).filter((c) => c.is_pc).map((c) => c.entity_id));
  const teamOf = (p: CombatParticipantRow) => (p.is_ally || (p.entity_id !== null && pcs.has(p.entity_id)) ? "pj" : "adv");

  const proches = participants.filter((p) => {
    const pos = posOf(p);
    return p.id !== cible.id && p.entity_id !== null && pcs.has(p.entity_id) && pos !== null && distance(pos, posCible) <= PORTEE_MAX_AURA;
  });
  const fiches = await Promise.all(proches.map((p) => resolveCharacterActionContext(supabase, p.entity_id!, params.campaignId, params.locale)));
  const sources: AuraSource[] = proches.flatMap((p, i) => {
    const ctx = fiches[i];
    return ctx ? sourcesOf(ctx, p, teamOf(p)) : [];
  });
  if (params.self) sources.push(...sourcesOf(params.self, cible, teamOf(cible)));

  return aurasCovering({ target: { id: cible.id, pos: posCible, team: teamOf(cible) }, sources }).map((r) => ({
    key: r.key,
    label: r.label,
    modifiers: r.modifiers.map((m) => ({ target: m.target, op: m.op, ...(m.value === undefined ? {} : { value: m.value }), source: r.key, label: `${r.label} (aura)`, layer: 7 as const })),
  }));
}

/**
 * La fiche d'un personnage avec les auras qu'il reçoit : relue seulement si
 * une aura le couvre (le cas courant ne coûte que la lecture du combat).
 */
export async function withReceivedAuras(
  supabase: TypedClient,
  ctx: CharacterActionContext,
  params: { campaignId: string; locale: Locale; callerIsGm: boolean },
): Promise<CharacterActionContext> {
  const auras = await receivedAurasFor(supabase, { entityId: ctx.entityId, ...params, self: ctx });
  if (auras.length === 0) return ctx;
  return (await resolveCharacterActionContext(supabase, ctx.entityId, params.campaignId, params.locale, { receivedAuras: auras })) ?? ctx;
}
