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
  name: string;
  slug: string;
  /** `null` : monde sans campagne — ne devrait plus arriver pour un monde cree apres la migration 20260826100001, mais reste possible pour un monde plus ancien pas encore complete. */
  mode: "campaign" | "solo" | null;
  rulesetName: string | null;
  /** Rempli par le service (`listWorldCards`), pas par cette fonction : resoudre espece/classe exige `assembleResolvedRuleset` (locale-dependant), hors de portee d'un simple repo. */
  players: WorldCardPlayerCharacter[];
  /** Le plus recent entre `worlds.updated_at` et l'edition la plus recente d'une entite du monde — calcule par l'appelant (`listWorldCardsForCurrentUser`), jamais en base. */
  lastModified: string;
}

/**
 * Ecran d'accueil enrichi (prepa V2-G1 export/import, decision produit "un
 * monde = une campagne") : une seule requete imbriquee (monde -> campagne)
 * plutot que N+1 allers-retours par monde. RLS filtre deja l'appartenance
 * (SCHEMA.md §19.2) : rien a ajouter ici pour la visibilite. `players` part
 * volontairement vide ici — voir `listWorldCards` (service), qui la remplit.
 */
export async function listWorldCardsForCurrentUser(supabase: TypedClient): Promise<WorldCard[]> {
  const { data, error } = await supabase
    .from("worlds")
    .select(`id, name, slug, updated_at, campaigns ( mode, rulesets ( name ) )`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const worldIds = data.map((w) => w.id);
  const lastEntityEditByWorld = await latestEntityEditByWorld(supabase, worldIds);

  return data.map((w) => {
    const campaign = w.campaigns[0] as { mode: string; rulesets: { name: string } | null } | undefined;
    const entityLast = lastEntityEditByWorld.get(w.id);
    const lastModified = entityLast && entityLast > w.updated_at ? entityLast : w.updated_at;
    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      mode: (campaign?.mode as "campaign" | "solo" | undefined) ?? null,
      rulesetName: campaign?.rulesets?.name ?? null,
      players: [],
      lastModified,
    };
  });
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
