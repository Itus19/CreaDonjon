import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { describeConsequence, tallyConsequences, type ConsequenceKind, type ConsequenceTally } from "@/src/core/ai/consequenceText";
import { listPendingAiProposalsForCampaign, listAppliedAiProposalsBySessionEventIds } from "@/src/server/repos/aiProposals";
import { listSessionEventIds } from "@/src/server/repos/sessions";
import { listEntitiesByIds } from "@/src/server/repos/entities";

type TypedClient = SupabaseClient<Database>;

export interface ConsequenceEntry {
  id: string;
  kind: ConsequenceKind;
  text: string;
  /** `null` : l'entite visee a disparu depuis, ou la proposition n'en vise aucune (rare). */
  targetName: string | null;
}

export interface ConsequencesDrawer {
  /** En attente d'une relecture — accepter / modifier / rejeter (`ai_proposals.ts`). S'accumule tant que la campagne dure, jamais borné à une séance. */
  pending: ConsequenceEntry[];
  /** Déjà écrit — auto-appliqué par le moteur ou accepté à la main, PENDANT cette séance. */
  applied: ConsequenceEntry[];
  /** « Le monde a gagné » — ce que `applied` a fait naître, pas ce qu'il a modifié. */
  tally: ConsequenceTally;
}

/**
 * V3-C5 — Assemble le tiroir de conséquences : ce qui reste à relire (toute
 * la campagne) et ce que la séance en cours a déjà écrit dans le monde. Les
 * noms des entités visées sont résolus ici, en un seul aller-retour groupé —
 * jamais un par proposition.
 */
export async function buildConsequencesDrawer(supabase: TypedClient, params: { campaignId: string; sessionId: string }): Promise<ConsequencesDrawer> {
  const [pendingRows, sessionEventIds] = await Promise.all([
    listPendingAiProposalsForCampaign(supabase, params.campaignId),
    listSessionEventIds(supabase, params.sessionId),
  ]);
  const appliedRows = await listAppliedAiProposalsBySessionEventIds(supabase, sessionEventIds);

  const targetIds = [...pendingRows, ...appliedRows]
    .map((r) => r.targetEntityId)
    .filter((id): id is string => id !== null);
  const nameById = new Map((await listEntitiesByIds(supabase, targetIds)).map((e) => [e.id, e.name]));

  const toEntry = (row: (typeof pendingRows)[number]): ConsequenceEntry => ({
    id: row.id,
    kind: row.kind,
    text: describeConsequence(row.kind, row.payload),
    targetName: row.targetEntityId ? (nameById.get(row.targetEntityId) ?? null) : null,
  });

  return {
    pending: pendingRows.map(toEntry),
    applied: appliedRows.map(toEntry),
    tally: tallyConsequences(appliedRows.map((r) => r.kind)),
  };
}
