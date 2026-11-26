import { WORLD_EXPORT_FORMAT_VERSION, type WorldExport } from "../schemas/worldExport";
import { defaultBlockDisplay } from "../schemas/blocks/registry";
import type { TimelineBlockData } from "../schemas/blocks/timeline";
import type { GeneratedWorldBlockData } from "../schemas/blocks/generatedWorld";
import { WORLD_TIMELINE_ENTITY_NAME, WORLD_TIMELINE_KIND } from "../timeline/worldTimeline";
import type { AbstractWorld } from "./world";
import type { Chronicle } from "./history/simulate";
import { chronicleToTimelineEntries } from "./history/timeline";

/**
 * G-7b (ADR 0109) — un monde abstrait mis au format d'export de monde
 * (V2-G1), pour que l'import existant le crée sans route nouvelle :
 *
 * - une **faction** par État ;
 * - une page de **lieu** par ville **notable** seulement, avec son bloc Ville
 *   (G-3), rangée sous son État par une relation `part_of` ; les autres
 *   naissent à la découverte (choix de l'auteur, 26 novembre 2026) ;
 * - sur la fiche de la frise du monde (ADR 0048) : la **carte entière**
 *   (bloc `generated_world`, qui dit quelles villes ont déjà leur page) et la
 *   **chronique**, si on la donne.
 *
 * Tout ce qui vient de la génération est réservé au MJ : la toile de fond se
 * découvre (ADR 0104 §3), elle ne s'affiche pas d'office. Le fichier ne
 * dépend d'aucune carte précise : il lit le monde abstrait, que l'import
 * Azgaar remplit ou qu'on écrit à la main.
 */
export function worldToExport(world: AbstractWorld, options: { name: string; chronicle: Chronicle | null }): WorldExport {
  const name = options.name.trim();
  if (name.length === 0) throw new RangeError("Le nom du monde est requis.");

  const stateRef = (id: string) => `state:${id}`;
  const siteRef = (id: string) => `site:${id}`;

  const notables = world.sites.filter((s) => s.notable);
  const timelineRef = "world_timeline";

  const entities: WorldExport["entities"] = [
    ...world.states.map((s) => ({ ref: stateRef(s.id), entityKind: "faction", name: s.name, aliases: [], currentRevisionNumber: null })),
    ...notables.map((s) => ({ ref: siteRef(s.id), entityKind: "location", name: s.name, aliases: [], currentRevisionNumber: null })),
    { ref: timelineRef, entityKind: WORLD_TIMELINE_KIND, name: WORLD_TIMELINE_ENTITY_NAME, aliases: [], currentRevisionNumber: null },
  ];

  const blocks: WorldExport["blocks"] = notables.map((s) => ({
    entityRef: siteRef(s.id),
    blockType: "settlement" as const,
    display: defaultBlockDisplay("settlement", "Ville"),
    data: { ...s.settlement, siteId: s.id },
    displayOrder: 0,
    visibilityLevel: "gm" as const,
  }));

  // Les références `{ kind: "entity", id: <ref> }` sont recalées par l'import (`remapEntityIds`).
  const generated: GeneratedWorldBlockData = {
    __v: 1,
    world,
    places: notables.map((s) => ({ siteId: s.id, entity: { kind: "entity", id: siteRef(s.id) } })),
    factions: world.states.map((s) => ({ stateId: s.id, entity: { kind: "entity", id: stateRef(s.id) } })),
  };
  blocks.push({
    entityRef: timelineRef,
    blockType: "generated_world",
    display: defaultBlockDisplay("generated_world", "Monde généré"),
    data: generated,
    displayOrder: 1,
    visibilityLevel: "gm",
  });

  const relations: WorldExport["relations"] = notables.flatMap((s) =>
    s.stateId === null ? [] : [{ sourceRef: siteRef(s.id), targetRef: stateRef(s.stateId), relationType: "part_of" as const, visibilityLevel: "gm" as const }]
  );

  if (options.chronicle) {
    const ref = timelineRef;
    const data: TimelineBlockData = { __v: 1, entries: chronicleToTimelineEntries(options.chronicle, world), groupBy: "none" };
    // Comme la frise créée à la main (services/timeline.ts) : bloc public sur
    // une fiche que seul le MJ lit, chaque entrée portant sa propre visibilité.
    blocks.push({ entityRef: ref, blockType: "timeline", display: defaultBlockDisplay("timeline", "Chronologie"), data, displayOrder: 0, visibilityLevel: "public" });
  }

  return {
    formatVersion: WORLD_EXPORT_FORMAT_VERSION,
    world: { name, calendar: {} },
    ruleset: { kind: "official", baseSystem: "dnd_srd_52" },
    suggestedMode: "solo",
    entities,
    blocks,
    relations,
    mechanicalRevisions: [],
  };
}
