import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { dcForTier, type CheckTier } from "@/src/core/rules/checkDifficulty";
import { NPC_CHECK_ACTIONS, modificateurJetPnj, resoudreJetPnj, type NpcCheckAction } from "@/src/core/rules/npcRolls";
import { zStatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { serverRng } from "@/src/server/services/rng";
import { PC_OBSERVATION_CHECKS, learnFromNpcCheckOnPc } from "@/src/server/services/npcKnowledge";

type TypedClient = SupabaseClient<Database>;

/** La source du journal : `turnContext` relit ces issues pour la narration suivante. */
export const NPC_CHECK_SOURCE = "npc_check";

/**
 * V3.2-52 — La narration a proposé qu'un PNJ présent tente une action de la
 * liste fermée ; le moteur lance le dé (règle 8) avec la fiche allégée du PNJ
 * et le DD du palier, puis journalise l'issue. La narration suivante la
 * reçoit comme fait établi et la raconte sans la juger.
 *
 * Le fait ne dit que l'action, le DD et le verdict : ni le dé ni le total,
 * qui trahiraient le modificateur de la fiche (règle 5, ADR 0118 §5).
 *
 * Coût (docs/QUOTAS.md) : seulement quand la narration propose un jet, deux
 * lectures (la fiche, le nom) et un événement de journal.
 */
export async function jouerJetDePnj(
  supabase: TypedClient,
  params: {
    worldId: string;
    sessionId: string;
    npcId: string;
    action: NpcCheckAction;
    tier: CheckTier;
    callerId: string;
    /** V3.2-80 — le jet jauge le personnage joué (repérer, fouiller, jauger, soigner) : ce que le PNJ apprend reste secret. */
    onPc?: { campaignId: string; pcEntityId: string; pcName: string };
  }
): Promise<string | null> {
  // La fiche est un secret de MJ : en solo, la personne qui joue est MJ de son monde.
  if (!(await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.callerId }))) return null;
  const [blocs, entites] = await Promise.all([
    listBlocksByTypeForEntities(supabase, [params.npcId], "statblock"),
    listEntitiesByIds(supabase, [params.npcId]),
  ]);
  const fiche = blocs.map((b) => zStatblockBlockData.safeParse(b.data)).find((p) => p.success)?.data;
  // Une esquisse ou un PNJ sans fiche allégée : pas de jet, la narration a déjà dit la tentative.
  if (!fiche) return null;

  const jet = NPC_CHECK_ACTIONS[params.action];
  const dc = dcForTier(params.tier);
  const issue = resoudreJetPnj(modificateurJetPnj(fiche, jet), dc, serverRng);
  const nom = entites[0]?.name ?? "Le PNJ";
  const skillSurPj = params.onPc ? PC_OBSERVATION_CHECKS[params.action] : undefined;
  // V3.2-80 — un jet sur le personnage se lance en secret, comme le MJ le ferait : ni verdict ni DD pour la personne qui joue.
  const fait = params.onPc && skillSurPj
    ? `Issue décidée par le moteur : ${nom} tente de ${jet.label} ${params.onPc.pcName} ; ce qu'il ou elle en retient reste secret.`
    : `Issue décidée par le moteur : ${nom} tente de ${jet.label} (DD ${dc}) — ${issue.reussi ? "réussite" : "échec"}.`;

  const event = await insertSessionEvent(supabase, {
    sessionId: params.sessionId,
    seq: await nextEventSeq(supabase, params.sessionId),
    kind: "rule_application",
    actor: "system",
    actorUserId: null,
    payload: { __v: 1, source: NPC_CHECK_SOURCE, entity_id: params.npcId, changes_text: [fait], hints_text: [], ignored_text: [] } as unknown as Json,
  });
  if (params.onPc && skillSurPj && issue.reussi) {
    await learnFromNpcCheckOnPc(supabase, {
      campaignId: params.onPc.campaignId,
      npcId: params.npcId,
      pcEntityId: params.onPc.pcEntityId,
      skill: skillSurPj,
      total: issue.total,
      dc,
      sourceEventId: event.id,
    });
  }
  return fait;
}
