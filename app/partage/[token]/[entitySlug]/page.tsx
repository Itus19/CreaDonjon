import { notFound } from "next/navigation";
import {
  resolveShareLink,
  getPublicEntityDetail,
  getPublicEntityTree,
  getPublicCampaignName,
} from "@/src/server/services/publicShare";
import PublicEntityBody from "@/components/entities/public/PublicEntityBody";
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

  const title = campaignName ?? resolved.worldName;

  return (
    <BookSkin
      title={title}
      worldSlug={resolved.worldSlug}
      tree={tree}
      hrefBase={`/partage/${token}`}
      wikiBackground={detail.wikiBackground}
    >
      <PublicEntityBody {...detail} hrefBase={`/partage/${token}`} />
    </BookSkin>
  );
}
