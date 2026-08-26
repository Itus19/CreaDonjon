import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { nextSlugCandidate, slugify } from "@/src/core/slug/slug";
import {
  getWorldById,
  getWorldBySlugForCurrentUser,
  insertWorld,
  listWorldCardsForCurrentUser,
  listWorldsForCurrentUser,
  ownerHasSlug,
  setWorldDefaultRuleset,
  type WorldCard,
  type WorldSummary,
} from "@/src/server/repos/worlds";
import { createCampaign, type CampaignSummary } from "@/src/server/services/campaigns";

type TypedClient = SupabaseClient<Database>;

const MAX_SLUG_ATTEMPTS = 50;

export async function listWorlds(supabase: TypedClient): Promise<WorldSummary[]> {
  return listWorldsForCurrentUser(supabase);
}

export async function listWorldCards(supabase: TypedClient): Promise<WorldCard[]> {
  return listWorldCardsForCurrentUser(supabase);
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
export async function generateUniqueSlug(
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

/**
 * Un monde = une campagne (decision produit, prepa V2-G1 export/import) :
 * la creation d'un monde cree toujours, dans la foulee, sa campagne unique
 * (contrainte d'unicite en base, migration 20260826100001) — jamais un
 * monde orphelin qu'il faudrait completer plus tard via un second
 * formulaire. Ecritures sequentielles (comme `createCampaign` elle-meme,
 * qui enchaine deja faction puis campagne puis membre sans transaction
 * explicite) : le risque d'echec partiel est le meme qu'ailleurs dans ce
 * depot, pas aggrave par cet ajout.
 */
export async function createWorldWithCampaign(
  supabase: TypedClient,
  params: { ownerId: string; name: string; rulesetId: string; mode: "campaign" | "solo" }
): Promise<{ world: WorldSummary; campaign: CampaignSummary }> {
  const world = await createWorld(supabase, { ownerId: params.ownerId, name: params.name });
  await setWorldDefaultRuleset(supabase, world.id, params.rulesetId);
  const campaign = await createCampaign(supabase, {
    worldId: world.id,
    createdBy: params.ownerId,
    name: params.name,
    rulesetId: params.rulesetId,
    mode: params.mode,
  });
  // Un monde tout juste cree ne peut jamais avoir de campagne existante —
  // si cette branche est atteinte, c'est un bug ailleurs (cle generee deux
  // fois ?), jamais un cas a avaler silencieusement.
  if (campaign === "world_already_has_campaign") {
    throw new Error("Le monde vient d'etre cree mais possede deja une campagne : incoherence interne.");
  }
  return { world, campaign };
}
