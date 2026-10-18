import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { filterSegments } from "@/src/core/visibility";
import { premierePhrase } from "@/src/core/entities/premierePhrase";
import type { ChooseStart } from "@/src/core/campaigns/claimable";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { listEntityIdsWithPortrait } from "@/src/server/repos/entityPortraits";
import { listClaimableCharacters } from "@/src/server/services/campaigns";
import { filtrerBlocsVisibles } from "@/src/server/services/blocks";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { libellesIdentite, type IdentitePersonnage } from "@/src/server/services/worldPlayerCharacters";

type TypedClient = SupabaseClient<Database>;

/** Une carte du carrousel « Choisis ton personnage ». Rien n'est stocké : tout est lu et calculé à la demande (règle 16). */
export interface CartePersonnage {
  entityId: string;
  entityName: string;
  /** La route du portrait (elle signe l'URL et applique la RLS), ou `null` sans portrait. */
  portraitUrl: string | null;
  /** La première phrase du premier texte que la joueuse peut voir, ou `null`. */
  phrase: string | null;
  /** `null` : la fiche n'a pas (ou pas de visible) bloc `character` — `hasSheet: false` du ticket. */
  identite: IdentitePersonnage | null;
}

export interface ChoixPersonnage {
  cartes: CartePersonnage[];
  startOn: ChooseStart;
}

/**
 * V3.1-82 — les PJ réclamables (`listClaimableCharacters`, V3.1-100 : qui,
 * et sur quelle carte s'ouvrir), enrichis pour le carrousel : portrait,
 * phrase, espèce · classes · niveau. Tout se lit PAR LOT, une requête par
 * nature de donnée et jamais une par PJ (docs/CABLAGE.md, C4). Seul ce que
 * la joueuse peut voir sort d'ici (règle 5) : les blocs passent le filtre de
 * visibilité de la fiche, et les segments d'un texte le leur.
 */
export async function listCartesPersonnage(
  supabase: TypedClient,
  params: { campaignId: string; rulesetId: string; worldId: string; userId: string; locale: Locale }
): Promise<ChoixPersonnage> {
  const { characters, startOn } = await listClaimableCharacters(supabase, params.campaignId);
  if (characters.length === 0) return { cartes: [], startOn };

  const entityIds = characters.map((c) => c.entityId);
  const [blocs, avecPortrait, viewer] = await Promise.all([
    listBlocksByTypesForEntities(supabase, entityIds, ["character", "text"]),
    listEntityIdsWithPortrait(supabase, entityIds),
    buildViewerForWorld(supabase, params.worldId, params.userId),
  ]);
  const visibles = filtrerBlocsVisibles(blocs, viewer);

  const personnageParFiche = new Map<string, CharacterBlockData>();
  const phraseParFiche = new Map<string, string>();
  // Le premier texte d'une fiche est celui que la fiche affiche en premier.
  const textes = visibles.filter((b) => b.block_type === "text").sort((a, b) => a.display_order - b.display_order);
  for (const bloc of visibles) {
    if (bloc.block_type === "character" && !personnageParFiche.has(bloc.entity_id)) {
      personnageParFiche.set(bloc.entity_id, bloc.data as unknown as CharacterBlockData);
    }
  }
  for (const bloc of textes) {
    if (phraseParFiche.has(bloc.entity_id)) continue;
    const parsed = zTextBlockData.safeParse(bloc.data);
    if (!parsed.success) continue;
    const aware = parsed.data.segments.map((segment) => ({ ...segment, visibility: { ...segment.visibility, createdBy: null } }));
    const phrase = premierePhrase(filterSegments(aware, viewer));
    if (phrase) phraseParFiche.set(bloc.entity_id, phrase);
  }

  const identites = await libellesIdentite(
    supabase,
    entityIds.map((entityId) => ({ entityId, rulesetId: params.rulesetId, character: personnageParFiche.get(entityId) })),
    params.locale
  );

  return {
    cartes: characters.map(({ entityId, entityName }) => ({
      entityId,
      entityName,
      portraitUrl: avecPortrait.has(entityId) ? `/api/entities/${entityId}/portrait` : null,
      phrase: phraseParFiche.get(entityId) ?? null,
      identite: identites.get(entityId) ?? null,
    })),
    startOn,
  };
}
