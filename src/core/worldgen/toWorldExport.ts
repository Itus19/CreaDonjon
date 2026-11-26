import { WORLD_EXPORT_FORMAT_VERSION, type WorldExport } from "../schemas/worldExport";
import { defaultBlockDisplay } from "../schemas/blocks/registry";
import type { TimelineBlockData } from "../schemas/blocks/timeline";
import { WORLD_TIMELINE_ENTITY_NAME, WORLD_TIMELINE_KIND } from "../timeline/worldTimeline";
import type { AbstractWorld } from "./world";
import type { Chronicle } from "./history/simulate";
import { chronicleToTimelineEntries } from "./history/timeline";

/**
 * G-7b (ADR 0109) — un monde abstrait mis au format d'export de monde
 * (V2-G1), pour que l'import existant le crée sans route nouvelle :
 *
 * - une **faction** par État ;
 * - une page de **lieu** par ville, avec son bloc Ville (G-3), rangée sous son
 *   État par une relation `part_of` ;
 * - la **chronique**, si on la donne, dans la frise du monde (ADR 0048).
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

  const entities: WorldExport["entities"] = [
    ...world.states.map((s) => ({ ref: stateRef(s.id), entityKind: "faction", name: s.name, aliases: [], currentRevisionNumber: null })),
    ...world.sites.map((s) => ({ ref: siteRef(s.id), entityKind: "location", name: s.name, aliases: [], currentRevisionNumber: null })),
  ];

  const blocks: WorldExport["blocks"] = world.sites.map((s) => ({
    entityRef: siteRef(s.id),
    blockType: "settlement" as const,
    display: defaultBlockDisplay("settlement", "Ville"),
    data: s.settlement,
    displayOrder: 0,
    visibilityLevel: "gm" as const,
  }));

  const relations: WorldExport["relations"] = world.sites.flatMap((s) =>
    s.stateId === null ? [] : [{ sourceRef: siteRef(s.id), targetRef: stateRef(s.stateId), relationType: "part_of" as const, visibilityLevel: "gm" as const }]
  );

  if (options.chronicle) {
    const ref = "world_timeline";
    entities.push({ ref, entityKind: WORLD_TIMELINE_KIND, name: WORLD_TIMELINE_ENTITY_NAME, aliases: [], currentRevisionNumber: null });
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
