import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface WorldSummary {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  wiki_welcome_message: string | null;
}

const WORLD_SUMMARY_COLUMNS = "id, name, slug, created_at, wiki_welcome_message";

/**
 * RLS filtre deja par appartenance au monde (SCHEMA.md §19.2) — sauf pour
 * le superadmin, qui voit TOUS les mondes (`worlds_select`, migration
 * 20260830180001, V2-M6 : le selecteur de monde du journal fusionne doit
 * pouvoir viser n'importe quel monde, pas seulement les siens). Trie par
 * nom (pas par date de creation) : c'est aussi le selecteur de la section
 * Administration, jamais utilise ailleurs pour l'instant.
 */
export async function listWorldsForCurrentUser(supabase: TypedClient): Promise<WorldSummary[]> {
  const { data, error } = await supabase.from("worlds").select(WORLD_SUMMARY_COLUMNS).order("name");
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
    .select(WORLD_SUMMARY_COLUMNS)
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
    .select(WORLD_SUMMARY_COLUMNS)
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

/** Export/duplication (V2-G1) : reserves au proprietaire, jamais a un simple membre invite — produit une copie transferable, la meme ligne que trace specs/ruleset-personnel.md §3.1 pour le ruleset personnel. */
export async function getWorldOwnerId(supabase: TypedClient, worldId: string): Promise<string | null> {
  const { data, error } = await supabase.from("worlds").select("owner_id").eq("id", worldId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.owner_id ?? null;
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

/** Une ligne par PJ sur la carte de monde de l'ecran d'accueil (V2-G1 suite, retour utilisateur) — nom, espece et classe(s)/niveau, mêmes libelles que la page d'accueil du monde (`listWorldPlayerCharacters`), jamais une seconde resolution de regles. */
export interface WorldCardPlayerCharacter {
  entityId: string;
  entitySlug: string;
  name: string;
  speciesLabel: string | null;
  classesLabel: string | null;
}

export interface WorldCard {
  id: string;
  /** V2, retour utilisateur (ecran d'accueil) : distingue "proprietaire" de "simple membre invite" pour n'afficher Renommer/Supprimer qu'au premier — RLS (`worlds_write`) les refuserait de toute facon au second, mais autant ne pas afficher un bouton qui echoue toujours. */
  ownerId: string;
  name: string;
  slug: string;
  /** `null` : monde sans campagne — ne devrait plus arriver pour un monde cree apres la migration 20260826100001, mais reste possible pour un monde plus ancien pas encore complete. */
  mode: "campaign" | "solo" | null;
  /** V2-M1, retour utilisateur : distinguer plusieurs copies d'un meme monde (une par ami MJ) par le nom de la CAMPAGNE, pas celui du monde — les deux `null` ensemble avec `mode`. */
  campaignId: string | null;
  campaignName: string | null;
  rulesetName: string | null;
  /** Rempli par le service (`listWorldCards`), pas par cette fonction : resoudre espece/classe exige `assembleResolvedRuleset` (locale-dependant), hors de portee d'un simple repo. */
  players: WorldCardPlayerCharacter[];
  /** Le plus recent entre `worlds.updated_at` et l'edition la plus recente d'une entite du monde — calcule par l'appelant (`listWorldCardsForCurrentUser`), jamais en base. */
  lastModified: string;
  /**
   * Role de l'utilisateur COURANT dans CE monde (V2-M5, ecran d'accueil
   * unifie, retour utilisateur 30 aout) — jamais un role global de compte :
   * un meme compte peut etre MJ d'un monde et joueur d'un autre. `null`
   * seulement pour un `world_members.role = 'viewer'` pur, sans role de
   * campagne (cas theorique, jamais produit par un flux existant).
   */
  myRole: "gm" | "player" | null;
  /** Rempli seulement si `myRole === 'player'` et qu'un personnage est deja reclame dans la campagne de ce monde. */
  myCharacter: { entityId: string; entitySlug: string; name: string } | null;
}

/**
 * Ecran d'accueil enrichi (prepa V2-G1 export/import, decision produit "un
 * monde = une campagne") : une seule requete imbriquee (monde -> campagne)
 * plutot que N+1 allers-retours par monde.
 *
 * RLS ne suffit plus seule pour scoper "mes mondes" depuis que
 * `worlds_select` laisse aussi passer `app.is_superadmin()` (migration
 * 20260830180001, V2-M6) : sans filtre applicatif ici, l'ecran d'accueil du
 * superadmin listerait TOUS les mondes de la base, mal etiquetes "MJ" par
 * `app/page.tsx` (myRole null traite comme MJ), avec les actions
 * proprietaire (Renommer/Supprimer) affichees a tort. On filtre donc
 * explicitement a owner_id === userId OU un role reel via
 * `getMyRolePerWorld` — meme discipline que `renameWorld`/
 * `deleteWorldWithConfirmation` (CLAUDE.md §1 : la RLS est le filet, pas la
 * verification). `players` part volontairement vide ici — voir
 * `listWorldCards` (service), qui la remplit.
 */
export async function listWorldCardsForCurrentUser(supabase: TypedClient, userId: string): Promise<WorldCard[]> {
  const { data: rawData, error } = await supabase
    .from("worlds")
    .select(`id, owner_id, name, slug, updated_at, campaigns ( id, name, mode, rulesets ( name ) )`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rawWorldIds = rawData.map((w) => w.id);
  const rawCampaignIdByWorldId = new Map(
    rawData
      .map((w) => [w.id, (w.campaigns[0] as { id: string } | undefined)?.id])
      .filter((pair): pair is [string, string] => pair[1] !== undefined)
  );
  const myRoleByWorld = await getMyRolePerWorld(supabase, {
    userId,
    worldIds: rawWorldIds,
    campaignIdByWorldId: rawCampaignIdByWorldId,
  });
  const data = rawData.filter((w) => w.owner_id === userId || myRoleByWorld.has(w.id));

  const worldIds = data.map((w) => w.id);
  const campaignIdByWorldId = new Map(
    data
      .map((w) => [w.id, (w.campaigns[0] as { id: string } | undefined)?.id])
      .filter((pair): pair is [string, string] => pair[1] !== undefined)
  );
  const [lastEntityEditByWorld, myCharacterByCampaign] = await Promise.all([
    latestEntityEditByWorld(supabase, worldIds),
    getMyClaimedCharacterPerCampaign(supabase, { userId, campaignIds: [...campaignIdByWorldId.values()] }),
  ]);

  return data.map((w) => {
    const campaign = w.campaigns[0] as { id: string; name: string; mode: string; rulesets: { name: string } | null } | undefined;
    const entityLast = lastEntityEditByWorld.get(w.id);
    const lastModified = entityLast && entityLast > w.updated_at ? entityLast : w.updated_at;
    const myRole = w.owner_id === userId ? "gm" : (myRoleByWorld.get(w.id) ?? null);
    const myCharacter = myRole === "player" && campaign ? (myCharacterByCampaign.get(campaign.id) ?? null) : null;
    return {
      id: w.id,
      ownerId: w.owner_id,
      name: w.name,
      slug: w.slug,
      mode: (campaign?.mode as "campaign" | "solo" | undefined) ?? null,
      campaignId: campaign?.id ?? null,
      campaignName: campaign?.name ?? null,
      rulesetName: campaign?.rulesets?.name ?? null,
      players: [],
      lastModified,
      myRole,
      myCharacter,
    };
  });
}

/**
 * Role de l'utilisateur COURANT, par monde (V2-M5) : proprietaire du monde
 * deja tranche par l'appelant (`w.owner_id === userId`) — ici seulement
 * `world_members` (owner/editor => MJ) et `campaign_members` (gm => MJ,
 * player => Joueur), sans faire N requetes (une par table, jamais une par
 * monde).
 */
async function getMyRolePerWorld(
  supabase: TypedClient,
  params: { userId: string; worldIds: string[]; campaignIdByWorldId: Map<string, string> }
): Promise<Map<string, "gm" | "player">> {
  const result = new Map<string, "gm" | "player">();
  if (params.worldIds.length === 0) return result;

  const { data: worldMemberRows, error: worldMemberError } = await supabase
    .from("world_members")
    .select("world_id, role")
    .eq("user_id", params.userId)
    .in("world_id", params.worldIds);
  if (worldMemberError) throw new Error(worldMemberError.message);
  for (const row of worldMemberRows) {
    if (row.role === "owner" || row.role === "editor") result.set(row.world_id, "gm");
  }

  const campaignIds = [...params.campaignIdByWorldId.values()];
  if (campaignIds.length > 0) {
    const { data: campaignMemberRows, error: campaignMemberError } = await supabase
      .from("campaign_members")
      .select("campaign_id, role")
      .eq("user_id", params.userId)
      .in("campaign_id", campaignIds);
    if (campaignMemberError) throw new Error(campaignMemberError.message);
    const roleByCampaignId = new Map(campaignMemberRows.map((r) => [r.campaign_id, r.role as "gm" | "player"]));
    for (const [worldId, campaignId] of params.campaignIdByWorldId) {
      const role = roleByCampaignId.get(campaignId);
      // Un role MJ (world_members) l'emporte deja ; ne jamais ecraser "gm"
      // par "player" si les deux existent (ne devrait pas arriver, mais un
      // proprietaire pourrait theoriquement avoir aussi une ligne
      // campaign_members "player" residuelle).
      if (role === "gm") result.set(worldId, "gm");
      else if (role === "player" && !result.has(worldId)) result.set(worldId, "player");
    }
  }

  return result;
}

/** Personnage reclame par l'utilisateur COURANT, par campagne (V2-M5) — une seule requete, jamais une par monde. */
async function getMyClaimedCharacterPerCampaign(
  supabase: TypedClient,
  params: { userId: string; campaignIds: string[] }
): Promise<Map<string, { entityId: string; entitySlug: string; name: string }>> {
  const result = new Map<string, { entityId: string; entitySlug: string; name: string }>();
  if (params.campaignIds.length === 0) return result;

  const { data, error } = await supabase
    .from("campaign_characters")
    .select("campaign_id, entities ( id, slug, name )")
    .eq("user_id", params.userId)
    .in("campaign_id", params.campaignIds);
  if (error) throw new Error(error.message);
  for (const row of data) {
    const entity = row.entities as { id: string; slug: string; name: string } | null;
    if (entity) result.set(row.campaign_id, { entityId: entity.id, entitySlug: entity.slug, name: entity.name });
  }
  return result;
}

/** Edition la plus recente d'une entite, par monde — une seule requete triee plutot qu'un `MAX(updated_at) GROUP BY` cote base (pas de vue SQL pour un besoin d'affichage seul). */
async function latestEntityEditByWorld(supabase: TypedClient, worldIds: string[]): Promise<Map<string, string>> {
  if (worldIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("entities")
    .select("world_id, updated_at")
    .in("world_id", worldIds)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const row of data) {
    if (!map.has(row.world_id)) map.set(row.world_id, row.updated_at);
  }
  return map;
}

/**
 * Renommage (V2, retour utilisateur, ecran d'accueil) : ne touche jamais
 * `slug` — les liens `/m/[slug]` et les liens de partage restent stables
 * apres un renommage, seul le nom affiche change.
 */
export async function updateWorldName(
  supabase: TypedClient,
  worldId: string,
  name: string
): Promise<{ updated: boolean }> {
  const { data, error } = await supabase.from("worlds").update({ name }).eq("id", worldId).select("id");
  if (error) throw new Error(error.message);
  return { updated: data.length > 0 };
}

/**
 * Suppression definitive (V2, retour utilisateur, ecran d'accueil) : RLS
 * (`worlds_write`) restreint deja l'ecriture au proprietaire, et
 * `supabase/tests/p0-06_world_deletion_no_orphans.sql` garantit qu'aucune
 * ligne dependante (entites, campagnes, relations...) ne survit — un
 * simple DELETE suffit, la cascade est verifiee cote base.
 */
export async function deleteWorldRow(supabase: TypedClient, worldId: string): Promise<{ deleted: boolean }> {
  const { data, error } = await supabase.from("worlds").delete().eq("id", worldId).select("id");
  if (error) throw new Error(error.message);
  return { deleted: data.length > 0 };
}

export async function insertWorld(
  supabase: TypedClient,
  params: { ownerId: string; name: string; slug: string }
): Promise<WorldSummary> {
  const { data, error } = await supabase
    .from("worlds")
    .insert({ owner_id: params.ownerId, name: params.name, slug: params.slug })
    .select(WORLD_SUMMARY_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Panneau de publication (V2-G2, extension) : `null` efface la personnalisation, l'appelant retombe alors sur le message calcule. */
export async function setWorldWikiWelcomeMessage(
  supabase: TypedClient,
  worldId: string,
  message: string | null
): Promise<{ updated: boolean }> {
  const { data, error } = await supabase
    .from("worlds")
    .update({ wiki_welcome_message: message })
    .eq("id", worldId)
    .select("id");
  if (error) throw new Error(error.message);
  return { updated: data.length > 0 };
}

/** Calendrier brut d'un monde (V2-H2) : `{}` tant que le MJ n'a rien regle — l'appelant (`getCalendar`, services/worlds.ts) retombe alors sur `DEFAULT_CALENDAR`, jamais valide ici (pas de dependance zod dans la couche repo). */
export async function getWorldCalendar(supabase: TypedClient, worldId: string): Promise<Json | null> {
  const { data, error } = await supabase.from("worlds").select("calendar").eq("id", worldId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.calendar ?? null;
}

/** Remplace le calendrier entier (deja valide par l'appelant) : un seul JSON par monde, meme profil que `setWorldEntityKindOrder`. */
export async function setWorldCalendar(
  supabase: TypedClient,
  worldId: string,
  calendar: Json
): Promise<{ updated: boolean }> {
  const { data, error } = await supabase.from("worlds").update({ calendar }).eq("id", worldId).select("id");
  if (error) throw new Error(error.message);
  return { updated: data.length > 0 };
}

/** Ordre des categories de la sidebar (V2-G9, glisser-depose) : vide tant que jamais reordonne, l'appelant retombe alors sur l'ordre alphabetique. */
export async function getWorldEntityKindOrder(supabase: TypedClient, worldId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("worlds")
    .select("entity_kind_order")
    .eq("id", worldId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.entity_kind_order as string[] | null) ?? [];
}

/** Remplace le tableau entier (pas de version : un seul JSON par monde, dernier ecrivain gagne — meme profil que setWorldWikiWelcomeMessage). */
export async function setWorldEntityKindOrder(
  supabase: TypedClient,
  worldId: string,
  order: string[]
): Promise<{ updated: boolean }> {
  const { data, error } = await supabase
    .from("worlds")
    .update({ entity_kind_order: order })
    .eq("id", worldId)
    .select("id");
  if (error) throw new Error(error.message);
  return { updated: data.length > 0 };
}
