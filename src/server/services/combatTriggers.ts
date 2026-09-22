import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { StatBlockBlockData } from "@/src/core/schemas/rule-blocks/blocks";
import { buildMonsterActorState } from "@/src/core/rules/monsterActor";
import { eventsForTurn } from "@/src/core/rules/gameEvents";
import { runTriggers, type TriggerActorState, type TriggerContext, type TriggerRunResult } from "@/src/core/rules/triggers";
import type { CombatParticipantRow } from "@/src/server/repos/combats";
import { resolveEntryBlocksInRulesetBatch } from "@/src/server/services/rules";
import { loadTriggersForEntries } from "@/src/server/services/triggerStore";
import { serverRng } from "@/src/server/services/rng";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-A2 (câblage du combat) — faire partir les déclencheurs quand le tour
 * change.
 *
 * Ce qui bloquait n'était pas un point d'accroche : `moveTurn`
 * (`combats.ts`) tient déjà round, index et participants persistés. C'était
 * que `fireTriggersForCharacter` exige une `DerivedSheet`, qu'un monstre
 * n'a pas — le moteur était taillé pour un personnage, pas pour un
 * participant de combat.
 *
 * La réponse est `buildMonsterActorState` : l'acteur se compose depuis le
 * bloc `stat_block`, déjà résolu par la MÊME requête que les déclencheurs
 * (`resolveEntryBlocksInRulesetBatch`). Aucune requête de plus, et rien à
 * dériver.
 *
 * Comme partout depuis A2, les effets sont RENDUS, jamais appliqués.
 */

function conditionsOf(row: CombatParticipantRow): string[] {
  return Array.isArray(row.conditions) ? row.conditions.filter((c): c is string => typeof c === "string") : [];
}

/** Clé de ruleset d'un participant : un monstre porte `rule_key`, une entité n'en a pas. */
function ruleKeyOf(row: CombatParticipantRow): string | null {
  return row.rule_key && row.rule_key.trim() !== "" ? row.rule_key : null;
}

/**
 * Fait partir les déclencheurs de la bascule d'un tour.
 *
 * Le SUJET est le participant dont le tour commence : c'est lui dont on
 * charge les déclencheurs. Les autres entrent dans le contexte avec leur
 * état — assez pour `in_range` et pour qu'une règle les vise.
 *
 * Rend `null` quand il n'y a rien à dire, ce qui est le cas de loin le plus
 * fréquent : aucune fiche de monstre ne porte de déclencheur aujourd'hui.
 */
export async function fireTriggersForCombatTurn(
  supabase: TypedClient,
  params: {
    rulesetId: string;
    participants: readonly CombatParticipantRow[];
    /** Index dans l'ordre d'initiative, avant et après la bascule. */
    endingIndex: number | null;
    startingIndex: number;
    round: number;
    newRound: boolean;
  }
): Promise<TriggerRunResult | null> {
  const starting = params.participants[params.startingIndex];
  if (!starting) return null;

  const ending = params.endingIndex === null ? undefined : params.participants[params.endingIndex];

  // Les cles de regle de TOUS les participants en une passe : le stat_block
  // du sujet sert a le decrire, ceux des autres aussi (une aura vise un
  // voisin, il faut pouvoir le lire).
  const ruleKeys = [...new Set(params.participants.map(ruleKeyOf).filter((k): k is string => k !== null))];
  const resolved = ruleKeys.length > 0 ? await resolveEntryBlocksInRulesetBatch(supabase, params.rulesetId, ruleKeys) : null;

  const subjectKey = ruleKeyOf(starting);
  if (!subjectKey) {
    // Participant-entite : ses declencheurs viennent de ses aptitudes, donc
    // du chemin personnage (`fireTriggersForCharacter`), qui a besoin de sa
    // fiche derivee. Hors perimetre de cette bascule, qui ne connait que la
    // ligne de participant — a rejoindre quand la boucle de tour resoudra
    // les fiches de toute la scene (lot B).
    return null;
  }

  const { triggers } = await loadTriggersForEntries(supabase, params.rulesetId, [subjectKey]);
  if (triggers.length === 0) return null;

  const actors: Record<string, TriggerActorState> = {};
  for (const p of params.participants) {
    const key = ruleKeyOf(p);
    const statBlock = key ? (resolved?.get(key)?.blocksByType.get("stat_block") as StatBlockBlockData | undefined) : undefined;
    actors[p.id] = buildMonsterActorState(statBlock, {
      ac: p.ac,
      hpCurrent: p.hp_current,
      hpMax: p.hp_max,
      tempHp: p.temp_hp,
      conditions: conditionsOf(p),
    });
  }
  const ctx: TriggerContext = { actors };

  // Les evenements de bascule, dans l'ordre : le tour precedent se termine
  // avant que le suivant s'ouvre (un poison finit le tour de sa victime
  // avant que la suivante commence).
  const events = eventsForTurn({
    ending: ending?.id,
    starting: starting.id,
    round: params.round,
    newRound: params.newRound,
  });

  const effects: TriggerRunResult["effects"] = [];
  const trace: string[] = [];
  const failures: TriggerRunResult["failures"] = [];
  let error: TriggerRunResult["error"];

  for (const event of events) {
    const out = runTriggers({ event, triggers, ctx, rng: serverRng });
    effects.push(...out.effects);
    trace.push(...out.trace);
    failures.push(...out.failures);
    // Une borne depassee arrete la volee : la suite n'apprendrait rien de
    // plus, et le signal doit rester lisible.
    if (out.error) {
      error = out.error;
      break;
    }
  }

  if (effects.length === 0 && failures.length === 0 && !error) return null;
  return { effects, trace, failures, ...(error ? { error } : {}) };
}
