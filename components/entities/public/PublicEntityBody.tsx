import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import type { EntitySummary } from "@/src/server/repos/entities";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import type { PublicBlock, PublicRelation } from "@/src/server/services/publicShare";
import PublicBlockView from "./PublicBlockView";
import PublicPortrait from "./PublicPortrait";
import PublicRelations from "./PublicRelations";

/**
 * Corps d'une fiche sur le wiki public (V2-G11/V2-G12) — partage par
 * `/partage/[token]/[entitySlug]` et `/m/[worldSlug]/apercu/[entitySlug]`,
 * qui ne different que par le bandeau de previsualisation ajoute autour.
 *
 * Deux mecanismes de contournement de texte independants, jamais en
 * cascade sur plus d'un bloc (retour utilisateur) :
 * - le portrait flotte, le premier bloc (s'il s'agit de texte) s'ecoule
 *   autour, apres les alias/relations ;
 * - un bloc `image` en "retour a la ligne" flotte, SEUL le bloc qui le
 *   suit immediatement s'ecoule autour — jamais les blocs suivants.
 */
export default function PublicEntityBody({
  entity,
  blocks,
  relations,
  portraitLayout,
  hrefBase,
}: {
  entity: EntitySummary;
  blocks: PublicBlock[];
  relations: PublicRelation[];
  portraitLayout: EntityPortraitLayout;
  hrefBase: string;
}) {
  const [firstBlock, ...afterFirst] = blocks;
  const firstBlockWraps = firstBlock?.blockType === "text";
  const restBlocks = firstBlockWraps ? afterFirst : blocks;

  return (
    <>
      {/* `flow-root` : contient le flottement du portrait a l'interieur de
          ce seul conteneur, sans affecter les blocs suivants ni depasser
          si le texte encadre est court. */}
      <div className="flow-root">
        <PublicPortrait entityId={entity.id} layout={portraitLayout} />
        <div className="flex items-start justify-between gap-3">
          <h1 className="entity-title flex-1">{entity.name || "(sans nom)"}</h1>
          <span className="shrink-0 whitespace-nowrap text-sm font-medium text-ink-muted">
            {ENTITY_KIND_LABELS[entity.entity_kind as keyof typeof ENTITY_KIND_LABELS] ?? entity.entity_kind}
          </span>
        </div>
        {entity.aliases.length > 0 && (
          <p className="mt-1 text-xs text-ink-muted">Alias : {entity.aliases.join(", ")}</p>
        )}
        <PublicRelations relations={relations} hrefBase={hrefBase} />
        {firstBlockWraps && <PublicBlockView block={firstBlock} />}
      </div>

      {blocks.length === 0 && <p className="mt-4 text-sm text-ink-muted">Aucun contenu public pour cette fiche.</p>}
      {restBlocks.length > 0 && <div className="mt-4 flex flex-col">{renderWrappedBlocks(restBlocks)}</div>}
    </>
  );
}

function renderWrappedBlocks(blocks: PublicBlock[]) {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    const isWrappingImage = block.blockType === "image" && (block.data as unknown as ImageBlockData).wrapMode === "wrap";
    const next = blocks[i + 1];
    if (isWrappingImage) {
      nodes.push(
        <div key={block.id} className="flow-root">
          <PublicBlockView block={block} />
          {next && <PublicBlockView block={next} />}
        </div>
      );
      i += next ? 2 : 1;
    } else {
      nodes.push(<PublicBlockView key={block.id} block={block} />);
      i += 1;
    }
  }
  return nodes;
}
