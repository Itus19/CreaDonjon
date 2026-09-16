import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import type { EntitySummary } from "@/src/server/repos/entities";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import { planMusicAttachments } from "@/src/core/music/blockAttachment";
import { planImageAnchors } from "@/src/core/images/blockAnchor";
import type { PublicBlock, PublicRelation } from "@/src/server/services/publicShare";
import PublicBlockView, { hasLeadRule } from "./PublicBlockView";
import PublicPortrait from "./PublicPortrait";
import PublicRelations from "./PublicRelations";
import PublicMusicToggle from "./PublicMusicToggle";
import RefPreviewLayer from "./RefPreviewLayer";
import type { EntityRefPreview, RuleRefPreview } from "@/src/server/services/refPreview";

/**
 * Corps d'une fiche sur le wiki public (V2-G11/V2-G12) — partage par
 * `/partage/[token]/[entitySlug]` et `/m/[worldSlug]/apercu/[entitySlug]`,
 * qui ne different que par le bandeau de previsualisation ajoute autour.
 *
 * Deux mecanismes de contournement de texte independants :
 * - le portrait flotte, le premier bloc (s'il s'agit de texte) s'ecoule
 *   autour, apres les alias/relations ;
 * - une image ancree (V2.1-11) entre DANS son bloc hote, avant le segment
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
  // V2.1-14 : plus aucune branche propre a `session_journal` ici. Le bloc
  // Seance revient dans le fil comme tout autre bloc (il est desormais
  // ajoutable sur n'importe quelle fiche), et la presentation "livre"
  // (lettrine, traits) est devenue une option du bloc texte, disponible
  // partout — une mise en forme n'est pas la propriete d'un genre de fiche.

  // V2.1-6 : les blocs `music` sortent eux aussi du fil, pour une autre
  // raison — ils ne s'affichent plus nulle part, seul un bouton subsiste, a
  // cote du nom de la fiche (choix de l'auteur : un endroit, toujours le
  // meme, quel que soit l'endroit ou le bloc a ete range).
  const { contentBlocks: afterMusic, attachments: musicAttachments } = planMusicAttachments(blocks);

  // V2.1-11 : apres la musique, jamais avant — une image ancree a un bloc
  // musique viserait une cible qui n'existe plus dans le fil, et doit donc
  // retomber dans le flux comme n'importe quelle cible perdue.
  const { contentBlocks, anchors } = planImageAnchors(afterMusic);

  const [firstBlock, ...afterFirst] = contentBlocks;
  const firstBlockWraps = firstBlock?.blockType === "text";
  const restBlocks = firstBlockWraps ? afterFirst : contentBlocks;

  // V2.1-18 lot 3 : les tables de tous les blocs `text` fusionnees UNE fois,
  // pour l'unique carte de la page. Les doublons se recouvrent sans
  // dommage — deux blocs qui citent la meme fiche portent la meme entree.
  const entityRefs: Record<string, EntityRefPreview> = {};
  const ruleRefs: Record<string, RuleRefPreview> = {};
  for (const block of blocks) {
    Object.assign(entityRefs, block.textRefs ?? {});
    Object.assign(ruleRefs, block.ruleRefs ?? {});
  }
  const hasRefs = Object.keys(entityRefs).length > 0 || Object.keys(ruleRefs).length > 0;

  return (
    <div>
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
          <span className="shrink-0 whitespace-nowrap text-sm font-medium text-ink-muted">
            {ENTITY_KIND_LABELS[entity.entity_kind as keyof typeof ENTITY_KIND_LABELS] ?? entity.entity_kind}
          </span>
        </div>
        {entity.aliases.length > 0 && (
          <p className="mt-1 text-xs text-ink-muted">Alias : {entity.aliases.join(", ")}</p>
        )}
        <PublicRelations relations={relations} hrefBase={hrefBase} />
        {firstBlockWraps && (
          <PublicBlockView
            block={firstBlock}
            hrefBase={hrefBase}
            ruleHrefBase={ruleHrefBase}
            anchoredImages={anchors[firstBlock.id]}
            suppressBottomRule={hasLeadRule(restBlocks[0])}
          />
        )}
      </div>

      {contentBlocks.length === 0 && <p className="mt-4 text-sm text-ink-muted">Aucun contenu public pour cette fiche.</p>}
      {restBlocks.length > 0 && (
        <div className="mt-4 flex flex-col">
          {/* V2.1-17 : `suppressBottomRule` se decide en regardant le bloc
              SUIVANT — un trait pose en tete de celui-la remplace le filet
              automatique de cette jonction au lieu de s'y ajouter. Calcule
              ici et pas dans `PublicBlockView`, qui ne voit qu'un bloc a la
              fois ; le premier bloc (rendu plus haut, dans le `flow-root` du
              portrait) recoit le meme traitement, car il n'est pas frere de
              ceux-ci dans le DOM et aucun selecteur CSS ne les relierait. */}
          {restBlocks.map((block, i) => (
            <PublicBlockView
              key={block.id}
              block={block}
              hrefBase={hrefBase}
              ruleHrefBase={ruleHrefBase}
              anchoredImages={anchors[block.id]}
              suppressBottomRule={hasLeadRule(restBlocks[i + 1])}
            />
          ))}
        </div>
      )}
      {/* V2.1-18 lot 3 : une seule instance, montee seulement si la fiche
          cite quelque chose — une fiche sans lien ne telecharge rien de
          plus qu'avant. */}
      {hasRefs && (
        <RefPreviewLayer
          entityRefs={entityRefs}
          ruleRefs={ruleRefs}
          hrefBase={hrefBase}
        />
      )}
    </div>
  );
}
