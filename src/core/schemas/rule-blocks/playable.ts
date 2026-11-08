import { z } from "zod";
import { zFormulaNode, zLocalized, zModifier } from "./primitives";
import { TRIGGER_EVENTS, zCondition, zEffect, type EffectNode } from "../../rules/triggers";
import { SPELL_SCHOOLS } from "../../rules/homebrewSpell";

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

/**
 * ADR 0078 (V3.1-183) — regagner une utilisation en dépensant autre chose :
 * une autre ressource (Magie envoûtante contre une Inspiration bardique), ou
 * un emplacement de sort d'un niveau minimal (Mante de majesté, niveau 3+).
 */
export const zResourceRegain = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("resource"), key: z.string().min(1), amount: z.number().int().min(1).max(20) }),
  z.object({ kind: z.literal("slot"), min_level: z.number().int().min(1).max(9) }),
]);
export type ResourceRegain = z.infer<typeof zResourceRegain>;

export const zRuleResource = z.object({
  /** Unique dans le ruleset : d'autres fiches la dépensent par cette clé (Abjuration d'ennemis dépense `channel-divinity`). */
  key: z.string().min(1),
  label: zLocalized,
  /** Formule : `column.<clé>` (progression de la classe qui accorde la fiche), `class.level`, `level`, `ability.*`, `proficiency`. */
  max: zFormulaNode,
  recharge: z.enum(RULE_RECHARGES),
  /** ADR 0078 : regagner une utilisation en dépensant autre chose. Absent : seulement au repos. */
  regain: zResourceRegain.optional(),
  /** V3.1-132 : le passage du texte de la règle dont vient la brique (surligné à côté de l'éditeur). */
  passage: zPassage.optional(),
});
export type RuleResource = z.infer<typeof zRuleResource>;

export const zRuleResourcesBlockData = z
  .object({ resources: z.array(zRuleResource) })
  .refine((d) => new Set(d.resources.map((r) => r.key)).size === d.resources.length, { message: "Deux ressources de même clé dans une fiche." });
export type RuleResourcesBlockData = z.infer<typeof zRuleResourcesBlockData>;

// --- activation ------------------------------------------------------------

/**
 * ADR 0060 §2 : `magic` est l'action « Magie » (elle se paie sur l'action du tour) ; `none`, rien.
 * V3.1-164 (ADR 0076) : `attack` remplace une attaque de l'action Attaque (Souffle).
 */
export const ACTIVATION_COSTS = ["action", "bonus", "reaction", "magic", "free", "none", "attack"] as const;
export const ACTIVATION_TARGET_KINDS = ["self", "creature", "ally", "enemy", "point"] as const;

const zActivationCost = z.object({
  action: z.enum(ACTIVATION_COSTS),
  resources: z.array(z.object({ key: z.string().min(1), amount: zFormulaNode })),
  /** V3.1-164 (ADR 0076) : un sort, son niveau de base (0 : sort mineur). Les formules lisent `slot.level`, le niveau dépensé. */
  slot: z.object({ level: z.number().int().min(0).max(9) }).optional(),
});
export type ActivationCost = z.infer<typeof zActivationCost>;

/** V3.1-164 (ADR 0076) : une option de lancement déclarée par une aptitude (Sort accéléré), choisie au moment de lancer un sort. */
export const zCastOption = z.object({
  id: z.string().min(1),
  label: zLocalized,
  cost: z.object({ resources: z.array(z.object({ key: z.string().min(1), amount: zFormulaNode })) }),
  changes: z.object({ action: z.enum(["action", "bonus", "reaction", "magic"]).optional() }),
});
export type CastOption = z.infer<typeof zCastOption>;

const zActivationTargets = z.object({
  kind: z.enum(ACTIVATION_TARGET_KINDS),
  /** Nombre maximal de cibles (formule). Absent : une seule. Ignoré pour `self`. */
  count: zFormulaNode.optional(),
  /** En mètres : se mesure aux distances réelles de l'ADR 0059, et d'ici là à leur lecture en zones. */
  range: z.object({ value: z.number().positive(), unit: z.literal("m") }).optional(),
  must_see: z.boolean().optional(),
});

const zEffectList = z.array(zEffect);

// --- réactions (V3.1-159, ADR 0075) ------------------------------------------

/** `d20` : une attaque, une sauvegarde ou un test. */
export const REACTION_ROLLS = ["attack", "save", "check", "d20", "damage"] as const;
/** Qui a lancé le jet, vu de celui qui réagit. `attack_against_self` : une attaque (ou ses dégâts) qui le vise. */
export const REACTION_SUBJECTS = ["self", "attack_against_self", "ally", "enemy", "any"] as const;
/** `rolled` : le dé est connu, l'issue pas encore. `hit`, `failed` : l'issue est connue, rien n'est appliqué. */
export const REACTION_MOMENTS = ["rolled", "hit", "failed", "natural"] as const;

export const zRollTrigger = z
  .object({
    on: z.literal("roll"),
    roll: z.enum(REACTION_ROLLS),
    subject: z.enum(REACTION_SUBJECTS),
    when: z.enum(REACTION_MOMENTS),
    /** Avec `when: "natural"` seulement : la valeur du d20 (Chance : 1). */
    natural: z.number().int().min(1).max(20).optional(),
    range: z.object({ value: z.number().positive(), unit: z.literal("m") }).optional(),
    /** Sans fenêtre : s'applique d'office (Chance). */
    automatic: z.boolean().optional(),
  })
  .superRefine((t, ctx) => {
    if ((t.when === "natural") !== (t.natural !== undefined)) ctx.addIssue({ code: "custom", message: "« natural » va avec le moment « natural », et seulement avec lui." });
    if (t.when === "hit" && t.roll !== "attack") ctx.addIssue({ code: "custom", message: "« touché » ne se dit que d'une attaque." });
    if (t.roll === "damage" && t.when !== "rolled") ctx.addIssue({ code: "custom", message: "Un jet de dégâts n'a qu'un moment : quand il est lancé." });
  });
export type RollTrigger = z.infer<typeof zRollTrigger>;

/**
 * V3.1-184 : « aussitôt après avoir lancé un sort d'Enchantement ou d'Illusion
 * par un emplacement de sort » (Magie envoûtante). Pas une réaction : la fiche
 * propose l'utilisation juste après le lancer, qui reste jouable au clic.
 * `schools` absent : toute école ; `with_slot` : un emplacement dépensé (pas un
 * sort mineur).
 */
export const zSpellCastTrigger = z.object({
  on: z.literal("spell_cast"),
  schools: z.array(z.enum(SPELL_SCHOOLS)).min(1).optional(),
  with_slot: z.boolean().optional(),
});
export type SpellCastTrigger = z.infer<typeof zSpellCastTrigger>;

export const zActivationTrigger = z.union([zRollTrigger, zSpellCastTrigger]);
export type ActivationTrigger = z.infer<typeof zActivationTrigger>;

/** Les opérations sur le jet en cours. Les dés sont lancés par le serveur (règle 8). */
export const zRollOperation = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_die"), count: zFormulaNode, faces: zFormulaNode, sign: z.union([z.literal(1), z.literal(-1)]) }),
  z.object({ op: z.literal("reroll"), bonus: zFormulaNode.optional() }),
  z.object({ op: z.literal("set_natural"), value: z.number().int().min(1).max(20) }),
  z.object({ op: z.literal("ac_bonus"), value: zFormulaNode }),
  z.object({ op: z.literal("damage_multiplier"), factor: z.number().positive() }),
  z.object({ op: z.literal("add_damage"), formula: zFormulaNode, damage_type: z.string().min(1).optional() }),
  /** V3.1-186 : l'assaillant fait une sauvegarde contre `dc` ; échec : l'attaque rate (Majesté souveraine). */
  z.object({ op: z.literal("attacker_save"), ability: z.enum(["str", "dex", "con", "int", "wis", "cha"]), dc: zFormulaNode }),
]);
export type RollOperation = z.infer<typeof zRollOperation>;

/** Les jets sur lesquels une opération a un sens. */
const OPERATION_ROLLS: Record<RollOperation["op"], readonly (typeof REACTION_ROLLS)[number][]> = {
  add_die: REACTION_ROLLS,
  reroll: ["attack", "save", "check", "d20"],
  set_natural: ["attack", "save", "check", "d20"],
  ac_bonus: ["attack"],
  damage_multiplier: ["damage"],
  add_damage: ["damage"],
  attacker_save: ["attack"],
};

/** V3.1-159 : le refus d'une opération qui n'a pas de sens sur le jet visé (`ac_bonus` sur une sauvegarde). */
export function rollOperationProblems(trigger: ActivationTrigger | undefined, ops: readonly RollOperation[]): string[] {
  if (ops.length === 0) return [];
  if (!trigger || trigger.on !== "roll") return ["Une opération sur le jet demande un déclencheur « en réaction à un jet »."];
  return ops.filter((o) => !OPERATION_ROLLS[o.op].includes(trigger.roll)).map((o) => `L'opération « ${o.op} » n'a pas de sens sur un jet « ${trigger.roll} ».`);
}

export const zActivationLimit = z.object({ per: z.enum(["turn", "round"]) });

const zActivationVariant = z.object({
  id: z.string().min(1),
  label: zLocalized,
  effects: zEffectList,
  /** Absent : le coût de l'activation. */
  cost: zActivationCost.optional(),
  /** V3.1-159 : absent, celles de l'activation. */
  roll_operations: z.array(zRollOperation).optional(),
});

export const zActivation = z.object({
  id: z.string().min(1),
  label: zLocalized,
  requires: zCondition.optional(),
  cost: zActivationCost,
  targets: zActivationTargets,
  effects: zEffectList,
  variants: z.array(zActivationVariant).nullable(),
  /** V3.1-159 (ADR 0075) : absent, l'activation se joue au clic ; `roll`, en réaction à un jet ; `spell_cast` (V3.1-184), proposée après un sort. */
  trigger: zActivationTrigger.optional(),
  /** V3.1-159 : ce que la réaction fait au jet en cours. */
  roll_operations: z.array(zRollOperation).optional(),
  /** V3.1-159 : une fois par tour ou par round (compté en combat seulement). */
  limit: zActivationLimit.optional(),
  /** V3.1-164 : les options que cette aptitude offre au lancer d'un sort (Métamagie). */
  cast_options: z.array(zCastOption).optional(),
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
  /** V3.1-195 : à la fin de chacun de ses tours, le porteur refait ce JS ; une réussite retire l'effet. Le DD se calcule à la pose. */
  repeat_save: z.object({ ability: z.enum(["str", "dex", "con", "int", "wis", "cha"]), dc: zFormulaNode }).optional(),
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
      for (const ops of [a.roll_operations ?? [], ...(a.variants ?? []).map((v) => v.roll_operations ?? [])]) {
        for (const message of rollOperationProblems(a.trigger, ops)) ctx.addIssue({ code: "custom", message: `« ${a.id} » : ${message}` });
      }
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
