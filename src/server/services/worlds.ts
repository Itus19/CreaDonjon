import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { nextSlugCandidate, slugify } from "@/src/core/slug/slug";
import {
  getWorldById,
  getWorldBySlugForCurrentUser,
  insertWorld,
  listWorldsForCurrentUser,
  ownerHasSlug,
  type WorldSummary,
} from "@/src/server/repos/worlds";

type TypedClient = SupabaseClient<Database>;

const MAX_SLUG_ATTEMPTS = 50;

export async function listWorlds(supabase: TypedClient): Promise<WorldSummary[]> {
  return listWorldsForCurrentUser(supabase);
}

export async function getWorld(supabase: TypedClient, id: string): Promise<WorldSummary | null> {
  return getWorldById(supabase, id);
}

export async function getWorldBySlug(
  supabase: TypedClient,
  slug: string
): Promise<WorldSummary | null> {
  return getWorldBySlugForCurrentUser(supabase, slug);
}

/** Derive un slug unique (parmi les mondes du meme proprietaire) a partir du nom, en suffixant -2, -3... en cas de collision. */
async function generateUniqueSlug(
  supabase: TypedClient,
  ownerId: string,
  name: string
): Promise<string> {
  const base = slugify(name);
  const baseSlug = base === "" ? "monde" : base;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? baseSlug : nextSlugCandidate(baseSlug, attempt);
    if (!(await ownerHasSlug(supabase, ownerId, candidate))) {
      return candidate;
    }
  }
  throw new Error("Impossible de generer un slug unique.");
}

export async function createWorld(
  supabase: TypedClient,
  params: { ownerId: string; name: string }
): Promise<WorldSummary> {
  const slug = await generateUniqueSlug(supabase, params.ownerId, params.name);
  return insertWorld(supabase, { ownerId: params.ownerId, name: params.name, slug });
}
