import { z } from "zod";
import type { Rng } from "../dice/rng";
import type { FormulaNode } from "../formula/ast";
import { evaluate } from "../formula/evaluate";
import { zFormulaNode } from "../schemas/rule-blocks/primitives";
import type { Modifier } from "./sheet";

/**
 * V3-A1 — Les declencheurs, en donnees (specs/moteur-de-jeu.md §4).
 *
 * Module PUR : aucun import de `next`, `react` ni `@supabase` (regle ESLint
 * de CLAUDE.md). Aucune I/O, aucun `Math.random()` — le RNG est injecte.
 *
 * Le pari de ce fichier : une regle comme « la concentration se rompt quand
 * on subit des degats » doit s'ecrire ENTIEREMENT en donnees. Le mot
 * "concentration" n'apparait nulle part ici, et c'est le test qui compte
 * (`triggers.test.ts`, cas dore n° 1). Si une regle exige d'ajouter du code
 * specifique dans ce fichier, le mecanisme est mauvais — et la spec §3
 * demande d'en tenir le compte : a la troisieme, on rouvre la question.
 */

/** Vocabulaire FERME (spec §4). Ajouter un evenement est une decision consignee en ADR, jamais un ajout a la volee. */
export const TRIGGER_EVENTS = [
  "turn_start",
  "turn_end",
  "round_start",
  "round_end",
  "attack_hit",
  "attack_miss",
  "damage_taken",
  "damage_dealt",
  "save_passed",
  "save_failed",
  "condition_applied",
  "condition_removed",
  "spell_cast",
  "movement",
  "short_rest",
  "long_rest",
  "enters_area",
  "dies",
] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

/** Trois zones abstraites, jamais une grille tactique (spec §6). */
export const TRIGGER_ZONES = ["engaged", "near", "far"] as const;
export type TriggerZone = (typeof TRIGGER_ZONES)[number];
const ZONE_RANK: Record<TriggerZone, number> = { engaged: 0, near: 1, far: 2 };

/** Les quatre bornes obligatoires de la spec §4. Sans elles, deux regles qui se repondent bloquent la partie. */
export const TRIGGER_LIMITS = {
  maxChainDepth: 4,
  maxTriggersPerEvent: 32,
  maxEffectsPerTrigger: 8,
} as const;

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/**
 * Le `if` d'un declencheur.
 *
 * DECISION : type SEPARE de `FormulaNode`, qui reste purement numerique.
 * La spec dit « le `if` est un noeud d'AST, etendu de quelques operations
 * booleennes » ; le prendre au pied de la lettre obligerait `evaluate()` a
 * renvoyer `number | boolean`, donc a toucher un evaluateur, un formateur et
 * un parseur deja eprouves, pour le seul benefice d'un type commun. Ici les
 * feuilles NUMERIQUES restent de vrais `FormulaNode` evalues par
 * `evaluate()` sans la moindre modification : c'est bien « aucune grammaire
 * nouvelle » du cote des nombres, et zero risque du cote des formules.
 */
export type ConditionNode =
  | { op: "and"; args: ConditionNode[] }
  | { op: "or"; args: ConditionNode[] }
  | { op: "not"; args: [ConditionNode] }
  | { op: "eq"; args: [FormulaNode, FormulaNode] }
  | { op: "gte"; args: [FormulaNode, FormulaNode] }
  | { op: "lte"; args: [FormulaNode, FormulaNode] }
  | { op: "has_condition"; who: string; key: string }
  | { op: "has_feature"; who: string; key: string }
  | { op: "in_range"; who: string; of: string; zone: TriggerZone };

// ---------------------------------------------------------------------------
// Effets
// ---------------------------------------------------------------------------

/** Vocabulaire d'effets FERME (spec §4), meme discipline que les evenements. */
export type EffectNode =
  | { action: "saving_throw"; who: string; ability: string; dc: FormulaNode; on_fail?: EffectNode[]; on_pass?: EffectNode[] }
  | { action: "apply_modifier"; who: string; modifier: Modifier }
  | { action: "apply_condition"; who: string; key: string }
  | { action: "remove_condition"; who: string; key: string }
  | { action: "deal_damage"; who: string; amount: FormulaNode; damage_type?: string }
  | { action: "heal"; who: string; amount: FormulaNode }
  | { action: "spend_resource"; who: string; key: string; amount: FormulaNode }
  | { action: "move"; who: string; zone: TriggerZone }
  | { action: "roll"; label: string; formula: FormulaNode }
  | { action: "narrate_hint"; text: string };

/** Ce que l'evaluateur RESTITUE : le meme effet, formules deja resolues en nombres. L'appelant applique, il ne calcule plus. */
export type ResolvedEffect =
  | { action: "saving_throw"; who: string; ability: string; dc: number; roll: number; total: number; passed: boolean }
  | { action: "apply_modifier"; who: string; modifier: Modifier }
  | { action: "apply_condition"; who: string; key: string }
  | { action: "remove_condition"; who: string; key: string }
  | { action: "deal_damage"; who: string; amount: number; damage_type?: string }
  | { action: "heal"; who: string; amount: number }
  | { action: "spend_resource"; who: string; key: string; amount: number }
  | { action: "move"; who: string; zone: TriggerZone }
  | { action: "roll"; label: string; value: number }
  | { action: "narrate_hint"; text: string };

export interface Trigger {
  id: string;
  when: { event: TriggerEvent; subject?: string };
  if?: ConditionNode;
  then: EffectNode[];
  /**
   * DECISION (question laissee ouverte par la spec, tranchee ici) : l'ordre
   * de deux declencheurs sur le meme evenement est une priorite entiere
   * DECROISSANTE, et a egalite l'ordre de declaration. Meme mecanisme que
   * les couches de modificateurs de `sheet.ts` — un seul concept d'ordre
   * dans le moteur, pas deux.
   */
  priority?: number;
}

// ---------------------------------------------------------------------------
// Schema Zod
// ---------------------------------------------------------------------------

const zZone = z.enum(TRIGGER_ZONES);

const zCondition: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    z.object({ op: z.literal("and"), args: z.array(zCondition).min(1) }),
    z.object({ op: z.literal("or"), args: z.array(zCondition).min(1) }),
    z.object({ op: z.literal("not"), args: z.tuple([zCondition]) }),
    z.object({ op: z.literal("eq"), args: z.tuple([zFormulaNode, zFormulaNode]) }),
    z.object({ op: z.literal("gte"), args: z.tuple([zFormulaNode, zFormulaNode]) }),
    z.object({ op: z.literal("lte"), args: z.tuple([zFormulaNode, zFormulaNode]) }),
    z.object({ op: z.literal("has_condition"), who: z.string().min(1), key: z.string().min(1) }),
    z.object({ op: z.literal("has_feature"), who: z.string().min(1), key: z.string().min(1) }),
    z.object({ op: z.literal("in_range"), who: z.string().min(1), of: z.string().min(1), zone: zZone }),
  ]),
);

const zModifier: z.ZodType<Modifier> = z.object({
  target: z.string().min(1),
  op: z.enum(["add", "set", "min", "max", "advantage", "disadvantage", "proficiency", "expertise"]),
  value: z.number().optional(),
  source: z.string().min(1),
  label: z.string().min(1),
  layer: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
  stacking: z.enum(["stack", "highest", "unique"]).optional(),
});

const zEffect: z.ZodType<EffectNode> = z.lazy(() =>
  z.union([
    z.object({
      action: z.literal("saving_throw"),
      who: z.string().min(1),
      ability: z.string().min(1),
      dc: zFormulaNode,
      on_fail: z.array(zEffect).max(TRIGGER_LIMITS.maxEffectsPerTrigger).optional(),
      on_pass: z.array(zEffect).max(TRIGGER_LIMITS.maxEffectsPerTrigger).optional(),
    }),
    z.object({ action: z.literal("apply_modifier"), who: z.string().min(1), modifier: zModifier }),
    z.object({ action: z.literal("apply_condition"), who: z.string().min(1), key: z.string().min(1) }),
    z.object({ action: z.literal("remove_condition"), who: z.string().min(1), key: z.string().min(1) }),
    z.object({
      action: z.literal("deal_damage"),
      who: z.string().min(1),
      amount: zFormulaNode,
      damage_type: z.string().min(1).optional(),
    }),
    z.object({ action: z.literal("heal"), who: z.string().min(1), amount: zFormulaNode }),
    z.object({
      action: z.literal("spend_resource"),
      who: z.string().min(1),
      key: z.string().min(1),
      amount: zFormulaNode,
    }),
    z.object({ action: z.literal("move"), who: z.string().min(1), zone: zZone }),
    z.object({ action: z.literal("roll"), label: z.string().min(1), formula: zFormulaNode }),
    z.object({ action: z.literal("narrate_hint"), text: z.string().min(1) }),
  ]),
);

export const zTrigger: z.ZodType<Trigger> = z.object({
  id: z.string().min(1),
  when: z.object({ event: z.enum(TRIGGER_EVENTS), subject: z.string().min(1).optional() }),
  if: zCondition.optional(),
  then: z.array(zEffect).min(1).max(TRIGGER_LIMITS.maxEffectsPerTrigger),
  priority: z.number().int().optional(),
});

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export interface TriggerActorState {
  conditions: readonly string[];
  features: readonly string[];
  /** Valeurs referencables par un `ref` de formule, ex. `save.con`, `hp.current`. */
  numbers: Readonly<Record<string, number>>;
  zone?: TriggerZone;
}

export interface TriggerContext {
  actors: Readonly<Record<string, TriggerActorState>>;
}

export interface FiredEvent {
  event: TriggerEvent;
  /** Acteur concerne, ex. "self". Un declencheur qui precise `when.subject` ne part que pour celui-la. */
  subject: string;
  /** Donnees de l'evenement, deja prefixees `event.` pour etre lisibles par un `ref`. */
  data?: Readonly<Record<string, number>>;
}

/** Les bornes sont des erreurs de RUN : elles arretent tout, parce que la terminaison est en jeu. */
export type TriggerErrorCode = "chain_depth_exceeded" | "too_many_triggers";

export interface TriggerFailure {
  triggerId: string;
  reason: string;
}

export interface TriggerRunResult {
  effects: ResolvedEffect[];
  /** Une ligne par declencheur parti, dans l'ordre. */
  trace: string[];
  /**
   * V3-A2 : un declencheur qui echoue est journalise, JAMAIS silencieux, et
   * n'interrompt pas le tour. Une regle maison mal formee (un acteur qui
   * n'est pas dans la scene, une reference inconnue) ne doit pas figer une
   * partie en cours — elle doit se voir. C'est l'inverse d'un `catch` muet,
   * que CLAUDE.md interdit : l'erreur est conservee et rendue a l'appelant.
   */
  failures: TriggerFailure[];
  error?: { code: TriggerErrorCode; message: string };
}

/**
 * Un effet qui EST un evenement relance la chaine. Table fermee et
 * deliberement courte : c'est elle qui rend le chainage possible sans
 * qu'aucun appelant n'ait a reinjecter quoi que ce soit, et c'est donc elle
 * qu'il faut relire avant d'ajouter un effet.
 */
function followUpEvent(effect: ResolvedEffect): FiredEvent | null {
  switch (effect.action) {
    case "deal_damage":
      return { event: "damage_taken", subject: effect.who, data: { "event.damage": effect.amount } };
    case "apply_condition":
      return { event: "condition_applied", subject: effect.who };
    case "remove_condition":
      return { event: "condition_removed", subject: effect.who };
    case "move":
      return { event: "movement", subject: effect.who };
    default:
      return null;
  }
}

function actor(ctx: TriggerContext, who: string): TriggerActorState {
  const found = ctx.actors[who];
  if (!found) throw new Error(`Acteur "${who}" absent de la scene.`);
  return found;
}

/** Contexte numerique d'un `ref` : les donnees de l'evenement, plus les valeurs du sujet. */
function refContext(ctx: TriggerContext, fired: FiredEvent): Record<string, number> {
  const subject = ctx.actors[fired.subject];
  return { ...(subject?.numbers ?? {}), ...(fired.data ?? {}) };
}

function evalNumber(node: FormulaNode, ctx: TriggerContext, fired: FiredEvent, rng: Rng): number {
  return evaluate(node, refContext(ctx, fired), rng, "roll").value;
}

function evalCondition(node: ConditionNode, ctx: TriggerContext, fired: FiredEvent, rng: Rng): boolean {
  switch (node.op) {
    case "and":
      return node.args.every((a) => evalCondition(a, ctx, fired, rng));
    case "or":
      return node.args.some((a) => evalCondition(a, ctx, fired, rng));
    case "not":
      return !evalCondition(node.args[0], ctx, fired, rng);
    case "eq":
      return evalNumber(node.args[0], ctx, fired, rng) === evalNumber(node.args[1], ctx, fired, rng);
    case "gte":
      return evalNumber(node.args[0], ctx, fired, rng) >= evalNumber(node.args[1], ctx, fired, rng);
    case "lte":
      return evalNumber(node.args[0], ctx, fired, rng) <= evalNumber(node.args[1], ctx, fired, rng);
    case "has_condition":
      return actor(ctx, node.who).conditions.includes(node.key);
    case "has_feature":
      return actor(ctx, node.who).features.includes(node.key);
    case "in_range": {
      // Sans grille tactique : deux acteurs sont "a portee" d'une bande quand
      // tous deux s'y trouvent. `near` couvre donc engaged ET near — c'est ce
      // que veut dire une aura de paladin. V3-A4, qui tiendra le vrai
      // `SceneState`, pourra affiner ; la semantique est ici, pas ailleurs.
      const a = actor(ctx, node.who).zone;
      const b = actor(ctx, node.of).zone;
      if (!a || !b) return false;
      const limit = ZONE_RANK[node.zone];
      return ZONE_RANK[a] <= limit && ZONE_RANK[b] <= limit;
    }
  }
}

/** Resout un effet. Renvoie l'effet resolu, plus les effets a enchainer dans la FOULEE (branches d'un jet de sauvegarde). */
function resolveEffect(
  effect: EffectNode,
  ctx: TriggerContext,
  fired: FiredEvent,
  rng: Rng,
): { resolved: ResolvedEffect; branch: EffectNode[] } {
  switch (effect.action) {
    case "saving_throw": {
      const dc = evalNumber(effect.dc, ctx, fired, rng);
      // Le de est lance ICI, par le moteur. Jamais par un modele (CLAUDE.md regle 8).
      const roll = rng.nextInt(20) + 1;
      const bonus = actor(ctx, effect.who).numbers[`save.${effect.ability}`] ?? 0;
      const total = roll + bonus;
      const passed = total >= dc;
      return {
        resolved: { action: "saving_throw", who: effect.who, ability: effect.ability, dc, roll, total, passed },
        branch: (passed ? effect.on_pass : effect.on_fail) ?? [],
      };
    }
    case "deal_damage":
      return {
        resolved: {
          action: "deal_damage",
          who: effect.who,
          amount: evalNumber(effect.amount, ctx, fired, rng),
          ...(effect.damage_type ? { damage_type: effect.damage_type } : {}),
        },
        branch: [],
      };
    case "heal":
      return { resolved: { action: "heal", who: effect.who, amount: evalNumber(effect.amount, ctx, fired, rng) }, branch: [] };
    case "spend_resource":
      return {
        resolved: {
          action: "spend_resource",
          who: effect.who,
          key: effect.key,
          amount: evalNumber(effect.amount, ctx, fired, rng),
        },
        branch: [],
      };
    case "roll":
      return { resolved: { action: "roll", label: effect.label, value: evalNumber(effect.formula, ctx, fired, rng) }, branch: [] };
    default:
      return { resolved: effect, branch: [] };
  }
}

/**
 * Fait partir les declencheurs qu'un evenement reveille, et suit la chaine
 * que leurs effets provoquent.
 *
 * Termine TOUJOURS : les bornes de `TRIGGER_LIMITS` en font une propriete de
 * construction, pas une esperance. Depasser une borne renvoie une erreur
 * explicite avec les effets deja resolus — jamais une boucle, jamais un
 * echec muet.
 */
export function runTriggers(params: {
  event: FiredEvent;
  triggers: readonly Trigger[];
  ctx: TriggerContext;
  rng: Rng;
}): TriggerRunResult {
  const { triggers, ctx, rng } = params;
  const effects: ResolvedEffect[] = [];
  const trace: string[] = [];
  const failures: TriggerFailure[] = [];

  const queue: { fired: FiredEvent; depth: number }[] = [{ fired: params.event, depth: 1 }];

  while (queue.length > 0) {
      const { fired, depth } = queue.shift()!;

      if (depth > TRIGGER_LIMITS.maxChainDepth) {
        return {
          effects,
          trace,
          failures,
          error: {
            code: "chain_depth_exceeded",
            message: `Chaine de declencheurs interrompue : profondeur maximale ${TRIGGER_LIMITS.maxChainDepth} depassee sur l'evenement "${fired.event}".`,
          },
        };
      }

      const matching = triggers.filter(
        (t) => t.when.event === fired.event && (t.when.subject === undefined || t.when.subject === fired.subject),
      );
      if (matching.length > TRIGGER_LIMITS.maxTriggersPerEvent) {
        return {
          effects,
          trace,
          failures,
          error: {
            code: "too_many_triggers",
            message: `${matching.length} declencheurs sur "${fired.event}", maximum ${TRIGGER_LIMITS.maxTriggersPerEvent}.`,
          },
        };
      }

      // Priorite decroissante, ordre de declaration a egalite : `sort` est
      // stable depuis ES2019, l'index n'a donc pas a etre porte a la main.
      const ordered = [...matching].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      // Un meme declencheur ne part qu'une fois PAR EVENEMENT emis. Il peut
      // reparaitre plus bas dans la chaine : c'est la profondeur qui borne
      // le ping-pong, et c'est ce que demande le cas dore n° 2.
      const firedHere = new Set<string>();

      for (const trigger of ordered) {
        if (firedHere.has(trigger.id)) continue;
        firedHere.add(trigger.id);

        // Chaque declencheur est isole : ce qui tombe ici ne fait tomber que
        // lui. Les effets deja resolus par CE declencheur avant l'echec sont
        // conserves — ils correspondent a des des deja lances, les effacer
        // serait mentir sur ce qui s'est passe.
        try {
          if (trigger.if && !evalCondition(trigger.if, ctx, fired, rng)) continue;
          trace.push(`${fired.event} -> ${trigger.id} (profondeur ${depth})`);

          const pending: EffectNode[] = [...trigger.then];
          while (pending.length > 0) {
            const { resolved, branch } = resolveEffect(pending.shift()!, ctx, fired, rng);
            effects.push(resolved);
            pending.unshift(...branch);

            const next = followUpEvent(resolved);
            if (next) queue.push({ fired: next, depth: depth + 1 });
          }
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          failures.push({ triggerId: trigger.id, reason });
          trace.push(`${fired.event} -> ${trigger.id} ECHEC : ${reason}`);
        }
      }
  }

  return { effects, trace, failures };
}
