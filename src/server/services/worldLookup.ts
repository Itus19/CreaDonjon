import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getWorldBySlugForCurrentUser, type WorldSummary } from "@/src/server/repos/worlds";

/**
 * Module feuille (V3.1-120) : il n'importe aucun service. Sorti de
 * `worlds.ts`, qui le reexporte, pour que `rules.ts` lise un monde sans
 * former de cycle avec `worlds.ts`.
 */

type TypedClient = SupabaseClient<Database>;

/**
 * `React.cache()` (retour utilisateur : "l'application... recharge des
 * choses déjà présentes") — appelee independamment par presque chaque
 * layout/page de l'arborescence d'un monde (`app/m/[worldSlug]/layout.tsx`,
 * `joueur/layout.tsx`, `joueur/fiche/layout.tsx`, la page elle-meme...)
 * pour le MEME `worldSlug` sur UNE seule requete. Fonctionne uniquement
 * parce que `createClient()` (lib/supabase/server.ts) est lui-meme
 * memoise : sans un `supabase` reference-stable, cette memoisation ne
 * ferait jamais de hit.
 */
export const getWorldBySlug = cache(async function getWorldBySlug(
  supabase: TypedClient,
  slug: string
): Promise<WorldSummary | null> {
  return getWorldBySlugForCurrentUser(supabase, slug);
});
