import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import type { EntitySummary } from "@/src/server/repos/entities";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import type { SessionJournalMetaBlockData } from "@/src/core/schemas/blocks/sessionJournalMeta";
import { planMusicAttachments } from "@/src/core/music/blockAttachment";
import { planImageAnchors } from "@/src/core/images/blockAnchor";
import type { PublicBlock, PublicRelation } from "@/src/server/services/publicShare";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { weekdayNameForDate } from "@/src/core/calendar/weekday";
import PublicBlockView from "./PublicBlockView";
import PublicPortrait from "./PublicPortrait";
import PublicRelations from "./PublicRelations";
import PublicMusicToggle from "./PublicMusicToggle";
import MentionedIn from "@/components/entities/MentionedIn";

/**
 * Corps d'une fiche sur le wiki public (V2-G11/V2-G12) — partage par
 * `/partage/[token]/[entitySlug]` et `/m/[worldSlug]/apercu/[entitySlug]`,
 * qui ne different que par le bandeau de previsualisation ajoute autour.
 *
 * Deux mecanismes de contournement de texte independants :
 * - le portrait flotte, le premier bloc (s'il s'agit de texte) s'ecoule
 *   autour, apres les alias/relations ;
 * - une image ancree (V2.1-10) entre DANS son bloc hote, avant le segment
 *   vise — elle n'est plus un bloc frere pose juste avant sa cible. C'est
 *   ce qui supprime la bordure orpheline et le decalage au-dessus du titre
 *   que produisait l'ancien "retour a la ligne".
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
  const isJournalEntry = entity.entity_kind === "session_journal";

  // V2.1-6 : les blocs `music` sortent eux aussi du fil, pour une autre
  // raison — ils ne s'affichent plus nulle part, seul un bouton subsiste, a
  // cote du nom de la fiche (choix de l'auteur : un endroit, toujours le
  // meme, quel que soit l'endroit ou le bloc a ete range).
  const { contentBlocks: afterMusic, attachments: musicAttachments } = planMusicAttachments(
    blocks.filter((b) => b.blockType !== "session_journal_meta")
  );

  // V2.1-10 : apres la musique, jamais avant — une image ancree a un bloc
  // musique viserait une cible qui n'existe plus dans le fil, et doit donc
  // retomber dans le flux comme n'importe quelle cible perdue.
  const { contentBlocks, anchors } = planImageAnchors(afterMusic);

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
          {/* V2.1-6 : un bouton par bloc musique de la fiche, toujours ici —
              c'est le seul reste visible de ces blocs. Titre et boutons dans
              un meme conteneur `items-center` : c'est lui qui centre les
              boutons sur la hauteur du titre (retour utilisateur), et qui
              reprend le `flex-1` que portait le `<h1>` pour pousser le type
              de fiche a droite. */}
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <h1 className="entity-title">{entity.name || "(sans nom)"}</h1>
            {musicAttachments.map((attachment) => (
              <PublicMusicToggle
                key={attachment.blockId}
                blockId={attachment.blockId}
                tracks={attachment.tracks}
                label={attachment.label || "cette musique"}
                autoplay={attachment.autoplay}
                fadeInMs={attachment.fadeInMs}
                fadeOutMs={attachment.fadeOutMs}
                loop={attachment.loop}
              />
            ))}
          </div>
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
        {firstBlockWraps && (
          <PublicBlockView
            block={firstBlock}
            hrefBase={hrefBase}
            ruleHrefBase={ruleHrefBase}
            anchoredImages={anchors[firstBlock.id]}
          />
        )}
      </div>

      {contentBlocks.length === 0 && <p className="mt-4 text-sm text-ink-muted">Aucun contenu public pour cette fiche.</p>}
      {restBlocks.length > 0 && (
        <div className="mt-4 flex flex-col">
          {restBlocks.map((block) => (
            <PublicBlockView
              key={block.id}
              block={block}
              hrefBase={hrefBase}
              ruleHrefBase={ruleHrefBase}
              anchoredImages={anchors[block.id]}
            />
          ))}
        </div>
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
  const ingameWeekday = calendar ? weekdayNameForDate(data.ingameDate, calendar) : null;
  const parts = [
    calendar ? `Date ingame : ${ingameWeekday ? `${ingameWeekday} ` : ""}${formatGameDate(data.ingameDate, calendar)}` : null,
    data.realSession ? `Session du ${data.realSession.label}` : null,
    data.writtenBy ? `Rédigé par ${data.writtenBy.name}` : null,
    data.writtenAt
      ? `Rédigé le ${new Date(data.writtenAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`
      : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return null;
  return <p className="journal-entry-meta">{parts.join(" · ")}</p>;
}

