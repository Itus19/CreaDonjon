import { createElement } from "react";
import type { Segment, SegmentContentNode } from "@/src/core/schemas/entities/segments";
import type { TextBlockData } from "@/src/core/schemas/blocks/text";
import type { InfoboxBlockData } from "@/src/core/schemas/blocks/infobox";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import type { CustomTableBlockData } from "@/src/core/schemas/blocks/customTable";
import type { PublicBlock } from "@/src/server/services/publicShare";
import SpoilerSpan from "./SpoilerSpan";

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
          { key: segment.id },
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

function PublicImageBlock({ data }: { data: ImageBlockData }) {
  if (!data.url) return null;
  return (
    <figure className="flex flex-col gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.url} alt={data.caption} className="max-h-96 w-auto rounded-md object-cover" />
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

/**
 * Rendu dedie a la page publique de partage — pas les editeurs
 * (components/blocks/*BlockEditor.tsx) : aucun champ, aucun bouton, aucun
 * appel d'ecriture possible. Garantit qu'un visiteur anonyme ne peut
 * jamais declencher une mutation, meme par accident.
 */
export default function PublicBlockView({ block }: { block: PublicBlock }) {
  return (
    <div className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0">
      <h3 className="block-title mb-2">{block.display.label}</h3>
      {block.blockType === "text" && <PublicTextBlock data={block.data as unknown as TextBlockData} />}
      {block.blockType === "infobox" && <PublicInfoboxBlock data={block.data as unknown as InfoboxBlockData} />}
      {block.blockType === "image" && <PublicImageBlock data={block.data as unknown as ImageBlockData} />}
      {block.blockType === "custom_table" && (
        <PublicCustomTableBlock data={block.data as unknown as CustomTableBlockData} />
      )}
    </div>
  );
}
