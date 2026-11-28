import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { isDying } from "@/src/core/rules/deathSaves";
import { getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { listCombatParticipants, updateCombatParticipant } from "@/src/server/repos/combats";
import { rollDeathSaveForCharacter } from "@/src/server/services/characterActions";

type TypedClient = SupabaseClient<Database>;

/**
 * Le personnage à terre en solo : à 0 PV, ni stabilisé ni mort, son tour
 * est un jet contre la mort, quoi que dise la phrase (règles 2024). Le d20
 * vient du serveur (`rollDeathSaveForCharacter`, règle 8), qui l'inscrit à
 * l'historique des dés et change l'état de jeu par le chemin journalisé.
 *
 * Rend la phrase du tour (« Jet contre la mort : 12 — réussite… »), ou
 * `null` quand le personnage n'est pas mourant : le tour se joue alors
 * normalement. Sur un 20, il se relève à 1 PV, et sa ligne de combat suit.
 *
 * Coût (docs/QUOTAS.md) : une lecture de l'état de jeu par tour en partie ;
 * le jet lui-même seulement quand il est mourant.
 */
export async function jetContreLaMortDuTour(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; callerId: string; locale: Locale }
): Promise<string | null> {
  const etat = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  if (!isDying({ hp: etat.hp, deathSaves: etat.death_saves })) return null;
  const jet = await rollDeathSaveForCharacter(supabase, { entityId: params.entityId, campaignId: params.campaignId, natural: null, actorUserId: params.callerId, locale: params.locale });
  if (!jet.ok) return null;

  if (jet.revived) {
    const scene = await getSceneState(supabase, params.campaignId);
    if (scene?.activeCombatId) {
      const ligne = (await listCombatParticipants(supabase, scene.activeCombatId)).find((p) => p.entity_id === params.entityId);
      if (ligne) await updateCombatParticipant(supabase, ligne.id, { hpCurrent: 1 });
    }
  }

  const compte = `réussites ${jet.deathSaves.success}/3, échecs ${jet.deathSaves.fail}/3`;
  if (jet.revived) return `Jet contre la mort : 20 naturel — se relève avec 1 PV.`;
  if (jet.dead) return `Jet contre la mort : ${jet.natural} — échec (${compte}). Mort.`;
  if (jet.stabilized) return `Jet contre la mort : ${jet.natural} — réussite (${compte}). Stabilisé·e, hors de danger mais inconscient·e.`;
  return `Jet contre la mort : ${jet.natural} — ${jet.natural >= 10 ? "réussite" : jet.natural === 1 ? "1 naturel, deux échecs" : "échec"} (${compte}).`;
}
