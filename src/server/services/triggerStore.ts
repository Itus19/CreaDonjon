import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { zTrigger, type Trigger } from "@/src/core/rules/triggers";
import { resolveEntryBlocksInRulesetBatch } from "@/src/server/services/rules";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-A2 — Le magasin de declencheurs, cote lecture.
 *
 * Il n'y a AUCUNE table `triggers`, et c'est le point de ce fichier. Un
 * declencheur est une donnee de regle : il vit dans un bloc type `triggers`
 * porte par une entree de ruleset, exactement comme `modifiers` pour le
 * moteur de fiche. Il herite donc gratuitement de quatre mecanismes deja
 * ecrits et deja testes — la chaine de rulesets, les surcharges
 * (`ruleset_overrides`, ou vit tout le homebrew), les traductions, et
 * l'editeur de blocs. Une table dediee aurait exige de refaire les quatre.
 *
 * `ruleset_entry_blocks.block_type` est un `text` sans contrainte CHECK
 * (migration 20260729204001) : aucune migration n'a ete necessaire.
 */

export interface TriggerLoad {
  /** Declencheurs valides, prets pour `runTriggers`. */
  triggers: Trigger[];
  /**
   * Declencheurs REJETES, avec leur raison. Jamais ecartes en silence : une
   * regle maison mal formee doit se voir, sinon l'auteur croit qu'elle
   * s'applique. Meme discipline que `TriggerRunResult.failures` (V3-A2) et
   * que l'interdiction du `catch` muet de CLAUDE.md.
   */
  rejected: { entryKey: string; index: number; reason: string }[];
}

/**
 * Charge les declencheurs portes par un lot d'entrees de ruleset, resolus a
 * travers la chaine et les surcharges.
 *
 * Passe par `resolveEntryBlocksInRulesetBatch` — le meme moteur que les
 * modificateurs generiques de `resolvedRuleset.ts`, en UNE requete groupee.
 * Lire `ruleset_entries` directement raterait tout le homebrew, qui ne vit
 * que dans `ruleset_overrides`.
 */
export async function loadTriggersForEntries(
  supabase: TypedClient,
  rulesetId: string,
  entryKeys: readonly string[]
): Promise<TriggerLoad> {
  const triggers: Trigger[] = [];
  const rejected: TriggerLoad["rejected"] = [];
  if (entryKeys.length === 0) return { triggers, rejected };

  const resolved = await resolveEntryBlocksInRulesetBatch(supabase, rulesetId, entryKeys);

  // V3.1-5, vérification du 17 novembre : une espèce porte les déclencheurs de
  // ses traits (Ingénieux de l'Humain : l'Inspiration au repos long). La fiche
  // dérivée ne liste un trait comme aptitude que s'il se joue (V3.1-163) ; les
  // traits se lisent donc ici, dans le bloc `species_traits` déjà résolu — une
  // seconde résolution groupée, seulement quand une espèce a des traits.
  const demandees = new Set(entryKeys);
  const traitKeys = new Set<string>();
  for (const entryKey of demandees) {
    const traits = (resolved.get(entryKey)?.blocksByType.get("species_traits") as { traits?: { kind: string; key: string }[] } | undefined)?.traits ?? [];
    for (const t of traits) if (t.kind !== "entity" && !demandees.has(t.key)) traitKeys.add(t.key);
  }
  const resolvedTraits = traitKeys.size > 0 ? await resolveEntryBlocksInRulesetBatch(supabase, rulesetId, [...traitKeys]) : new Map();

  const sources: [string, unknown][] = [
    ...[...demandees].map((k): [string, unknown] => [k, resolved.get(k)?.blocksByType.get("triggers")]),
    ...[...traitKeys].map((k): [string, unknown] => [k, resolvedTraits.get(k)?.blocksByType.get("triggers")]),
  ];
  for (const [entryKey, data] of sources) {
    if (!data) continue;

    const raw = (data as { triggers?: unknown[] }).triggers ?? [];
    raw.forEach((candidate, index) => {
      // Valide UNE PAR UNE plutot que le bloc entier : un declencheur casse
      // ne doit pas emporter les autres declencheurs de la meme fiche.
      const parsed = zTrigger.safeParse(candidate);
      if (parsed.success) {
        triggers.push(parsed.data);
        return;
      }
      rejected.push({
        entryKey,
        index,
        reason: parsed.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" ; "),
      });
    });
  }

  return { triggers, rejected };
}
