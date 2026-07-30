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
