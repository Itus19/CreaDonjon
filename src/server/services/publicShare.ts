import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { createShareLinkServiceClient } from "@/lib/supabase/service";
import { filterBlocks, filterSegments, type VisibilityLevel } from "@/src/core/visibility";
import { verifySharePassword } from "@/src/core/shareLinks/password";
import type { BlockDisplay } from "@/src/core/schemas/blocks/envelope";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { type BlockRow, listBlocksForEntity } from "@/src/server/repos/blocks";
import { type EntitySummary, getEntityBySlug, listEntitiesForWorld } from "@/src/server/repos/entities";
import { listPartOfRelationsForWorld } from "@/src/server/repos/relations";
import { listCampaignsForWorld } from "@/src/server/repos/campaigns";
import { getWorldById } from "@/src/server/repos/worlds";
import { buildEntityTree, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";

/**
 * Seul fichier ou `createShareLinkServiceClient` (lib/supabase/service.ts)
 * est construit et utilise — verifie mecaniquement par une regle ESLint
 * (eslint.config.mjs), pas seulement par convention (V1 D-01). Les pages
 * publiques (app/partage/**) n'importent jamais de client Supabase : elles
 * appellent les fonctions d'ici avec un jeton ou un world_id deja valide,
 * jamais l'inverse.
 */
function createAnonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export interface ResolvedShareLink {
  worldId: string;
  worldName: string;
  worldSlug: string;
  scope: string;
  /** Jamais transmis au client — sert uniquement a decider si la page doit demander un mot de passe avant tout chargement de contenu (V1-C4). */
  passwordHash: string | null;
  passwordAttempts: number;
}

/**
 * Passe par la fonction `security definer` public.resolve_share_link
 * (migration 20260801140001) : la cle anon suffit, aucune session
 * necessaire (la fonction est grantee a `anon`) — pas besoin du client
 * service-role pour cette seule verification. `null` couvre aussi bien
 * "jamais existe" que "expire"/"revoque" — jamais de distinction cote
 * appelant (docs/BACKLOG.md V0-07, ne pas reveler qu'un lien a existe).
 */
export async function resolveShareLink(token: string): Promise<ResolvedShareLink | null> {
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("resolve_share_link", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    worldId: row.world_id,
    worldName: row.world_name,
    worldSlug: row.world_slug,
    scope: row.scope,
    passwordHash: row.password_hash,
    passwordAttempts: row.password_attempts,
  };
}

/** Au-dela, le mot de passe ne protege plus rien (specs/arbitrage-modifications.md §3.2, "sinon le mot de passe ne protege rien") — le lien reste utilisable via son jeton, mais plus de nouvelle tentative de mot de passe. */
const MAX_PASSWORD_ATTEMPTS = 10;

export type SharePasswordResult = "ok" | "wrong" | "locked" | "not_required";

/**
 * Verifie le mot de passe d'un lien de partage et journalise la tentative
 * (`app.record_share_link_password_attempt`, meme fonction `security
 * definer` que `resolve_share_link` — l'anon n'a pas d'acces RLS en
 * ecriture a `share_links`). Ne fait jamais confiance a un `resolved` deja
 * en main : re-resout le jeton pour lire le compteur de tentatives a jour,
 * au cas ou plusieurs essais arrivent en parallele.
 */
export async function verifyShareLinkPassword(token: string, password: string): Promise<SharePasswordResult> {
  const resolved = await resolveShareLink(token);
  if (!resolved) return "wrong";
  if (!resolved.passwordHash) return "not_required";
  if (resolved.passwordAttempts >= MAX_PASSWORD_ATTEMPTS) return "locked";

  const success = verifySharePassword(password, resolved.passwordHash);

  const supabase = createAnonClient();
  const { error } = await supabase.rpc("record_share_link_password_attempt", { p_token: token, p_success: success });
  if (error) throw new Error(error.message);

  return success ? "ok" : "wrong";
}

/**
 * Les entites elles-memes ne portent pas de visibilite propre (SCHEMA.md
 * §5) — seuls leurs blocs/segments en portent une. Un visiteur anonyme
 * voit donc la meme liste de noms qu'un membre du monde sans droit
 * particulier ; rien de nouveau introduit par le partage, meme
 * comportement que l'existant pour un world_role="viewer".
 *
 * `worldId` doit deja venir d'un `resolveShareLink` reussi — cette
 * fonction ne revalide rien elle-meme, elle fait confiance a l'appelant
 * (les deux pages publiques, qui appellent toujours resolveShareLink
 * d'abord). Ne jamais l'exposer sur un chemin qui accepte un world_id
 * venu directement d'un visiteur sans validation prealable.
 */
export async function listPublicEntities(worldId: string): Promise<EntitySummary[]> {
  const supabase = createShareLinkServiceClient();
  return listEntitiesForWorld(supabase, worldId);
}

/**
 * Sommaire hiérarchique pour la peau « livre » (V2-G2) : même arborescence
 * que la barre latérale d'édition (`getEntityTree`,
 * `src/server/services/entities.ts`), même fonction pure `buildEntityTree`
 * — seule la source des lignes change (client `service_role`, jamais de
 * session necessaire, comme `listPublicEntities` ci-dessus).
 */
export async function getPublicEntityTree(worldId: string): Promise<EntityTreeGroup[]> {
  const supabase = createShareLinkServiceClient();
  const [entities, partOfEdges] = await Promise.all([
    listEntitiesForWorld(supabase, worldId),
    listPartOfRelationsForWorld(supabase, worldId),
  ]);
  return buildEntityTree(entities, partOfEdges);
}

/**
 * Nom de la campagne du monde, affiché dans la peau « livre » à la place du
 * nom du monde (retour utilisateur) — « un monde = une campagne » (décision
 * produit, migration 20260826100001), donc au plus une ligne non supprimée.
 * `null` si le monde n'a pas encore de campagne (fiche appelante retombe
 * alors sur le nom du monde).
 */
export async function getPublicCampaignName(worldId: string): Promise<string | null> {
  const supabase = createShareLinkServiceClient();
  const campaigns = await listCampaignsForWorld(supabase, worldId);
  return campaigns[0]?.name ?? null;
}

/**
 * Message d'accueil personnalise (V2-G2, extension) : `null` si la personne
 * n'a rien saisi — l'appelant retombe alors sur un message calcule (nom de
 * la campagne), jamais stocke tant qu'il n'est pas personnalise.
 */
export async function getPublicWikiWelcomeMessage(worldId: string): Promise<string | null> {
  const supabase = createShareLinkServiceClient();
  const world = await getWorldById(supabase, worldId);
  return world?.wiki_welcome_message ?? null;
}

export interface PublicBlock {
  id: string;
  blockType: string;
  display: BlockDisplay;
  data: Json;
  displayOrder: number;
}

function filterTextBlockSegments(blockType: string, data: Json): Json {
  if (blockType !== "text") return data;
  const parsed = zTextBlockData.safeParse(data);
  if (!parsed.success) return data;
  // Segment.visibility n'a pas de createdBy (aucun segment ne le suit
  // aujourd'hui) : "private" ne peut donc jamais se resoudre a vrai pour
  // personne, deja le cas avant ce ticket — pas une regression introduite
  // ici, juste la premiere fois que filterSegments s'execute pour de vrai.
  const aware = parsed.data.segments.map((segment) => ({
    ...segment,
    visibility: { ...segment.visibility, createdBy: null },
  }));
  const segments = filterSegments(aware, { kind: "anonymous" }).map(({ visibility, ...rest }) => ({
    ...rest,
    visibility: { level: visibility.level, scopeId: visibility.scopeId },
  }));
  return { ...parsed.data, segments } as unknown as Json;
}

function toVisibilityAware(row: BlockRow) {
  return {
    ...row,
    visibility: {
      level: row.visibility_level as VisibilityLevel,
      scopeId: row.visibility_scope_id,
      createdBy: row.created_by,
    },
  };
}

/**
 * Entite + blocs filtres pour un visiteur anonyme (Viewer={kind:"anonymous"},
 * src/core/visibility) : la meme fonction pure canSee que pour tout autre
 * lecteur, jamais reimplementee en SQL — un seul endroit ou une visibilite
 * peut fuir, deja teste exhaustivement (voir aussi le test d'integration
 * publicShare.integration.test.ts, V1 D-01).
 *
 * Meme remarque que listPublicEntities : `worldId` doit deja venir d'un
 * `resolveShareLink` reussi.
 */
export async function getPublicEntityDetail(
  worldId: string,
  entitySlug: string,
): Promise<{ entity: EntitySummary; blocks: PublicBlock[] } | null> {
  const supabase = createShareLinkServiceClient();
  const entity = await getEntityBySlug(supabase, worldId, entitySlug);
  if (!entity) return null;

  const rows = await listBlocksForEntity(supabase, entity.id);
  const visible = filterBlocks(rows.map(toVisibilityAware), { kind: "anonymous" });
  const blocks: PublicBlock[] = visible
    .map((row) => ({
      id: row.id,
      blockType: row.block_type,
      display: row.display as unknown as BlockDisplay,
      // Un bloc `text` peut lui-meme etre public tout en contenant un
      // segment gm (SCHEMA.md §7.1, exemple Bram) : la visibilite du bloc
      // ne suffit pas, chaque segment est filtre a son tour avant de
      // jamais quitter le serveur.
      data: filterTextBlockSegments(row.block_type, row.data),
      displayOrder: row.display_order,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return { entity, blocks };
}
