import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { CombatParticipantRow } from "@/src/server/repos/combats";

export type { CombatParticipantRow };

type TypedClient = SupabaseClient<Database>;


/**
 * V3.1-104 (ADR 0041) — Applique un changement signé par le moteur
 * (`public.apply_engine_change`, security definer). Le client est celui de
 * l'utilisateur : la fonction vérifie la signature, et rien d'autre ne lui
 * donne le droit d'écrire. Un refus (signature, rejeu, champ, campagne) remonte
 * en erreur, jamais en silence.
 */
export async function applyEngineChange(supabase: TypedClient, payload: string, signature: string): Promise<void> {
  const { error } = await supabase.rpc("apply_engine_change", { p_payload: payload, p_signature: signature });
  if (error) throw new Error(`Changement du moteur refusé : ${error.message}`);
}

/** V3.1-107 (ADR 0069) — les participants d'un combat, rendus par la base à une demande signée (`public.engine_read_combat`). */
export async function readCombatSigned(supabase: TypedClient, payload: string, signature: string): Promise<CombatParticipantRow[]> {
  const { data, error } = await supabase.rpc("engine_read_combat", { p_payload: payload, p_signature: signature });
  if (error) throw new Error(`Lecture du moteur refusée : ${error.message}`);
  return (data ?? []) as CombatParticipantRow[];
}
