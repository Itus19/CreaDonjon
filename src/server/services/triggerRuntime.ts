import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { ABILITIES, type DerivedSheet } from "@/src/core/rules/sheet";
import type { RuntimeState } from "@/src/core/schemas/runtimeState";
import {
  runTriggers,
  type FiredEvent,
  type TriggerActorState,
  type TriggerContext,
  type TriggerRunResult,
} from "@/src/core/rules/triggers";
import { loadTriggersForEntries } from "@/src/server/services/triggerStore";
import { serverRng } from "@/src/server/services/rng";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-A2 — Le cablage : de la resolution mecanique reelle jusqu'au moteur de
 * declencheurs.
 *
 * Ce module NE FAIT PAS d'ecriture de jeu. Il fait partir les declencheurs
 * et rend ce qu'ils PROPOSENT (`ResolvedEffect[]`). Appliquer ces effets —
 * retirer une condition, retrancher des points de vie — suppose l'etat de
 * scene et l'economie d'action, qui sont V3-A3 et V3-A4. Rendre les effets
 * sans les appliquer est donc deliberé : le moteur tourne et se montre, mais
 * rien ne mute tant que ce qui doit les recevoir n'existe pas.
 */

/** L'acteur, vu par une condition : ses conditions, ses aptitudes, et les nombres qu'un `ref` peut lire. */
export function buildActorState(sheet: DerivedSheet, runtime?: RuntimeState): TriggerActorState {
  const numbers: Record<string, number> = {
    "ac": sheet.ac.value,
    "hp.max": sheet.hitPoints.max,
    "speed": sheet.speed.value,
    "proficiency": sheet.proficiencyBonus,
  };
  for (const ability of ABILITIES) {
    numbers[`ability.${ability}`] = sheet.abilities[ability].mod;
    numbers[`save.${ability}`] = sheet.savingThrows[ability].mod;
  }
  if (runtime) {
    numbers["hp.current"] = runtime.hp.current;
    numbers["hp.temp"] = runtime.hp.temp;
    numbers["exhaustion"] = runtime.exhaustion;
  }

  return {
    conditions: runtime?.conditions ?? [],
    // Les cles d'aptitude sont celles que `has_feature` interroge, et les
    // MEMES que celles dont `loadTriggersForEntries` lit les declencheurs :
    // une aptitude qui porte une regle peut donc se tester elle-meme.
    features: sheet.features.map((f) => f.key),
    numbers,
    zone: "engaged",
  };
}

/**
 * Fait partir les declencheurs d'un evenement pour un personnage.
 *
 * Les declencheurs applicables sont ceux que portent les APTITUDES du
 * personnage — dons, traits d'espece, aptitudes de classe, homebrew
 * compris : `loadTriggersForEntries` passe par la chaine de rulesets et les
 * surcharges, jamais par `ruleset_entries` en direct.
 *
 * Le RNG est celui du serveur : un jet de sauvegarde declenche par une
 * regle est lance ICI, jamais par un modele (CLAUDE.md regle 8).
 */
export async function fireTriggersForCharacter(
  supabase: TypedClient,
  params: {
    rulesetId: string;
    subject: string;
    sheet: DerivedSheet;
    runtime?: RuntimeState;
    event: FiredEvent;
  }
): Promise<TriggerRunResult & { rejected: { entryKey: string; index: number; reason: string }[] }> {
  const featureKeys = params.sheet.features.map((f) => f.key);
  const { triggers, rejected } = await loadTriggersForEntries(supabase, params.rulesetId, featureKeys);

  if (triggers.length === 0) {
    return { effects: [], trace: [], failures: [], rejected };
  }

  const ctx: TriggerContext = {
    actors: { [params.subject]: buildActorState(params.sheet, params.runtime) },
  };

  return { ...runTriggers({ event: params.event, triggers, ctx, rng: serverRng }), rejected };
}
