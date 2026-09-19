import type { AttackRollResult } from "./action";
import type { FiredEvent } from "./triggers";

/**
 * V3-A2 — Ce que la resolution mecanique EMET, en evenements du vocabulaire
 * ferme de `triggers.ts`.
 *
 * Module pur, et deliberement passif : les resolveurs (`resolveAttackRoll`,
 * `resolveDamageRoll`, `advanceTurn`) restent des fonctions sans effet de
 * bord qui rendent un resultat. Ce fichier TRADUIT ce resultat en
 * evenements, il ne le produit pas. Donner un effet de bord a un resolveur
 * pur pour qu'il « emette » aurait casse ce qui fait leur valeur : on peut
 * les appeler sans moteur de declencheurs du tout.
 *
 * Les cles de donnees sont prefixees `event.` parce que c'est ainsi qu'un
 * `ref` de formule les lit dans une condition — `{ op: "ref", name:
 * "event.damage" }`. Le prefixe n'est pas decoratif : il separe les donnees
 * de l'evenement des valeurs de l'acteur (`save.con`, `hp.current`), qui
 * partagent le meme espace de noms a l'evaluation.
 *
 * Il n'y a ici QUE les chemins de resolution qui existent reellement
 * aujourd'hui. Les douze autres evenements du vocabulaire n'ont pas encore
 * de producteur : leur ecrire un constructeur maintenant serait de
 * l'echafaudage pour un besoin suppose.
 */

/** Une attaque : touche ou rate, et si elle touche et inflige des degats, les deux faces de l'echange. */
export function eventsForAttack(params: {
  attacker: string;
  target: string;
  result: AttackRollResult;
  ac: number;
  damage?: number;
}): FiredEvent[] {
  const hit = params.result.total >= params.ac;
  const base = {
    "event.roll": params.result.total,
    "event.ac": params.ac,
    "event.critical": params.result.isCritical ? 1 : 0,
  };

  if (!hit) {
    return [{ event: "attack_miss", subject: params.attacker, data: base }];
  }

  const events: FiredEvent[] = [{ event: "attack_hit", subject: params.attacker, data: base }];
  if (params.damage !== undefined) {
    const withDamage = { ...base, "event.damage": params.damage };
    // Les deux faces sont emises : une regle peut s'accrocher a « j'inflige »
    // (vol de vie) comme a « je subis » (concentration). Le meme coup, deux
    // sujets — c'est pour ca que `subject` existe.
    events.push({ event: "damage_dealt", subject: params.attacker, data: withDamage });
    events.push({ event: "damage_taken", subject: params.target, data: withDamage });
  }
  return events;
}

/** Un jet de sauvegarde deja resolu. `save_passed` et `save_failed` sont deux evenements distincts du vocabulaire, pas un drapeau. */
export function eventsForSave(params: {
  who: string;
  passed: boolean;
  total: number;
  dc: number;
}): FiredEvent[] {
  return [
    {
      event: params.passed ? "save_passed" : "save_failed",
      subject: params.who,
      data: { "event.total": params.total, "event.dc": params.dc },
    },
  ];
}

/**
 * La bascule d'un tour. `turn_end` precede `turn_start` : c'est ce qui
 * permet a un poison de finir le tour de sa victime avant que la suivante
 * commence, sans qu'aucune regle n'ait a connaitre l'ordre d'initiative.
 * `round_start` n'est emis que quand le tour revient au premier participant.
 */
export function eventsForTurn(params: {
  ending?: string;
  starting: string;
  round: number;
  newRound: boolean;
}): FiredEvent[] {
  const events: FiredEvent[] = [];
  const data = { "event.round": params.round };
  if (params.ending) events.push({ event: "turn_end", subject: params.ending, data });
  if (params.newRound) {
    if (params.ending) events.push({ event: "round_end", subject: params.ending, data });
    events.push({ event: "round_start", subject: params.starting, data });
  }
  events.push({ event: "turn_start", subject: params.starting, data });
  return events;
}
