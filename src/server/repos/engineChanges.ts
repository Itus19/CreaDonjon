import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { CombatParticipantRow } from "@/src/server/repos/combats";
import type { ActiveEffectRow } from "@/src/server/repos/activeEffects";

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
/** V3.1-130 (ADR 0073) : les effets posés par une règle dans ce combat (instances) et sur les fiches de la campagne, lus par une demande signée. */
export async function readCombatEffectsSigned(supabase: TypedClient, payload: string, signature: string): Promise<ActiveEffectRow[]> {
  const { data, error } = await supabase.rpc("engine_read_combat_effects", { p_payload: payload, p_signature: signature });
  if (error) throw new Error(`Lecture des effets refusée : ${error.message}`);
  return (data ?? []) as ActiveEffectRow[];
}

export async function readCombatSigned(supabase: TypedClient, payload: string, signature: string): Promise<CombatParticipantRow[]> {
  const { data, error } = await supabase.rpc("engine_read_combat", { p_payload: payload, p_signature: signature });
  if (error) throw new Error(`Lecture du moteur refusée : ${error.message}`);
  return (data ?? []) as CombatParticipantRow[];
}

/** V3.1-160 (ADR 0075) — ouvre une fenêtre de réaction (demande signée). */
export async function openRollWindowSigned(supabase: TypedClient, payload: string, signature: string): Promise<string> {
  const { data, error } = await supabase.rpc("engine_open_roll_window", { p_payload: payload, p_signature: signature });
  if (error || !data) throw new Error(`Ouverture de la fenêtre refusée : ${error?.message ?? "aucun identifiant"}`);
  return data;
}

/** V3.1-160 — l'état figé d'une fenêtre fermée, une seule fois, pour l'auteur du jet. */
export async function resumeRollWindowSigned(supabase: TypedClient, payload: string, signature: string): Promise<unknown> {
  const { data, error } = await supabase.rpc("engine_resume_roll_window", { p_payload: payload, p_signature: signature });
  if (error) throw new Error(`Reprise de la fenêtre refusée : ${error.message}`);
  return data;
}
