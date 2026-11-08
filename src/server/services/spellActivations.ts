import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { zActivationBlockData, type ActivationBlockData } from "@/src/core/schemas/rule-blocks/playable";
import type { CharacterActionContext } from "@/src/server/services/characterActions";
import { resolveEntryBlocksInRulesetBatch } from "@/src/server/services/rules";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-166 (ADR 0076) — les blocs `activation` des sorts que le personnage
 * connaît (ou qu'une aptitude lui accorde), lus en UNE lecture groupée.
 * Servent à la fiche (un sort jouable se lance par sa carte) et aux fenêtres
 * de réaction (un sort à déclencheur, Bouclier). Un sort sans bloc n'y est pas.
 */
export async function loadSpellActivations(supabase: TypedClient, ctx: Pick<CharacterActionContext, "spellcastingData" | "sheet" | "rulesetId">): Promise<Record<string, ActivationBlockData>> {
  const cles = [
    ...new Set([...(ctx.spellcastingData?.known ?? []).flatMap((k) => (k.ref.kind === "rule" ? [k.ref.key] : [])), ...ctx.sheet.grantedSpells.map((g) => g.key)]),
  ];
  if (cles.length === 0) return {};
  const blocs = await resolveEntryBlocksInRulesetBatch(supabase, ctx.rulesetId, cles);
  const out: Record<string, ActivationBlockData> = {};
  for (const cle of cles) {
    const lu = zActivationBlockData.safeParse(blocs.get(cle)?.blocksByType.get("activation"));
    if (lu.success) out[cle] = lu.data;
  }
  return out;
}
