import type { RuleEntryBlockView, RuleRefView } from "@/src/server/services/rules";
import { renderBlockData } from "./blockContentRenderer";
import ModifiedBlockBadge from "./ModifiedBlockBadge";
import BriquesLecture, { BLOCS_BRIQUES } from "./BriquesLecture";

export default function RuleBlockRenderer({
  block,
  worldSlug,
  outgoingRefs,
  sansBascule,
}: {
  block: RuleEntryBlockView;
  worldSlug: string;
  outgoingRefs: RuleRefView[];
  /** Coquille joueur : pas de bascule Officiel / Ta variante (V3.1-94). */
  sansBascule?: boolean;
}) {
  // V3.1-132 : les briques d'une règle jouable ont leur propre rendu (planche « Fiche terminée »).
  const brique = BLOCS_BRIQUES.find((b) => b === block.blockType);
  const content = brique ? <BriquesLecture blockType={brique} data={block.data} /> : renderBlockData(block.blockType, block.data, worldSlug, outgoingRefs);

  if (block.originalData !== undefined && !sansBascule) {
    return (
      <ModifiedBlockBadge
        label={block.display.label}
        collapsed={block.display.collapsed}
        blockType={block.blockType}
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
