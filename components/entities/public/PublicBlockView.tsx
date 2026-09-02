import { createElement } from "react";
import Link from "next/link";
import type { Segment, SegmentContentNode } from "@/src/core/schemas/entities/segments";
import type { TextBlockData } from "@/src/core/schemas/blocks/text";
import type { InfoboxBlockData } from "@/src/core/schemas/blocks/infobox";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import type { CustomTableBlockData } from "@/src/core/schemas/blocks/customTable";
import type { QuestBlockData, QuestNote, QuestObjective } from "@/src/core/schemas/blocks/quest";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { PublicBlock } from "@/src/server/services/publicShare";
import { QUEST_STATE_LABELS_FR } from "@/src/i18n/fr";
import type { PersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import type { WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import type { TimelineBlockData } from "@/src/core/schemas/blocks/timeline";
import type { MapBlockData } from "@/src/core/schemas/blocks/map";
import SpoilerSpan from "./SpoilerSpan";
import PublicGenealogyBlock from "./PublicGenealogyBlock";
import PublicPersonalityBlock from "./PublicPersonalityBlock";
import PublicWorldviewBlock from "./PublicWorldviewBlock";
import PublicRelationshipBlock from "./PublicRelationshipBlock";
import PublicRelationsGraphBlock from "./PublicRelationsGraphBlock";
import PublicTimelineBlock from "./PublicTimelineBlock";
import PublicMapBlock from "./PublicMapBlock";

const TAG_BY_BLOCK_TYPE: Record<Segment["blockType"], string> = {
  paragraph: "p",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
};

function renderNode(node: SegmentContentNode, key: number) {
  if (node.t === "ref") {
    return (
      <span key={key} className="rich-ref-mention">
        {node.label}
      </span>
    );
  }
  const marks = node.marks ?? [];
  let content: React.ReactNode = node.v;
  if (marks.includes("strike")) content = <s>{content}</s>;
  if (marks.includes("underline")) content = <u>{content}</u>;
  if (marks.includes("italic")) content = <em>{content}</em>;
  if (marks.includes("bold")) content = <strong>{content}</strong>;
  if (marks.includes("spoiler")) content = <SpoilerSpan>{content}</SpoilerSpan>;
  return <span key={key}>{content}</span>;
}

function PublicTextBlock({ data }: { data: TextBlockData }) {
  return (
    <div className="rich-text-content">
      {data.segments.map((segment) => {
        const tag = TAG_BY_BLOCK_TYPE[segment.blockType] ?? "p";
        return createElement(
          tag,
          { key: segment.id, "data-align": segment.align },
          segment.content.map((node, i) => renderNode(node, i)),
        );
      })}
    </div>
  );
}

function PublicInfoboxBlock({ data }: { data: InfoboxBlockData }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {data.entries.map((entry, i) => (
        <div key={i} className="contents">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Largeur de reference a 100% (V2-G12) — meme mecanique que le portrait (`PortraitUpload.tsx`/`PublicPortrait.tsx`), une autre reference car une image de bloc peut occuper toute la colonne de prose (`max-w-[70ch]`), pas juste une case de cote. */
const BASE_IMAGE_WIDTH_PX = 480;

export function PublicImageBlock({ data }: { data: ImageBlockData }) {
  if (!data.url) return null;
  const widthPx = (BASE_IMAGE_WIDTH_PX * data.sizePct) / 100;
  const wrapping = data.wrapMode === "wrap";
  return (
    <figure
      className={`flex flex-col gap-1.5 ${
        wrapping
          ? `${data.align === "left" ? "float-left mr-4" : "float-right ml-4"} mb-3`
          : data.align === "left"
            ? "items-start"
            : data.align === "right"
              ? "items-end ml-auto"
              : "items-center mx-auto"
      }`}
      style={{ width: `${widthPx}px`, maxWidth: "100%" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.url} alt={data.caption} className="w-full rounded-md object-cover" />
      {data.caption && <figcaption className="text-xs italic text-ink-muted">{data.caption}</figcaption>}
    </figure>
  );
}

function PublicCustomTableBlock({ data }: { data: CustomTableBlockData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-edge/60">
            {data.columns.map((col) => (
              <th key={col} className="py-1 pr-4 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-b border-edge/30">
              {data.columns.map((col) => (
                <td key={col} className="py-1 pr-4">
                  {typeof row[col] === "string" || typeof row[col] === "number" ? String(row[col]) : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function questRefLink(
  ref: BlockReference | null | undefined,
  questRefs: Record<string, { name: string; slug: string }> | undefined,
  hrefBase: string
) {
  if (!ref || ref.kind !== "entity") return null;
  const found = questRefs?.[ref.id];
  if (!found) return null;
  return (
    <Link href={`${hrefBase}/${found.slug}`} className="rich-ref-mention">
      {found.name}
    </Link>
  );
}

function PublicQuestBlock({
  data,
  questRefs,
  hrefBase,
}: {
  data: QuestBlockData;
  questRefs: Record<string, { name: string; slug: string }> | undefined;
  hrefBase: string;
}) {
  function noteList(items: QuestNote[], label: string) {
    if (items.length === 0) return null;
    return (
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {items.map((item) => (
            <li key={item.id}>
              {item.text} {questRefLink(item.ref, questRefs, hrefBase)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="rounded-full border border-edge px-2 py-0.5">{QUEST_STATE_LABELS_FR[data.state] ?? data.state}</span>
        {questRefLink(data.giver, questRefs, hrefBase) && <span>Commanditaire : {questRefLink(data.giver, questRefs, hrefBase)}</span>}
      </div>
      {data.objectives.length > 0 && (
        <ul className="flex flex-col gap-1">
          {data.objectives.map((objective: QuestObjective) => (
            <li key={objective.id} className={`flex items-start gap-2 ${objective.done ? "text-ink-muted line-through" : ""}`}>
              <span aria-hidden>{objective.done ? "☑" : "☐"}</span>
              <span>
                {objective.text} {questRefLink(objective.ref, questRefs, hrefBase)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {noteList(data.rewards, "Récompenses")}
      {noteList(data.prerequisites, "Prérequis")}
    </div>
  );
}

/**
 * Rendu dedie a la page publique de partage — pas les editeurs
 * (components/blocks/*BlockEditor.tsx) : aucun champ, aucun bouton, aucun
 * appel d'ecriture possible. Garantit qu'un visiteur anonyme ne peut
 * jamais declencher une mutation, meme par accident.
 */
export default function PublicBlockView({ block, hrefBase }: { block: PublicBlock; hrefBase: string }) {
  // Retour utilisateur (V2-G13) : une image active comme fond de page est
  // deja rendue par WikiBackgroundProvider (position fixed, plein ecran) —
  // la rendre en plus a sa place dans le corps de la fiche la dupliquerait
  // ("en fond" ET "au fond de la page"). Elle ne s'affiche plus qu'en fond.
  if (block.blockType === "image" && (block.data as unknown as ImageBlockData).useAsWikiBackground) {
    return null;
  }
  return (
    <div className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0">
      {/* Retour utilisateur : le titre du bloc (souvent juste "Image") est
          redondant avec l'image/la legende elle-meme sur le wiki public —
          jamais affiche pour ce type, contrairement a l'editeur ou il
          reste utile pour s'y retrouver parmi plusieurs blocs. */}
      {block.blockType !== "image" && <h3 className="block-title mb-2">{block.display.label}</h3>}
      {block.blockType === "text" && <PublicTextBlock data={block.data as unknown as TextBlockData} />}
      {block.blockType === "infobox" && <PublicInfoboxBlock data={block.data as unknown as InfoboxBlockData} />}
      {block.blockType === "image" && <PublicImageBlock data={block.data as unknown as ImageBlockData} />}
      {block.blockType === "genealogy" && block.genealogyTree && (
        <PublicGenealogyBlock tree={block.genealogyTree} hrefBase={hrefBase} />
      )}
      {block.blockType === "custom_table" && (
        <PublicCustomTableBlock data={block.data as unknown as CustomTableBlockData} />
      )}
      {block.blockType === "quest" && (
        <PublicQuestBlock data={block.data as unknown as QuestBlockData} questRefs={block.questRefs} hrefBase={hrefBase} />
      )}
      {block.blockType === "personality" && (
        <PublicPersonalityBlock
          data={block.data as unknown as PersonalityBlockData}
          events={block.personalityEvents ?? []}
          calendar={block.timelineCalendar ?? null}
        />
      )}
      {block.blockType === "worldview" && (
        <PublicWorldviewBlock
          data={block.data as unknown as WorldviewBlockData}
          events={block.personalityEvents ?? []}
          calendar={block.timelineCalendar ?? null}
        />
      )}
      {block.blockType === "relationship" && (
        <PublicRelationshipBlock
          axes={block.relationshipAxes ?? {}}
          target={block.relationshipTarget ?? null}
          hrefBase={hrefBase}
          events={block.relationshipEvents ?? []}
          calendar={block.timelineCalendar ?? null}
        />
      )}
      {block.blockType === "relations_graph" && block.relationsGraph && (
        <PublicRelationsGraphBlock graph={block.relationsGraph} hrefBase={hrefBase} />
      )}
      {block.blockType === "timeline" && block.timelineCalendar && (
        <PublicTimelineBlock
          data={block.data as unknown as TimelineBlockData}
          calendar={block.timelineCalendar}
          refs={block.timelineRefs ?? {}}
          hrefBase={hrefBase}
        />
      )}
      {block.blockType === "map" && (
        <PublicMapBlock
          data={block.data as unknown as MapBlockData}
          mapSource={block.mapSource}
          mapPins={block.mapPins}
          mapRegions={block.mapRegions}
          hrefBase={hrefBase}
        />
      )}
    </div>
  );
}
