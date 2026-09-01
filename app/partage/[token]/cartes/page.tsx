import { notFound } from "next/navigation";
import { resolveShareLink, getPublicEntityTree, getPublicCampaignName, getPublicWorldMaps } from "@/src/server/services/publicShare";
import { hasVerifiedSharePassword } from "../passwordActions";
import SharePasswordGate from "@/components/entities/public/SharePasswordGate";
import BookSkin from "@/components/entities/public/BookSkin";
import PublicWorldMapsView from "@/components/entities/public/PublicWorldMapsView";

/** Vue "Cartes" du wiki public (Lot I, retour utilisateur : "voir la/les cartes en grand... dans le Wiki public") — même garde mot de passe que les autres pages de ce lien de partage. */
export default async function ShareLinkCartesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const resolved = await resolveShareLink(token);
  if (!resolved) notFound();

  if (resolved.passwordHash && !(await hasVerifiedSharePassword(token))) {
    return <SharePasswordGate token={token} worldName={resolved.worldName} />;
  }

  const [tree, campaignName, maps] = await Promise.all([
    getPublicEntityTree(resolved.worldId),
    getPublicCampaignName(resolved.worldId),
    getPublicWorldMaps(resolved.worldId),
  ]);
  const title = campaignName ?? resolved.worldName;

  return (
    <BookSkin title={title} worldSlug={resolved.worldSlug} tree={tree} hrefBase={`/partage/${token}`} fullWidth>
      <h1 className="entity-title">Cartes</h1>
      <div className="mt-4">
        <PublicWorldMapsView maps={maps} />
      </div>
    </BookSkin>
  );
}
