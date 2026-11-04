import { z } from "zod";
import { zFormulaNode, zLocalized, zModifier } from "./primitives";
import { TRIGGER_EVENTS, zCondition, zEffect, type EffectNode } from "../../rules/triggers";

/**
 * V3.1-129 (ADR 0060) — les trois blocs de règle de la fondation des règles
 * jouables : `resources` (la ressource qu'une règle déclare), `activation`
 * (« cette règle se joue », avec ses effets qui durent) et `coverage`
 * (ce que la fiche ne sait pas encore jouer). Des données, jamais du code :
 * les effets réutilisent le vocabulaire fermé des déclencheurs (`zEffect`).
 */

// --- resources -------------------------------------------------------------

/** V3.1-132 : une citation du texte de la règle, attachée à une brique. Facultative. */
export const zPassage = z.string().trim().min(1).max(2000);

/** Même vocabulaire que les compteurs du personnage (`resourceRecharge.ts`). */
export const RULE_RECHARGES = ["short_rest", "short_rest_one", "long_rest", "dawn", "never"] as const;

export const zRuleResource = z.object({
  /** Unique dans le ruleset : d'autres fiches la dépensent par cette clé (Abjuration d'ennemis dépense `channel-divinity`). */
  key: z.string().min(1),
  label: zLocalized,
  /** Formule : `column.<clé>` (progression de la classe qui accorde la fiche), `class.level`, `level`, `ability.*`, `proficiency`. */
  max: zFormulaNode,
  recharge: z.enum(RULE_RECHARGES),
  /** V3.1-132 : le passage du texte de la règle dont vient la brique (surligné à côté de l'éditeur). */
  passage: zPassage.optional(),
});
export type RuleResource = z.infer<typeof zRuleResource>;

export const zRuleResourcesBlockData = z
  .object({ resources: z.array(zRuleResource) })
  .refine((d) => new Set(d.resources.map((r) => r.key)).size === d.resources.length, { message: "Deux ressources de même clé dans une fiche." });
export type RuleResourcesBlockData = z.infer<typeof zRuleResourcesBlockData>;

// --- activation ------------------------------------------------------------

/** ADR 0060 §2 : `magic` est l'action « Magie » (elle se paie sur l'action du tour) ; `none`, rien. */
export const ACTIVATION_COSTS = ["action", "bonus", "reaction", "magic", "free", "none"] as const;
export const ACTIVATION_TARGET_KINDS = ["self", "creature", "ally", "enemy", "point"] as const;

const zActivationCost = z.object({
  action: z.enum(ACTIVATION_COSTS),
  resources: z.array(z.object({ key: z.string().min(1), amount: zFormulaNode })),
});

const zActivationTargets = z.object({
  kind: z.enum(ACTIVATION_TARGET_KINDS),
  /** Nombre maximal de cibles (formule). Absent : une seule. Ignoré pour `self`. */
  count: zFormulaNode.optional(),
  /** En mètres : se mesure aux distances réelles de l'ADR 0059, et d'ici là à leur lecture en zones. */
  range: z.object({ value: z.number().positive(), unit: z.literal("m") }).optional(),
  must_see: z.boolean().optional(),
});

const zEffectList = z.array(zEffect);

const zActivationVariant = z.object({
  id: z.string().min(1),
  label: zLocalized,
  effects: zEffectList,
  /** Absent : le coût de l'activation. */
  cost: zActivationCost.optional(),
});

export const zActivation = z.object({
  id: z.string().min(1),
  label: zLocalized,
  requires: zCondition.optional(),
  cost: zActivationCost,
  targets: zActivationTargets,
  effects: zEffectList,
  variants: z.array(zActivationVariant).nullable(),
  /** V3.1-132 : le passage dont vient chaque brique, par chemin (`brickPaths`) : `cost`, `targets`, `effects.0.on_fail.0`… */
  passages: z.record(z.string(), zPassage).optional(),
});
export type Activation = z.infer<typeof zActivation>;

/** ADR 0060 §3. `until_turn_end` : `whose` (porteur ou source), `which` (le tour en cours ou le prochain). */
const zDuration = z.union([
  z.object({ unit: z.enum(["round", "minute", "hour", "day"]), amount: z.number().positive() }),
  z.object({ unit: z.literal("until_turn_end"), whose: z.enum(["bearer", "source"]), which: z.enum(["current", "next"]) }),
  z.object({ unit: z.literal("until_rest") }),
  z.object({ unit: z.literal("permanent") }),
]);
export type DurableEffectDuration = z.infer<typeof zDuration>;

/** Une fin sur événement : un événement du vocabulaire fermé, pour le porteur ou la source ; `dismissed` : au choix. */
export const zEndsOn = z.union([
  z.object({ event: z.enum(TRIGGER_EVENTS), subject: z.enum(["bearer", "source"]) }),
  z.object({ event: z.literal("dismissed") }),
]);
export type DurableEffectEnd = z.infer<typeof zEndsOn>;

export const zDurableEffect = z.object({
  id: z.string().min(1),
  label: zLocalized,
  conditions: z.array(z.string().min(1)),
  /** Modificateurs DÉCLARÉS : leurs valeurs sont recalculées par `characterSheet()` en couche 7, jamais figées. */
  modifiers: z.array(zModifier),
  duration: zDuration,
  /** Lié à la concentration de la source : la rompre retire l'effet. */
  concentration: z.boolean(),
  ends_on: z.array(zEndsOn),
  /** Jeton : tant que l'effet dure, son porteur dispose de l'activation `grants` ; un usage épuisé retire l'effet. */
  token: z.object({ uses: z.number().int().positive(), grants: z.string().min(1) }).nullable(),
  /** V3.1-132 : le passage dont vient l'effet. */
  passage: zPassage.optional(),
});
export type DurableEffect = z.infer<typeof zDurableEffect>;

/** Les identifiants d'effets qu'une liste pose, branches de sauvegarde comprises. */
function appliedEffectIds(effects: readonly EffectNode[]): string[] {
  return effects.flatMap((e) => {
    if (e.action === "apply_effect") return [e.effect];
    if (e.action === "saving_throw") return [...appliedEffectIds(e.on_fail ?? []), ...appliedEffectIds(e.on_pass ?? [])];
    return [];
  });
}

function effectPaths(prefix: string, effects: readonly EffectNode[]): string[] {
  return effects.flatMap((e, i) => {
    const p = `${prefix}.${i}`;
    if (e.action !== "saving_throw") return [p];
    return [p, ...effectPaths(`${p}.on_fail`, e.on_fail ?? []), ...effectPaths(`${p}.on_pass`, e.on_pass ?? [])];
  });
}

/**
 * V3.1-132 — les chemins des briques d'une activation, dans l'ordre de
 * l'éditeur : coût, cibles, effets (branches de sauvegarde comprises), puis
 * effets des variantes. Une citation (`passages`) s'attache à l'un d'eux.
 */
export function brickPaths(a: Pick<Activation, "effects" | "variants">): string[] {
  return [
    "cost",
    "targets",
    ...effectPaths("effects", a.effects),
    ...(a.variants ?? []).flatMap((v, k) => effectPaths(`variants.${k}.effects`, v.effects)),
  ];
}

export const zActivationBlockData = z
  .object({
    activations: z.array(zActivation),
    durable_effects: z.array(zDurableEffect).default([]),
  })
  .superRefine((d, ctx) => {
    const effets = new Set(d.durable_effects.map((e) => e.id));
    const activations = new Set(d.activations.map((a) => a.id));
    for (const a of d.activations) {
      const listes = [a.effects, ...(a.variants ?? []).map((v) => v.effects)];
      for (const id of listes.flatMap(appliedEffectIds)) {
        if (!effets.has(id)) ctx.addIssue({ code: "custom", message: `L'activation « ${a.id} » pose l'effet « ${id} », que le bloc ne décrit pas.` });
      }
      const chemins = new Set(brickPaths(a));
      for (const cle of Object.keys(a.passages ?? {})) {
        if (!chemins.has(cle)) ctx.addIssue({ code: "custom", message: `Le passage « ${cle} » de « ${a.id} » ne désigne aucune brique.` });
      }
    }
    for (const e of d.durable_effects) {
      if (e.token && !activations.has(e.token.grants)) {
        ctx.addIssue({ code: "custom", message: `Le jeton de « ${e.id} » accorde « ${e.token.grants} », absente du bloc.` });
      }
    }
  });
export type ActivationBlockData = z.infer<typeof zActivationBlockData>;

// --- coverage --------------------------------------------------------------

export const zCoverageBlockData = z.object({
  gaps: z.array(z.object({ text: z.string().min(1), missing: z.string().min(1) })),
});
export type CoverageBlockData = z.infer<typeof zCoverageBlockData>;
