import { notFound } from "next/navigation";
import {
  resolveShareLink,
  getPublicEntityDetail,
  getPublicEntityTree,
  getPublicCampaignName,
} from "@/src/server/services/publicShare";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import PublicBlockView from "@/components/entities/public/PublicBlockView";
import PublicPortrait from "@/components/entities/public/PublicPortrait";
import PublicRelations from "@/components/entities/public/PublicRelations";
import { hasVerifiedSharePassword } from "../passwordActions";
import SharePasswordGate from "@/components/entities/public/SharePasswordGate";
import BookSkin from "@/components/entities/public/BookSkin";

export default async function ShareLinkEntityPage({
  params,
}: {
  params: Promise<{ token: string; entitySlug: string }>;
}) {
  const { token, entitySlug } = await params;

  const resolved = await resolveShareLink(token);
  if (!resolved) notFound();

  // Meme verrou que la page de liste (V1-C4) : un visiteur qui arrive
  // directement sur l'URL d'une fiche (lien partage plus loin) doit
  // retrouver le mot de passe, jamais un detour qui le contournerait.
  if (resolved.passwordHash && !(await hasVerifiedSharePassword(token))) {
    return <SharePasswordGate token={token} worldName={resolved.worldName} />;
  }

  const [detail, tree, campaignName] = await Promise.all([
    getPublicEntityDetail(resolved.worldId, entitySlug),
    getPublicEntityTree(resolved.worldId),
    getPublicCampaignName(resolved.worldId),
  ]);
  if (!detail) notFound();

  const { entity, blocks, relations, portraitLayout } = detail;
  const title = campaignName ?? resolved.worldName;
  // Le texte du premier bloc contourne le portrait (retour utilisateur,
  // V2-G11) — seulement s'il s'agit d'un bloc `text` (un `image` ou un
  // tableau en premier n'a pas de sens a "contourner"), et seulement lui :
  // les blocs suivants reprennent toute la largeur, jamais une cascade.
  const [firstBlock, ...remainingBlocks] = blocks;
  const firstBlockWraps = firstBlock?.blockType === "text";
  const restBlocks = firstBlockWraps ? remainingBlocks : blocks;

  return (
    <BookSkin title={title} worldSlug={resolved.worldSlug} tree={tree} hrefBase={`/partage/${token}`}>
      {/* `flow-root` (pas `clear-both` en aval) : contient le flottement du
          portrait a l'interieur de ce seul conteneur, sans affecter les
          blocs suivants ni depasser si le texte encadre est court. */}
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
        <PublicRelations relations={relations} hrefBase={`/partage/${token}`} />
        {firstBlockWraps && <PublicBlockView block={firstBlock} />}
      </div>

      {blocks.length === 0 && <p className="mt-4 text-sm text-ink-muted">Aucun contenu public pour cette fiche.</p>}
      {restBlocks.length > 0 && (
        <div className="mt-4 flex flex-col">
          {restBlocks.map((block) => (
            <PublicBlockView key={block.id} block={block} />
          ))}
        </div>
      )}
    </BookSkin>
  );
}
