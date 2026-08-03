import type { RuleEntryBlockView, RuleRefView } from "@/src/server/services/rules";
import { renderBlockData } from "./blockContentRenderer";
import ModifiedBlockBadge from "./ModifiedBlockBadge";

export default function RuleBlockRenderer({
  block,
  worldSlug,
  outgoingRefs,
}: {
  block: RuleEntryBlockView;
  worldSlug: string;
  outgoingRefs: RuleRefView[];
}) {
  const content = renderBlockData(block.blockType, block.data, worldSlug, outgoingRefs);

  if (block.originalData !== undefined) {
    return (
      <ModifiedBlockBadge
        label={block.display.label}
        collapsed={block.display.collapsed}
        blockType={block.blockType}
        currentData={block.data}
        originalData={block.originalData}
        worldSlug={worldSlug}
      >
        {content}
      </ModifiedBlockBadge>
    );
  }

  if (block.display.collapsed) {
    return (
      <details className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0">
        <summary className="block-title mb-2 cursor-pointer">{block.display.label}</summary>
        {content}
      </details>
    );
  }
  return (
    <div className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0">
      <h3 className="block-title mb-2">{block.display.label}</h3>
      {content}
    </div>
  );
}
