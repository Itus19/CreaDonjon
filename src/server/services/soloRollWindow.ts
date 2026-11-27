import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import type { PendingRequest } from "@/src/core/schemas/runtimeState";
import type { PendingRoll, PendingRollKind } from "@/src/core/rules/rollWindow";
import { weaponDiceForRoll } from "@/src/core/rules/action";
import { rollBonus } from "@/src/core/rules/sheet";
import { weaponRollProperties } from "@/src/core/rules/srdMapping";
import type { TriggerZone } from "@/src/core/rules/triggers";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { isWorldAdmin } from "@/src/server/services/permissions";
import type { CharacterActionContext } from "@/src/server/services/characterActions";
import { interveneOnRoll, nomsDesReactions, selfReactorPool } from "@/src/server/services/rollWindows";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-216 — le point de décision DANS la boucle du solo.
 *
 * Jusqu'ici, seuls la table (jet ciblé) et la fiche (test, sauvegarde)
 * s'arrêtaient pour laisser une réaction intervenir : le tour solo, lui,
 * encaissait son dé d'un trait. Esquive instinctive, Coup de chance ou
 * Attaque sournoise ne se proposaient jamais en jouant seul.
 *
 * Le jet du tour passe donc par le même point de décision que partout
 * ailleurs (`interveneOnRoll`, ADR 0075), avec deux différences propres au
 * solo :
 *  - **la portée se lit dans les zones** de la scène (V3-A4) et non sur un
 *    plan, qu'il n'y a pas (`zonePoint`) ;
 *  - **le réservoir est le seul personnage joué** (`selfReactorPool`) : en
 *    solo, personne d'autre ne porte de réaction.
 *
 * Le moteur seul tranche (règle absolue 8) : la narration vient après, et ne
 * dit que ce qui a été joué.
 *
 * Coût (docs/QUOTAS.md, Q1) : **aucune lecture** quand la fiche ne porte
 * aucune activation à déclencheur de jet — le cas de presque tous les
 * personnages et de presque tous les tours. Sinon : la scène, le combat en
 * cours et les effets du personnage, sa fiche étant déjà chargée ; une
 * écriture seulement si une fenêtre s'ouvre.
 */

export type SoloRollWindowResult =
  /** Une fenêtre est ouverte : le tour n'est pas joué, la demande reste posée, l'écran attend la réponse. */
  | { kind: "window"; windowId: string }
  /** Personne n'a de choix à faire : le jet continue, éventuellement modifié par les réactions automatiques (Chance). */
  | { kind: "continue"; natural: number | null; total: number; names: string | null };

const ROLL_KIND: Record<PendingRequest["kind"], PendingRollKind> = {
  weapon_attack: "attack",
  weapon_damage: "damage",
  skill_check: "check",
  ability_check: "check",
  saving_throw: "save",
};

/** `entity:<uuid>` désigne une entité, `participant:<uuid>` une ligne de combat — les deux clés que le réservoir emploie. */
function reactorKey(targetId: string | null): string | null {
  if (targetId === null) return null;
  return targetId.startsWith("entity:") ? targetId.slice("entity:".length) : targetId;
}

/**
 * Sauvagerie martiale : les dés de l'arme d'une demande de dégâts. En solo, le
 * naturel des dégâts est la somme des seuls dés de l'arme (les dés de bonus se
 * lancent à part, `finishResolution`) ; le critique se lit sur la borne haute.
 */
function weaponDiceOf(ctx: CharacterActionContext, pending: PendingRequest, natural: number): { weaponDice?: { count: number; faces: number; sum: number; min?: number } } {
  if (pending.kind !== "weapon_damage") return {};
  const item = ctx.inventoryData?.items.find((i) => i.id === pending.action_id);
  const ref = item && "ref" in item ? item.ref : null;
  const weapon = ref?.kind === "rule" ? ctx.weaponByKey[ref.key] : null;
  if (!weapon) return {};
  const des = weaponDiceForRoll(weapon.damageDice, pending.die_max, natural);
  return des ? { weaponDice: { ...des, ...(pending.die_min ? { min: pending.die_min } : {}) } } : {};
}

/**
 * La plage de critique d'une attaque d'arme du tour solo : celle des règles du
 * personnage (Critique amélioré : 19), lue comme la fiche la lit (`rollBonus`).
 * Hors attaque d'arme : 20.
 */
export function soloCritRange(ctx: CharacterActionContext, pending: PendingRequest): number {
  if (pending.kind !== "weapon_attack") return 20;
  const item = ctx.inventoryData?.items.find((i) => i.id === pending.action_id);
  const ref = item && "ref" in item ? item.ref : null;
  const weapon = ref?.kind === "rule" ? ctx.weaponByKey[ref.key] : null;
  return rollBonus(ctx.sheet, { roll: "attack", kind: "weapon", ...(weapon ? { properties: weaponRollProperties(weapon) } : {}) }).critRange;
}

export async function soloRollWindow(
  supabase: TypedClient,
  params: {
    ctx: CharacterActionContext;
    campaignId: string;
    callerId: string;
    locale: Locale;
    pending: PendingRequest;
    natural: number;
    total: number;
    /** D'où vient le naturel ; la reprise rejouera ce même chemin. */
    origin: "volet" | "a_la_main" | "fiche";
  },
): Promise<SoloRollWindowResult> {
  const sansReaction = { kind: "continue" as const, natural: params.natural, total: params.total, names: null };
  // Q1 : la garde la moins chère possible — sans activation à déclencheur de jet, rien n'est lu.
  if (!params.ctx.sheet.features.some((f) => f.activation?.activations.some((a) => a.trigger?.on === "roll"))) return sansReaction;

  const scene = await getSceneState(supabase, params.campaignId);
  const zones: Record<string, TriggerZone> = Object.fromEntries((scene?.present ?? []).map((p) => [p.entityId, p.zone]));
  const callerIsGm = await isWorldAdmin(supabase, { worldId: params.ctx.worldId, userId: params.callerId });
  // En solo, l'auteur du jet est aussi celui qui répond : la ligne de la fenêtre est à LUI, qu'il administre le monde ou non.
  const { pool, combat } = await selfReactorPool(supabase, {
    campaignId: params.campaignId,
    entityId: params.ctx.entityId,
    userId: params.callerId,
    callerIsGm,
    loaded: params.ctx,
    zones,
    locale: params.locale,
  });

  const kind = ROLL_KIND[params.pending.kind];
  const roll: PendingRoll = {
    kind,
    roller: params.ctx.entityId,
    target: reactorKey(params.pending.target_id),
    natural: kind === "damage" ? null : params.natural,
    total: params.total,
    // La même plage que `finishResolution` : celle des règles du personnage (Critique amélioré).
    critRange: soloCritRange(params.ctx, params.pending),
    ac: kind === "attack" ? params.pending.dc : null,
    dc: kind === "attack" ? null : params.pending.dc,
    acBonus: 0,
    damage: kind === "damage" ? { base: params.total, multiplier: 1, ...weaponDiceOf(params.ctx, params.pending, params.natural) } : null,
  };

  const result = await interveneOnRoll(supabase, {
        callerIsGm,
    campaignId: params.campaignId,
    combat,
    roll,
    pool,
    label: `${params.pending.actor_name} — ${params.pending.what} : ${params.total}`,
    resume: { entityId: params.ctx.entityId, campaignId: params.campaignId, origin: params.origin },
    origin: "solo_turn",
    locale: params.locale,
  });
  if (result.kind === "window") return { kind: "window", windowId: result.windowId };
  if (result.automatic.length === 0) return sansReaction;
  return { kind: "continue", natural: result.roll.natural, total: result.roll.total, names: nomsDesReactions(pool, result.automatic) };
}
