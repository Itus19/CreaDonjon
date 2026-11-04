import { evaluate } from "@/src/core/formula/evaluate";
import type { FormulaNode } from "@/src/core/formula/ast";
import type { ActiveDurableEffect } from "@/src/core/rules/durableEffects";
import type { SheetResource } from "@/src/core/rules/sheet";
import type { EffectNode } from "@/src/core/rules/triggers";
import type { Activation, ActivationBlockData, DurableEffectDuration } from "@/src/core/schemas/rule-blocks/playable";
import type { CombatParticipantRow } from "@/src/server/repos/combats";
import type { PlayerCombatParticipant } from "@/src/core/rules/combatPlayerView";
import { ciblesDuCombat, ciblesDuCombatJoueur, type TextesJetCible } from "@/lib/ui/jetCibleOutil";
import type { CibleDeJet } from "@/lib/ui/outilDes";

/**
 * V3.1-131 — la fiche jouable : un bouton par activation. Ici, ce qui se calcule
 * sans écran : le résumé d'une capacité (coût, cibles, DD, durée), les
 * ressources restantes, le résultat par cible et les effets de « Sur la scène ».
 * Le serveur revérifie tout (`POST …/actions/activate`) : ces calculs ne servent
 * qu'à afficher et à désactiver un bouton quand le refus est certain.
 */

/** Évaluer une formule sans jamais lancer de dé : le mode « average » n'appelle pas le RNG. */
const SANS_DES = {
  nextInt: (): number => {
    throw new Error("le mode average n'appelle jamais le RNG");
  },
};

const CARACTERISTIQUES = ["str", "dex", "con", "int", "wis", "cha"] as const;

/**
 * Les nombres que lisent les formules d'une activation, tels que le serveur les
 * pose : `level`, `ability.<car>` (le modificateur), `proficiency`, et
 * `spell_save_dc` quand le personnage lance des sorts.
 */
export function nombresDeLaFiche(p: {
  niveau: number;
  bonusMaitrise: number;
  modificateurs: Readonly<Record<(typeof CARACTERISTIQUES)[number], number>>;
  ddDeSort: number | null;
}): Record<string, number> {
  const nombres: Record<string, number> = { level: p.niveau, proficiency: p.bonusMaitrise };
  if (p.ddDeSort !== null) nombres.spell_save_dc = p.ddDeSort;
  for (const car of CARACTERISTIQUES) nombres[`ability.${car}`] = p.modificateurs[car];
  return nombres;
}

/** La valeur moyenne d'une formule ; `null` si elle lit un nombre que la fiche ne connaît pas (l'erreur reste en console). */
export function evaluerNombre(formule: FormulaNode, nombres: Readonly<Record<string, number>>): number | null {
  try {
    return Math.floor(evaluate(formule, nombres, SANS_DES, "average").value);
  } catch (erreur) {
    console.error("Formule d'activation illisible côté fiche", erreur);
    return null;
  }
}

/** Les identifiants d'effets qui durent qu'une liste d'effets pose, branches de sauvegarde comprises. */
function effetsPoses(effets: readonly EffectNode[]): string[] {
  return effets.flatMap((e) => {
    if (e.action === "apply_effect") return [e.effect];
    if (e.action === "saving_throw") return [...effetsPoses(e.on_fail ?? []), ...effetsPoses(e.on_pass ?? [])];
    return [];
  });
}

/** La première sauvegarde qu'une liste d'effets demande (branches comprises). */
function premiereSauvegarde(effets: readonly EffectNode[]): Extract<EffectNode, { action: "saving_throw" }> | null {
  for (const e of effets) {
    if (e.action === "saving_throw") return e;
  }
  return null;
}

export interface ResumeActivation {
  action: Activation["cost"]["action"];
  couts: { cle: string; montant: number }[];
  /** `null` : l'activation vise celui qui la joue. */
  cibles: { genre: Activation["targets"]["kind"]; max: number | null } | null;
  /** La sauvegarde que les cibles tentent, avec son DD quand il se calcule. */
  sauvegarde: { caracteristique: string; dd: number | null } | null;
  duree: DurableEffectDuration | null;
}

/** Coût d'une activation ou de sa variante : les montants évalués, `null` si une formule est illisible. */
function coutsEvalues(cout: Activation["cost"], nombres: Readonly<Record<string, number>>): { cle: string; montant: number }[] {
  return cout.resources.flatMap((r) => {
    const montant = evaluerNombre(r.amount, nombres);
    return montant === null ? [] : [{ cle: r.key, montant }];
  });
}

/** La capacité en une ligne de faits : action, coût, cibles, DD, durée. Une variante change le coût et les effets. */
export function resumeActivation(
  bloc: ActivationBlockData,
  activation: Activation,
  nombres: Readonly<Record<string, number>>,
  variantId: string | null = null
): ResumeActivation {
  const variante = variantId ? activation.variants?.find((v) => v.id === variantId) : undefined;
  const cout = variante?.cost ?? activation.cost;
  const effets = variante ? variante.effects : activation.effects;

  const sauvegardeEffet = premiereSauvegarde(effets);
  const premierEffet = effetsPoses(effets)[0];
  const definition = premierEffet ? bloc.durable_effects.find((e) => e.id === premierEffet) : undefined;

  return {
    action: cout.action,
    couts: coutsEvalues(cout, nombres),
    cibles:
      activation.targets.kind === "self"
        ? null
        : { genre: activation.targets.kind, max: activation.targets.count ? evaluerNombre(activation.targets.count, nombres) : 1 },
    sauvegarde: sauvegardeEffet
      ? { caracteristique: sauvegardeEffet.ability.toLowerCase(), dd: evaluerNombre(sauvegardeEffet.dc, nombres) }
      : null,
    duree: definition?.duration ?? null,
  };
}

/**
 * Les activations à montrer. Celles qu'un jeton accorde (`token.grants`) ne se
 * montrent que tant qu'un effet actif en porte le jeton.
 */
export function activationsVisibles(bloc: ActivationBlockData, effets: readonly ActiveDurableEffect[]): Activation[] {
  const accordees = new Set(bloc.durable_effects.flatMap((e) => (e.token ? [e.token.grants] : [])));
  const jetons = new Set(effets.flatMap((e) => (e.tokenGrants && e.tokenUsesLeft > 0 ? [e.tokenGrants] : [])));
  return bloc.activations.filter((a) => !accordees.has(a.id) || jetons.has(a.id));
}

// --- ressources ------------------------------------------------------------

export interface RessourceRestante {
  cle: string;
  max: number;
  restants: number;
}

/** Les usages restants d'une ressource calculée : le maximum moins la table des usages consommés (`runtimeState.resources`). */
export function ressourceRestante(ressource: Pick<SheetResource, "key" | "max">, utilises: Readonly<Record<string, number>>): RessourceRestante {
  return { cle: ressource.key, max: ressource.max, restants: Math.max(0, ressource.max - (utilises[ressource.key] ?? 0)) };
}

/** La première ressource que le coût ne peut pas payer, sinon `null` : le bouton se désactive, le serveur tranche. */
export function ressourceManquante(
  couts: readonly { cle: string; montant: number }[],
  ressources: readonly SheetResource[],
  utilises: Readonly<Record<string, number>>
): string | null {
  for (const c of couts) {
    const ressource = ressources.find((r) => r.key === c.cle);
    const restants = ressource ? ressourceRestante(ressource, utilises).restants : 0;
    if (restants < c.montant) return c.cle;
  }
  return null;
}

// --- cibles ----------------------------------------------------------------

/** Les participants qu'un genre de cible permet de viser (le MJ voit tout le combat). */
export function ciblesActivationMj(
  genre: Activation["targets"]["kind"],
  participants: readonly CombatParticipantRow[],
  textes: Pick<TextesJetCible, "allie" | "adversaire">
): CibleDeJet[] {
  if (genre === "self") return [];
  const gardes = participants.filter((p) => (genre === "ally" ? p.is_ally : genre === "enemy" ? !p.is_ally : true));
  return ciblesDuCombat(gardes, textes);
}

/** Même tri pour une joueuse, sur la vue filtrée du combat (jamais de CA ni de PV d'adversaire). */
export function ciblesActivationJoueur(
  genre: Activation["targets"]["kind"],
  participants: readonly PlayerCombatParticipant[],
  textes: Pick<TextesJetCible, "allie" | "adversaire" | "blessure">
): CibleDeJet[] {
  if (genre === "self") return [];
  const gardes = participants.filter((p) => (genre === "ally" ? p.side === "ally" : genre === "enemy" ? p.side === "enemy" : true));
  return ciblesDuCombatJoueur(gardes, textes);
}

/** Coche ou décoche une cible sans dépasser le maximum (`null` : pas de plafond connu, le serveur tranche). */
export function basculerCible(choisies: readonly string[], id: string, max: number | null): string[] {
  if (choisies.includes(id)) return choisies.filter((c) => c !== id);
  if (max !== null && choisies.length >= max) return [...choisies];
  return [...choisies, id];
}

// --- résultat --------------------------------------------------------------

/** Un résultat par cible, tel que la réponse de `POST …/actions/activate` le rend. */
export interface CibleResultat {
  participantId: string;
  label: string;
  saved: boolean | null;
  applied: string[];
  save?: { roll: number; total: number; dc: number };
}

export interface LigneResultat {
  nom: string;
  /** `null` : pas de sauvegarde (effet automatique). */
  verdict: "reussite" | "echec" | null;
  appliques: string[];
  /** Les chiffres du jet, pour le MJ seulement. */
  jet: { total: number; dc: number } | null;
}

/**
 * Une ligne de résultat. Une joueuse ne voit que le verdict : le jet et le DD
 * d'un monstre restent au MJ (ADR 0070), même si la réponse en portait.
 */
export function ligneResultat(cible: CibleResultat, estMj: boolean): LigneResultat {
  return {
    nom: cible.label,
    verdict: cible.saved === null ? null : cible.saved ? "reussite" : "echec",
    appliques: cible.applied,
    jet: estMj && cible.save ? { total: cible.save.total, dc: cible.save.dc } : null,
  };
}

// --- sur la scène ----------------------------------------------------------

export type TempsRestant =
  | { genre: "rounds"; rounds: number }
  | { genre: "minutes"; minutes: number }
  | { genre: "heures"; heures: number }
  | { genre: "finDeTour" }
  | { genre: "repos" }
  | { genre: "permanent" };

/**
 * Combien de temps reste à un effet : des rounds, une fin de tour, un repos, ou
 * rien de chiffré. Un compte rond se lit dans l'unité de la règle : 600 rounds
 * font 1 heure, 100 rounds 10 minutes (1 minute = 10 rounds).
 */
export function tempsRestant(effet: Pick<ActiveDurableEffect, "remainingRounds" | "untilTurnEnd" | "untilRest">): TempsRestant {
  const r = effet.remainingRounds;
  if (r !== null) {
    if (r >= 600 && r % 600 === 0) return { genre: "heures", heures: r / 600 };
    if (r >= 10 && r % 10 === 0) return { genre: "minutes", minutes: r / 10 };
    return { genre: "rounds", rounds: r };
  }
  if (effet.untilTurnEnd) return { genre: "finDeTour" };
  if (effet.untilRest) return { genre: "repos" };
  return { genre: "permanent" };
}
