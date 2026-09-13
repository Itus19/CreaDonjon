import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { ExtractedMention } from "@/src/core/linker/mentions";

type TypedClient = SupabaseClient<Database>;

/**
 * Remplace TOUTES les mentions d'une source donnée (bloc de texte, V2.1-1 —
 * specs/wiki-liens-et-personnages.md §A2 "Recalculé à chaque écriture
 * d'entité : on remplace toutes les lignes de cette source") — jamais un
 * ajout incrémental, qui laisserait des mentions fantômes après suppression
 * d'un lien dans le texte.
 */
export async function replaceMentionsForSource(
  supabase: TypedClient,
  params: {
    worldId: string;
    sourceEntityId: string;
    sourcePath: string;
    mentions: ExtractedMention[];
  }
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("entity_mentions")
    .delete()
    .eq("source_entity_id", params.sourceEntityId)
    .eq("source_path", params.sourcePath);
  if (deleteError) throw new Error(deleteError.message);

  if (params.mentions.length === 0) return;

  const { error: insertError } = await supabase.from("entity_mentions").insert(
    params.mentions.map((m) => ({
      world_id: params.worldId,
      source_entity_id: params.sourceEntityId,
      source_path: params.sourcePath,
      target_kind: m.targetKind,
      target_entity_id: m.targetEntityId ?? null,
      target_rule_key: m.targetRuleKey ?? null,
      origin: "link",
      visibility_level: m.visibilityLevel,
      visibility_scope_id: m.visibilityScopeId,
    }))
  );
  if (insertError) throw new Error(insertError.message);
}

/** Bloc supprimé (V2.1-1) : retire ses mentions sans laisser de ligne fantôme — pas besoin du monde, seule la source identifie les lignes à retirer. */
export async function deleteMentionsForSource(supabase: TypedClient, params: { sourceEntityId: string; sourcePath: string }): Promise<void> {
  const { error } = await supabase
    .from("entity_mentions")
    .delete()
    .eq("source_entity_id", params.sourceEntityId)
    .eq("source_path", params.sourcePath);
  if (error) throw new Error(error.message);
}

export interface MentionRow {
  sourceEntityId: string;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

/** Rétroliens vers une fiche (V2.1-1, panneau "Mentionné dans") — la RLS (`entity_mentions_select`) filtre déjà par visibilité pour l'appelant, cette fonction ne fait que lire ce qui reste. */
export async function listMentionsTargetingEntity(supabase: TypedClient, targetEntityId: string): Promise<MentionRow[]> {
  const { data, error } = await supabase
    .from("entity_mentions")
    .select("source_entity_id, visibility_level, visibility_scope_id")
    .eq("target_kind", "entity")
    .eq("target_entity_id", targetEntityId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    sourceEntityId: r.source_entity_id,
    visibilityLevel: r.visibility_level,
    visibilityScopeId: r.visibility_scope_id,
  }));
}
