import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { nextSlugCandidate, slugify } from "@/src/core/slug/slug";
import { zCalendarConfig, type CalendarConfigInput } from "@/src/core/schemas/calendar";
import { DEFAULT_CALENDAR } from "@/src/core/calendar/defaultCalendar";
import {
  deleteWorldRow,
  getWorldById,
  getWorldBySlugForCurrentUser,
  getWorldCalendar,
  getWorldOwnerId,
  insertWorld,
  listWorldCardsForCurrentUser,
  listWorldsForCurrentUser,
  ownerHasSlug,
  setWorldCalendar,
  setWorldDefaultRuleset,
  setWorldEntityKindOrder,
  setWorldWikiWelcomeMessage,
  updateWorldName,
  type WorldCard,
  type WorldSummary,
} from "@/src/server/repos/worlds";
import { createCampaign, type CampaignSummary } from "@/src/server/services/campaigns";
import { listWorldPlayerCharacters } from "@/src/server/services/worldPlayerCharacters";

type TypedClient = SupabaseClient<Database>;

const MAX_SLUG_ATTEMPTS = 50;

export async function listWorlds(supabase: TypedClient): Promise<WorldSummary[]> {
  return listWorldsForCurrentUser(supabase);
}

/**
 * `players` par carte (retour utilisateur, V2-G1 suite) : une ligne par PJ
 * avec espece et classe(s)/niveau, jamais un simple nom — reutilise
 * `listWorldPlayerCharacters` (deja la source de la page d'accueil d'un
 * monde), aucune seconde resolution de regles ecrite ici. Un appel par
 * monde (N+1 assume, meme convention que `listMyGmCampaignsWithMembers` —
 * un compte gere en pratique quelques mondes, pas des milliers).
 */
export async function listWorldCards(supabase: TypedClient, locale: Locale): Promise<WorldCard[]> {
  const cards = await listWorldCardsForCurrentUser(supabase);
  return Promise.all(
    cards.map(async (card) => {
      const characters = await listWorldPlayerCharacters(supabase, card.id, locale);
      return {
        ...card,
        players: characters.map((c) => ({
          entityId: c.entityId,
          entitySlug: c.entitySlug,
          name: c.entityName,
          speciesLabel: c.speciesLabel,
          classesLabel: c.classesLabel,
        })),
      };
    })
  );
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

/** Panneau de publication (V2-G2, extension) : `message` vide efface la personnalisation. */
export async function updateWikiWelcomeMessage(
  supabase: TypedClient,
  worldId: string,
  message: string
): Promise<{ updated: boolean }> {
  return setWorldWikiWelcomeMessage(supabase, worldId, message === "" ? null : message);
}

/** Ordre des categories de la sidebar (V2-G9, glisser-depose) : remplace le tableau entier. */
export async function updateEntityKindOrder(
  supabase: TypedClient,
  worldId: string,
  order: string[]
): Promise<{ updated: boolean }> {
  return setWorldEntityKindOrder(supabase, worldId, order);
}

/**
 * Calendrier d'un monde (V2-H2, specs/wiki-blocs.md §3) : `{}` (jamais
 * regle) ou une valeur corrompue retombent silencieusement sur
 * `DEFAULT_CALENDAR` plutot que de faire echouer la fiche qui en depend —
 * la validation stricte n'intervient qu'a l'ECRITURE (`updateCalendar`).
 */
export async function getCalendar(supabase: TypedClient, worldId: string): Promise<CalendarConfigInput> {
  const raw = await getWorldCalendar(supabase, worldId);
  const parsed = zCalendarConfig.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_CALENDAR;
}

/** Remplace le calendrier entier (deja valide par l'appelant via `zCalendarConfig`, meme profil que `updateEntityKindOrder`). */
export async function updateCalendar(
  supabase: TypedClient,
  worldId: string,
  calendar: CalendarConfigInput
): Promise<{ updated: boolean }> {
  return setWorldCalendar(supabase, worldId, calendar);
}

/**
 * Renommage (V2, retour utilisateur, ecran d'accueil) : verification
 * explicite du proprietaire, meme si RLS (`worlds_write`) la refuserait de
 * toute facon — meme convention que la route de duplication
 * (`/api/worlds/[worldSlug]/duplicate`), qui distingue deja "monde
 * introuvable" de "pas le proprietaire" plutot que de laisser la base
 * echouer silencieusement.
 */
export async function renameWorld(
  supabase: TypedClient,
  params: { worldId: string; userId: string; name: string }
): Promise<{ updated: boolean; error?: "not_found" | "forbidden" }> {
  const ownerId = await getWorldOwnerId(supabase, params.worldId);
  if (ownerId === null) return { updated: false, error: "not_found" };
  if (ownerId !== params.userId) return { updated: false, error: "forbidden" };
  return updateWorldName(supabase, params.worldId, params.name);
}

/**
 * Suppression definitive (V2, retour utilisateur, ecran d'accueil) : la
 * confirmation doit egaler le nom EXACT du monde (pas un mot fixe) — verifie
 * ici, cote serveur, jamais seulement dans le formulaire. Meme verification
 * de proprietaire explicite que `renameWorld` ci-dessus.
 */
export async function deleteWorldWithConfirmation(
  supabase: TypedClient,
  params: { worldId: string; userId: string; confirmation: string }
): Promise<{ deleted: boolean; error?: "not_found" | "forbidden" | "mismatch" }> {
  const world = await getWorldById(supabase, params.worldId);
  if (!world) return { deleted: false, error: "not_found" };
  const ownerId = await getWorldOwnerId(supabase, params.worldId);
  if (ownerId !== params.userId) return { deleted: false, error: "forbidden" };
  if (params.confirmation !== world.name) return { deleted: false, error: "mismatch" };
  return deleteWorldRow(supabase, params.worldId);
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
