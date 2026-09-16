import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { filterBlocks, filterSegments, type Viewer } from "@/src/core/visibility";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { excerptFromSegments } from "@/src/core/richtext/excerpt";
import { chipSummaryFromDescription, chipSummaryFromText } from "@/src/core/rules/chipSummary";
import { type BlockRow, listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import {
  listBlocksForRulesetEntries,
  listEntryTranslationsWithBlocks,
} from "@/src/server/repos/rules";
import { entriesFromChainByKeys, entryNameFrom, resolveHomebrewEntryDisplay, walkRulesetChain, type RulesetChainLink } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/**
 * Contenu des cartes d'apercu au survol d'un lien (V2.1-18 lot 2).
 *
 * Ce module est PARTAGE entre le wiki public (`publicShare.ts`, viewer
 * anonyme) et le wiki joueur (`playerEntityDetail.ts`, vrai viewer) — les
 * deux rendent le meme `PublicBlockView`, donc la meme carte. Un module
 * plutot qu'une troisieme copie du filtrage : ces deux fichiers dupliquent
 * deja leurs filtres de visibilite l'un de l'autre
 * (`filterTextBlockSegments` / `filterTextBlockSegmentsForViewer`), et une
 * copie de plus aurait fini par diverger sur le seul point ou elle ne doit
 * jamais diverger.
 *
 * D'ou le `viewer` en parametre, jamais fige : un extrait est un chemin de
 * lecture DE PLUS vers la meme donnee, et c'est precisement le genre
 * d'ajout par lequel une fuite entre.
 */

/** Cible d'un lien d'entite, prete a peindre. */
export interface EntityRefPreview {
  name: string;
  slug: string;
  /** `entity_kind` brut (`character`, `location`...) — le libelle francais se pose a l'affichage (`ENTITY_KIND_LABELS`). */
  kind: string;
  /** Premier paragraphe visible A CE VIEWER, coupe cote serveur. `null` = aucun. */
  excerpt: string | null;
}

/** Cible d'un lien de regle. Jamais construite sans `excerpt` — voir `resolveRuleRefPreviews`. */
export interface RuleRefPreview {
  name: string;
  /** `entry_type` brut (`species`, `monster`...) — libelle par `messages/fr.json`, cle `regles.entryTypes`. */
  entryType: string;
  excerpt: string;
}

/** Meme mise en forme que `toVisibilityAware` chez les deux appelants — recopiee ici pour que ce module ne depende d'aucun des deux. */
function toVisibilityAware(row: BlockRow) {
  return {
    ...row,
    visibility: {
      level: row.visibility_level as Parameters<typeof filterBlocks>[0][number]["visibility"]["level"],
      scopeId: row.visibility_scope_id,
      createdBy: row.created_by,
    },
  };
}

/**
 * Premier paragraphe visible de chaque fiche citee, en UNE requete groupee
 * pour toute la page — jamais une par lien, une entree de Livre de sessions
 * en cite une douzaine.
 *
 * La visibilite se resout deux fois, exactement comme pour le corps de la
 * fiche affichee : au niveau du BLOC puis au niveau du SEGMENT.
 */
export async function resolveEntityRefExcerpts(
  supabase: TypedClient,
  entityIds: string[],
  viewer: Viewer
): Promise<Map<string, string>> {
  const excerpts = new Map<string, string>();
  if (entityIds.length === 0) return excerpts;

  const rows = await listBlocksByTypeForEntities(supabase, entityIds, "text");
  const visible = filterBlocks(rows.map(toVisibilityAware), viewer);

  const byEntity = new Map<string, BlockRow[]>();
  for (const row of visible) {
    const list = byEntity.get(row.entity_id) ?? [];
    list.push(row);
    byEntity.set(row.entity_id, list);
  }

  for (const [entityId, blocks] of byEntity) {
    // `listBlocksByTypeForEntities` n'ordonne pas : le premier paragraphe de
    // la FICHE est celui du bloc le plus haut, pas celui que la base a rendu
    // en premier.
    blocks.sort((a, b) => a.display_order - b.display_order);
    for (const block of blocks) {
      const parsed = zTextBlockData.safeParse(filterSegmentsOf(block.data, viewer));
      if (!parsed.success) continue;
      const excerpt = excerptFromSegments(parsed.data.segments);
      if (excerpt !== null) {
        excerpts.set(entityId, excerpt);
        break;
      }
    }
  }
  return excerpts;
}

/** Filtrage segment a segment, identique a celui du corps de fiche chez les deux appelants. */
function filterSegmentsOf(data: Json, viewer: Viewer): Json {
  const parsed = zTextBlockData.safeParse(data);
  if (!parsed.success) return data;
  const aware = parsed.data.segments.map((segment) => ({ ...segment, visibility: { ...segment.visibility, createdBy: null } }));
  const segments = filterSegments(aware, viewer).map(({ visibility, ...rest }) => ({
    ...rest,
    visibility: { level: visibility.level, scopeId: visibility.scopeId },
  }));
  return { ...parsed.data, segments } as unknown as Json;
}

interface ChaineDeRegles {
  rulesetId: string;
  chain: RulesetChainLink[];
}

/**
 * Le ruleset par defaut du monde et sa chaine, memoises (V2.1-20 lot 5).
 *
 * Exporte pour une raison precise : `getPublicEntityDetail` l'appelle dans sa
 * PREMIERE vague, alors qu'il ne sait pas encore si la fiche cite la moindre
 * regle. Ces deux lectures ne dependent que du monde, jamais des blocs — les
 * laisser attendre la collecte des cles les mettait trois vagues plus loin sur
 * le chemin critique. Quand `resolveRuleRefPreviews` les redemande, elles sont
 * deja resolues et ne coutent rien.
 *
 * Memoise ICI plutot que sur `getWorldDefaultRulesetId` (repos/worlds.ts) :
 * ce depot est appele depuis des chemins d'ecriture (`characterActions`,
 * `rules.ts`, qui posent aussi `setWorldDefaultRuleset`), ou une valeur figee
 * par un appel anterieur serait un bug. `walkRulesetChain`, lui, est deja
 * memoise chez lui.
 *
 * `null` si le monde n'a pas de ruleset par defaut — aucune regle a resoudre,
 * et l'appelant n'a rien a faire de plus.
 */
export const warmRuleChain = cache(async function warmRuleChain(
  supabase: TypedClient,
  worldId: string
): Promise<ChaineDeRegles | null> {
  const rulesetId = await getWorldDefaultRulesetId(supabase, worldId);
  if (!rulesetId) return null;
  return { rulesetId, chain: await walkRulesetChain(supabase, rulesetId) };
});

/**
 * Nom, type et prose de chaque regle citee — meme remontee de chaine que
 * `resolveRuleChips` (`referenceChips.ts`), dont ce resolveur est le jumeau
 * pour le wiki. Deux differences, toutes deux voulues :
 *
 * 1. Aucun `href`. `resolveRuleChips` construit `/m/<monde>/regles/<cle>`,
 *    une route authentifiee : elle n'a rien a faire dans une reponse de
 *    partage anonyme. C'est l'affichage qui decide s'il existe une
 *    destination, pas cette table.
 * 2. Aucun repli sur `ai_digest`. Ce resume est genere a l'import depuis la
 *    source anglaise (SCHEMA.md §9.1) : il reste anglais sous une fiche
 *    entierement traduite. Un chip d'outil MJ s'en accommode, un wiki
 *    francais non — faute de prose, on ne rend rien, ce qui EST la decision
 *    "sans prose, pas de lien" du ticket.
 *
 * Une cle absente du resultat n'a donc pas de carte, et son lien se rend en
 * texte ordinaire.
 */
export async function resolveRuleRefPreviews(
  supabase: TypedClient,
  worldId: string,
  keys: string[],
  locale: Locale
): Promise<Record<string, RuleRefPreview>> {
  const refs: Record<string, RuleRefPreview> = {};
  if (keys.length === 0) return refs;

  const chainState = await warmRuleChain(supabase, worldId);
  if (!chainState) return refs;
  const { rulesetId, chain } = chainState;

  // V2.1-20 lot 5 — UNE requete pour toute la chaine, au lieu d'une par maillon
  // attendant la precedente : sur la chaine de deux maillons mesuree au lot 0,
  // deux vagues sequentielles la ou une suffit, et ca grandit avec la
  // profondeur.
  //
  // `entriesFromChainByKeys` existait deja (V3-R7, meme motif : un audit de
  // performance avait mesure 39 871 lectures unitaires ailleurs). Elle porte la
  // meme priorite de chaine — feuille vers racine, la premiere trouvee gagne,
  // ce qui fait qu'une variante surcharge correctement une base officielle
  // (regle absolue n° 18) — et elle est deja gardee par
  // `rules.chainPriority.integration.test.ts`. Une seconde implementation de la
  // meme regle de priorite aurait fini par diverger sur le seul point ou elle
  // ne doit pas.
  //
  // Son `RulesetEntryRow` n'a pas `ai_digest`, contrairement au type "chip".
  // Aucune importance ici : ce resolveur refuse deliberement ce repli (voir
  // le point 2 ci-dessus).
  const parCle = await entriesFromChainByKeys(supabase, chain, keys);
  const found = [...parCle.values()];
  const remaining = new Set(keys.filter((k) => !parCle.has(k)));

  if (found.length > 0) {
    const entryIds = found.map((e) => e.id);
    const [blockRows, translations] = await Promise.all([
      listBlocksForRulesetEntries(supabase, entryIds),
      locale !== "en" ? listEntryTranslationsWithBlocks(supabase, entryIds, locale) : Promise.resolve([]),
    ]);
    const translationByEntryId = new Map(translations.map((t) => [t.entry_id, t]));
    const baseDescriptionByEntryId = new Map<string, Json>();
    for (const row of blockRows) {
      if (row.block_type === "description") baseDescriptionByEntryId.set(row.entry_id, row.data);
    }

    for (const row of found) {
      const translation = translationByEntryId.get(row.id);
      const translatedBlocks = (translation?.blocks ?? {}) as Record<string, unknown>;
      // Traduction d'abord, prose de base ensuite : une fiche du SRD non
      // traduite garde sa prose anglaise, qui vaut mieux que rien tant
      // qu'elle vient bien de la fiche — contrairement a `ai_digest`.
      const excerpt =
        chipSummaryFromDescription(translatedBlocks.description) ??
        chipSummaryFromDescription(baseDescriptionByEntryId.get(row.id));
      if (excerpt === null) continue;
      refs[row.entry_key] = { name: translation?.name ?? entryNameFrom(row), entryType: row.entry_type, excerpt };
    }
  }

  // Cles restantes : aucune ligne `ruleset_entries` dans la chaine — une
  // fiche maison creee par `add_entry` (V1-D4/V1-D8), donc precisement le
  // cas d'un ruleset `personal_reference`. Sa prose est sa seule source, et
  // c'est la bonne (meme constat que `resolveRuleChips`).
  for (const key of [...remaining]) {
    const homebrew = await resolveHomebrewEntryDisplay(supabase, rulesetId, key);
    if (!homebrew) continue;
    const excerpt = chipSummaryFromText(homebrew.description);
    if (excerpt === null) continue;
    refs[key] = { name: homebrew.name, entryType: homebrew.entryType, excerpt };
  }

  return refs;
}
