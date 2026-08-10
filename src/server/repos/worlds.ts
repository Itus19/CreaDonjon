import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface WorldSummary {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

/** RLS filtre deja par appartenance au monde (SCHEMA.md §19.2) : rien a ajouter ici. */
export async function listWorldsForCurrentUser(supabase: TypedClient): Promise<WorldSummary[]> {
  const { data, error } = await supabase
    .from("worlds")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Recherche par id, pas par slug : `worlds.slug` n'est unique que par
 * proprietaire (`unique(owner_id, slug)`), deux mondes de deux
 * utilisateurs differents peuvent partager le meme slug — l'utiliser
 * seul comme cle de routage serait ambigu des qu'un utilisateur est
 * membre de plusieurs mondes portant le meme nom.
 *
 * RLS filtre l'acces : renvoie null si le monde n'existe pas OU si
 * l'utilisateur n'en est pas membre — les deux cas se traitent pareil
 * cote appelant (404).
 */
export async function getWorldById(
  supabase: TypedClient,
  id: string
): Promise<WorldSummary | null> {
  const { data, error } = await supabase
    .from("worlds")
    .select("id, name, slug, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Resolution pour le routage `/m/[mondeSlug]` (specs/coquille-et-design.md
 * §4.1). `worlds.slug` n'est unique que par proprietaire : RLS filtre deja
 * aux mondes dont l'utilisateur est membre, mais si cette liste filtree
 * contient malgre tout plus d'une ligne pour ce slug (membre de deux
 * mondes de deux proprietaires differents partageant le meme slug), on ne
 * devine pas laquelle afficher — on traite ca comme "non trouve", pas
 * silencieusement la premiere venue.
 */
export async function getWorldBySlugForCurrentUser(
  supabase: TypedClient,
  slug: string
): Promise<WorldSummary | null> {
  const { data, error } = await supabase
    .from("worlds")
    .select("id, name, slug, created_at")
    .eq("slug", slug);
  if (error) throw new Error(error.message);
  if (data.length !== 1) return null;
  return data[0];
}

/** Pour la resolution d'une fiche de regle (V1-A1) : quel ruleset ce monde utilise, s'il en a un. */
export async function getWorldDefaultRulesetId(
  supabase: TypedClient,
  worldId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("worlds")
    .select("default_ruleset_id")
    .eq("id", worldId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.default_ruleset_id ?? null;
}

/**
 * Change le ruleset actif d'un monde (V1-C5). RLS (`worlds_write`) exige
 * `owner_id = auth.uid()` : un appel par un simple membre met a jour 0 ligne
 * sans erreur explicite — retourne le nombre de lignes touchees pour que le
 * service appelant puisse distinguer "reussi" de "refuse silencieusement
 * par la RLS" plutot que de pretendre un succes a tort.
 */
export async function setWorldDefaultRuleset(
  supabase: TypedClient,
  worldId: string,
  rulesetId: string
): Promise<{ updated: boolean }> {
  const { data, error } = await supabase
    .from("worlds")
    .update({ default_ruleset_id: rulesetId })
    .eq("id", worldId)
    .select("id");
  if (error) throw new Error(error.message);
  return { updated: data.length > 0 };
}

export async function ownerHasSlug(
  supabase: TypedClient,
  ownerId: string,
  slug: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("worlds")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

export async function insertWorld(
  supabase: TypedClient,
  params: { ownerId: string; name: string; slug: string }
): Promise<WorldSummary> {
  const { data, error } = await supabase
    .from("worlds")
    .insert({ owner_id: params.ownerId, name: params.name, slug: params.slug })
    .select("id, name, slug, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
