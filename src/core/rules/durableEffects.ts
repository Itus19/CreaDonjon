import { z } from "zod";
import { zEndsOn, type DurableEffect, type DurableEffectEnd } from "../schemas/rule-blocks/playable";
import { zModifier } from "../schemas/rule-blocks/primitives";
import { resolveDeclaredModifiers, type ActiveEffect } from "./sheet";
import type { TriggerEvent } from "./triggers";

/**
 * V3.1-129 (ADR 0060 §3) — les effets qui DURENT, en fonctions pures.
 *
 * Une instance garde ce que sa règle déclare (états, modificateurs déclarés,
 * fins, jeton) plus son ancrage : porteur, source, temps restant. Le temps
 * se compte en ROUNDS (1 minute = 10 rounds ; une heure, 600) : un seul
 * compteur sert en combat (décompté au début du tour de la source) et hors
 * combat (l'avance du temps de scène, les repos). Rien ici n'écrit en base :
 * le service applique ce qui est rendu (V3.1-130).
 */

const ROUNDS_PAR_MINUTE = 10;
const ROUNDS: Record<"round" | "minute" | "hour" | "day", number> = { round: 1, minute: 10, hour: 600, day: 14400 };
/** Un repos fait aussi passer le temps : court, une heure ; long, huit. */
const MINUTES_DE_REPOS = { short: 60, long: 480 } as const;

export interface ActiveDurableEffect {
  /** Identifiant de l'instance (`activation:effet:porteur`) ; le service peut le remplacer par celui de la ligne. */
  instanceId: string;
  effectId: string;
  activationId: string;
  label: string;
  bearer: string;
  source: string;
  conditions: string[];
  modifiers: DurableEffect["modifiers"];
  concentration: boolean;
  endsOn: DurableEffectEnd[];
  /** Rounds restants ; `null` : pas de durée chiffrée (fin de tour, repos, permanent). */
  remainingRounds: number | null;
  /** Fin de tour : de qui, et combien de fins de tour avant de partir. */
  untilTurnEnd: { actor: string; left: number } | null;
  untilRest: boolean;
  /** Jeton : l'activation accordée et les usages restants. */
  tokenGrants: string | null;
  tokenUsesLeft: number;
  /** Round de pose (journal) ; `null` hors combat. */
  startedRound: number | null;
  /** V3.1-158 : la clé de la règle qui l'a posé (`source_key`) — ses formules lisent la table de la classe qui accorde cette règle. */
  ruleKey?: string;
}

/** Le libellé dans la langue demandée, sinon le français, sinon le premier venu. */
export function localized(label: Readonly<Record<string, string>>, locale = "fr"): string {
  return label[locale] ?? label.fr ?? Object.values(label)[0] ?? "";
}

/**
 * Pose une instance. `currentTurn` dit à qui est le tour au moment de la pose :
 * « jusqu'à la fin de votre PROCHAIN tour », posé pendant votre tour, doit
 * survivre à la fin du tour en cours.
 */
export function instantiateDurableEffect(
  def: DurableEffect,
  at: { bearer: string; source: string; activationId: string; round: number | null; currentTurn: string | null; locale?: string },
): ActiveDurableEffect {
  const d = def.duration;
  let remainingRounds: number | null = null;
  let untilTurnEnd: ActiveDurableEffect["untilTurnEnd"] = null;
  if (d.unit === "round" || d.unit === "minute" || d.unit === "hour" || d.unit === "day") {
    remainingRounds = Math.round(d.amount * ROUNDS[d.unit]);
  } else if (d.unit === "until_turn_end") {
    const actor = d.whose === "bearer" ? at.bearer : at.source;
    untilTurnEnd = { actor, left: d.which === "next" && at.currentTurn === actor ? 2 : 1 };
  }
  return {
    instanceId: `${at.activationId}:${def.id}:${at.bearer}`,
    effectId: def.id,
    activationId: at.activationId,
    label: localized(def.label, at.locale),
    bearer: at.bearer,
    source: at.source,
    conditions: [...def.conditions],
    modifiers: [...def.modifiers],
    concentration: def.concentration,
    endsOn: [...def.ends_on],
    remainingRounds,
    untilTurnEnd,
    untilRest: d.unit === "until_rest",
    tokenGrants: def.token?.grants ?? null,
    tokenUsesLeft: def.token?.uses ?? 0,
    startedRound: at.round,
  };
}

/** Ce qui peut faire tomber un effet. `game_event` : un événement du vocabulaire fermé (dégâts subis, mort…). */
export type ExpiryEvent =
  | { kind: "turn_start"; actor: string }
  | { kind: "turn_end"; actor: string }
  | { kind: "round_end" }
  | { kind: "rest"; rest: "short" | "long" }
  | { kind: "time"; minutes: number }
  | { kind: "game_event"; event: TriggerEvent; subject: string }
  | { kind: "dismissed"; by: string; effectInstanceId: string }
  | { kind: "concentration_broken"; source: string };

export type ExpiryReason = "duration" | "rest" | "concentration" | "dismissed" | "token_used" | `ends_on:${TriggerEvent}`;

export interface ExpiryResult {
  kept: ActiveDurableEffect[];
  /** Jamais en silence : chaque effet retiré dit pourquoi, pour le journal. */
  expired: { effect: ActiveDurableEffect; reason: ExpiryReason }[];
}

function decompte(e: ActiveDurableEffect, rounds: number): ActiveDurableEffect {
  return e.remainingRounds === null ? e : { ...e, remainingRounds: Math.max(0, Math.round((e.remainingRounds - rounds) * 1000) / 1000) };
}

/** Un effet face à un événement : `null` s'il reste (éventuellement décompté), sinon la raison de son départ. */
function step(e: ActiveDurableEffect, ev: ExpiryEvent): { next: ActiveDurableEffect } | { reason: ExpiryReason } {
  switch (ev.kind) {
    case "turn_start": {
      if (ev.actor !== e.source || e.remainingRounds === null) return { next: e };
      const n = decompte(e, 1);
      return n.remainingRounds !== null && n.remainingRounds <= 0 ? { reason: "duration" } : { next: n };
    }
    case "turn_end": {
      if (!e.untilTurnEnd || e.untilTurnEnd.actor !== ev.actor) return { next: e };
      const left = e.untilTurnEnd.left - 1;
      return left <= 0 ? { reason: "duration" } : { next: { ...e, untilTurnEnd: { ...e.untilTurnEnd, left } } };
    }
    case "round_end":
      return { next: e };
    case "time":
    case "rest": {
      if (ev.kind === "rest" && e.untilRest) return { reason: "rest" };
      const minutes = ev.kind === "time" ? ev.minutes : MINUTES_DE_REPOS[ev.rest];
      if (e.remainingRounds === null) return { next: e };
      const n = decompte(e, minutes * ROUNDS_PAR_MINUTE);
      return n.remainingRounds !== null && n.remainingRounds <= 0 ? { reason: "duration" } : { next: n };
    }
    case "game_event": {
      const fin = e.endsOn.find(
        (f) => f.event !== "dismissed" && f.event === ev.event && (f.subject === "bearer" ? e.bearer : e.source) === ev.subject,
      );
      return fin ? { reason: `ends_on:${ev.event}` } : { next: e };
    }
    case "dismissed": {
      const permis = e.endsOn.some((f) => f.event === "dismissed") && (ev.by === e.bearer || ev.by === e.source);
      return permis && ev.effectInstanceId === e.instanceId ? { reason: "dismissed" } : { next: e };
    }
    case "concentration_broken":
      return e.concentration && e.source === ev.source ? { reason: "concentration" } : { next: e };
  }
}

/** Applique un événement à tous les effets actifs : ce qui reste (décompté), ce qui part et pourquoi. */
export function expireEffects(effects: readonly ActiveDurableEffect[], ev: ExpiryEvent): ExpiryResult {
  const kept: ActiveDurableEffect[] = [];
  const expired: ExpiryResult["expired"] = [];
  for (const e of effects) {
    const r = step(e, ev);
    if ("next" in r) kept.push(r.next);
    else expired.push({ effect: e, reason: r.reason });
  }
  return { kept, expired };
}

export type TokenResult =
  | { ok: true; grants: string; kept: ActiveDurableEffect[]; expired: ExpiryResult["expired"] }
  | { ok: false; reason: "no_token" | "not_bearer" };

/** Engage un usage du jeton d'un effet ; le dernier usage retire l'effet. Seul le porteur engage son jeton. */
export function consumeToken(effects: readonly ActiveDurableEffect[], p: { instanceId: string; by: string }): TokenResult {
  const cible = effects.find((e) => e.instanceId === p.instanceId && e.tokenGrants !== null && e.tokenUsesLeft > 0);
  if (!cible || cible.tokenGrants === null) return { ok: false, reason: "no_token" };
  if (cible.bearer !== p.by) return { ok: false, reason: "not_bearer" };
  const autres = effects.filter((e) => e !== cible);
  if (cible.tokenUsesLeft > 1) {
    return { ok: true, grants: cible.tokenGrants, kept: effects.map((e) => (e === cible ? { ...e, tokenUsesLeft: e.tokenUsesLeft - 1 } : e)), expired: [] };
  }
  return { ok: true, grants: cible.tokenGrants, kept: autres, expired: [{ effect: cible, reason: "token_used" }] };
}

/** Les effets portés par `bearer`, en effets actifs de la fiche : leurs modificateurs déclarés passent en couche 7. */
export function activeEffectsForSheet(effects: readonly ActiveDurableEffect[], bearer: string): ActiveEffect[] {
  return effects
    .filter((e) => e.bearer === bearer)
    .map((e) => ({
      key: e.instanceId,
      label: e.label,
      modifiers: resolveDeclaredModifiers(e.modifiers, `effect:${e.instanceId}`, e.label, 7),
      ...(e.ruleKey ? { ruleKey: e.ruleKey } : {}),
    }));
}

// ---------------------------------------------------------------------------
// V3.1-130 (ADR 0073) — la forme STOCKÉE d'un effet (`entity_active_effects`).
// Le porteur est la ligne elle-même (entité ou instance de combat) ; le reste
// se range en trois colonnes : `modifiers` (déclarés), `duration` (le temps
// restant) et `payload` (états, fins, jeton, ancrage). Relu par Zod : une
// ligne mal formée est écartée et signalée, jamais devinée.
// ---------------------------------------------------------------------------

export const zStoredEffectDuration = z.object({
  remainingRounds: z.number().nonnegative().nullable(),
  untilTurnEnd: z.object({ actor: z.string().min(1), left: z.number().int().positive() }).nullable(),
  untilRest: z.boolean(),
});

export const zStoredEffectPayload = z.object({
  effectId: z.string().min(1),
  activationId: z.string().min(1),
  /** Identifiant de la source : son entité si elle en a une (un PJ), sinon son instance de combat. */
  source: z.string().min(1),
  conditions: z.array(z.string().min(1)),
  endsOn: z.array(zEndsOn),
  concentration: z.boolean(),
  tokenGrants: z.string().min(1).nullable(),
  tokenUsesLeft: z.number().int().nonnegative(),
  startedRound: z.number().int().nullable(),
});

export interface StoredEffectRow {
  id: string;
  label: string;
  source_key?: string | null;
  modifiers: unknown;
  duration: unknown;
  payload: unknown;
}

/** Les colonnes d'une ligne pour un effet ; `sourceKey` : la clé de la fiche de règle qui l'a posé. */
export function effectToRow(e: ActiveDurableEffect, sourceKey: string) {
  return {
    label: e.label,
    source_key: sourceKey,
    modifiers: e.modifiers,
    duration: { remainingRounds: e.remainingRounds, untilTurnEnd: e.untilTurnEnd, untilRest: e.untilRest },
    payload: {
      effectId: e.effectId,
      activationId: e.activationId,
      source: e.source,
      conditions: e.conditions,
      endsOn: e.endsOn,
      concentration: e.concentration,
      tokenGrants: e.tokenGrants,
      tokenUsesLeft: e.tokenUsesLeft,
      startedRound: e.startedRound,
    },
  };
}

/** Relit une ligne pour le porteur `bearer` (l'identifiant que l'appelant emploie dans ses événements). `null` : ligne mal formée. */
export function effectFromRow(row: StoredEffectRow, bearer: string): ActiveDurableEffect | null {
  const modifiers = z.array(zModifier).safeParse(row.modifiers);
  const duration = zStoredEffectDuration.safeParse(row.duration);
  const payload = zStoredEffectPayload.safeParse(row.payload);
  if (!modifiers.success || !duration.success || !payload.success) return null;
  return {
    instanceId: row.id,
    label: row.label,
    bearer,
    ...(row.source_key ? { ruleKey: row.source_key } : {}),
    modifiers: modifiers.data,
    ...duration.data,
    ...payload.data,
  };
}
