import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import type { EntitySummary } from "@/src/server/repos/entities";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import type { SessionJournalMetaBlockData } from "@/src/core/schemas/blocks/sessionJournalMeta";
import type { PublicBlock, PublicRelation } from "@/src/server/services/publicShare";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import PublicBlockView from "./PublicBlockView";
import PublicPortrait from "./PublicPortrait";
import PublicRelations from "./PublicRelations";
import MentionedIn from "@/components/entities/MentionedIn";

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
  ruleHrefBase,
}: {
  entity: EntitySummary;
  blocks: PublicBlock[];
  relations: PublicRelation[];
  portraitLayout: EntityPortraitLayout;
  hrefBase: string;
  /** V2.1-1 : voir `PublicBlockView` — absent sur le partage anonyme. */
  ruleHrefBase?: string;
}) {
  // Le bloc `session_journal_meta` (V2.1-3 suite) ne fait pas partie du
  // recit : jamais dans le fil normal des blocs, toujours extrait pour
  // finir en pied de page (retour utilisateur, voir SessionJournalFooter).
  const metaBlock = blocks.find((b) => b.blockType === "session_journal_meta");
  const contentBlocks = blocks.filter((b) => b.blockType !== "session_journal_meta");
  const isJournalEntry = entity.entity_kind === "session_journal";

  const [firstBlock, ...afterFirst] = contentBlocks;
  const firstBlockWraps = firstBlock?.blockType === "text";
  const restBlocks = firstBlockWraps ? afterFirst : contentBlocks;

  return (
    <div className={isJournalEntry ? "journal-entry" : undefined}>
      {/* `flow-root` : contient le flottement du portrait a l'interieur de
          ce seul conteneur, sans affecter les blocs suivants ni depasser
          si le texte encadre est court. */}
      <div className="flow-root">
        <PublicPortrait entityId={entity.id} layout={portraitLayout} />
        <div className="flex items-start justify-between gap-3">
          <h1 className="entity-title flex-1">{entity.name || "(sans nom)"}</h1>
          {!isJournalEntry && (
            <span className="shrink-0 whitespace-nowrap text-sm font-medium text-ink-muted">
              {ENTITY_KIND_LABELS[entity.entity_kind as keyof typeof ENTITY_KIND_LABELS] ?? entity.entity_kind}
            </span>
          )}
        </div>
        {entity.aliases.length > 0 && (
          <p className="mt-1 text-xs text-ink-muted">Alias : {entity.aliases.join(", ")}</p>
        )}
        {!isJournalEntry && <PublicRelations relations={relations} hrefBase={hrefBase} />}
        <MentionedIn entityId={entity.id} hrefBase={hrefBase} />
        {firstBlockWraps && <PublicBlockView block={firstBlock} hrefBase={hrefBase} ruleHrefBase={ruleHrefBase} />}
      </div>

      {contentBlocks.length === 0 && <p className="mt-4 text-sm text-ink-muted">Aucun contenu public pour cette fiche.</p>}
      {restBlocks.length > 0 && (
        <div className="mt-4 flex flex-col">{renderWrappedBlocks(restBlocks, hrefBase, ruleHrefBase)}</div>
      )}
      {metaBlock && <SessionJournalFooter block={metaBlock} />}
    </div>
  );
}

/**
 * Pied de page du Journal de session (retour utilisateur V2.1-3 suite) :
 * les 4 champs fixes du bloc `session_journal_meta`, tout au fond de la
 * page, en petit, sur une seule ligne, sans le titre du bloc — jamais
 * rendu par `PublicBlockView` (qui affiche un titre + un bloc a part
 * entiere), un pied de page n'est ni l'un ni l'autre.
 */
function SessionJournalFooter({ block }: { block: PublicBlock }) {
  const data = block.data as unknown as SessionJournalMetaBlockData;
  const calendar = block.timelineCalendar;
  const parts = [
    calendar ? `Date ingame : ${formatGameDate(data.ingameDate, calendar)}` : null,
    data.realSession ? `Session du ${data.realSession.label}` : null,
    data.writtenBy ? `Rédigé par ${data.writtenBy.name}` : null,
    data.writtenAt
      ? `Rédigé le ${new Date(data.writtenAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
      : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return null;
  return <p className="journal-entry-meta">{parts.join(" · ")}</p>;
}

function renderWrappedBlocks(blocks: PublicBlock[], hrefBase: string, ruleHrefBase: string | undefined) {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    const isWrappingImage = block.blockType === "image" && (block.data as unknown as ImageBlockData).wrapMode === "wrap";
    const next = blocks[i + 1];
    if (isWrappingImage) {
      nodes.push(
        <div key={block.id} className="flow-root">
          <PublicBlockView block={block} hrefBase={hrefBase} ruleHrefBase={ruleHrefBase} />
          {next && <PublicBlockView block={next} hrefBase={hrefBase} ruleHrefBase={ruleHrefBase} />}
        </div>
      );
      i += next ? 2 : 1;
    } else {
      nodes.push(<PublicBlockView key={block.id} block={block} hrefBase={hrefBase} ruleHrefBase={ruleHrefBase} />);
      i += 1;
    }
  }
  return nodes;
}
