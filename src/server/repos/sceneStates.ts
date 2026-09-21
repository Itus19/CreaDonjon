import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { zSceneState, type SceneState } from "@/src/core/rules/scene";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-A4 — La scene courante d'une campagne (`scene_states`, une ligne par
 * campagne).
 *
 * La forme est validee par `zSceneState` a la LECTURE comme a l'ecriture.
 * A la lecture parce qu'une colonne `jsonb` ne garantit rien : une scene
 * ecrite par une version anterieure du moteur, ou touchee a la main, doit
 * etre refusee bruyamment plutot que de circuler a moitie formee jusqu'a
 * un declencheur qui s'y casse.
 */

export async function getSceneState(supabase: TypedClient, campaignId: string): Promise<SceneState | null> {
  const { data, error } = await supabase
    .from("scene_states")
    .select("state")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const parsed = zSceneState.safeParse(data.state);
  if (!parsed.success) {
    throw new Error(
      `Scene illisible pour la campagne ${campaignId} : ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`)
        .join(" ; ")}`
    );
  }
  return parsed.data;
}

/** Remplace la scene courante. `updatedBy` trace QUI l'a fait avancer — jamais un modele (V3-A4). */
export async function putSceneState(
  supabase: TypedClient,
  params: { campaignId: string; state: SceneState; updatedBy: string | null }
): Promise<void> {
  const state = zSceneState.parse(params.state);
  const { error } = await supabase.from("scene_states").upsert(
    {
      campaign_id: params.campaignId,
      state: state as unknown as Json,
      updated_at: new Date().toISOString(),
      updated_by: params.updatedBy,
    },
    { onConflict: "campaign_id" }
  );
  if (error) throw new Error(error.message);
}
