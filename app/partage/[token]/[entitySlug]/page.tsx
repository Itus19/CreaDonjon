import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
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
import type { Locale } from "@/src/i18n/request";
import { WikiBackgroundRegistrar } from "@/components/entities/public/WikiBackgroundProvider";

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
    getPublicEntityDetail(resolved.worldId, entitySlug, (await getLocale()) as Locale),
    getPublicEntityTree(resolved.worldId),
    getPublicCampaignName(resolved.worldId),
  ]);
  if (!detail) notFound();

  const title = campaignName ?? resolved.worldName;

  return (
    // V2.1-12 : seule route ou `BookSkin` reste montee par la PAGE. La hisser
    // dans le layout obligerait celui-ci a charger le sommaire avant la garde
    // par mot de passe ci-dessus — or « jamais de contenu recupere avant
    // validation, jamais "charge puis masque" ». La coquille s'y reconstruit
    // donc encore a chaque fiche, contrairement a /apercu et a l'onglet joueur.
    <BookSkin title={title} worldSlug={resolved.worldSlug} tree={tree} hrefBase={`/partage/${token}`}>
      <WikiBackgroundRegistrar background={detail.wikiBackground} />
      <PublicEntityBody {...detail} hrefBase={`/partage/${token}`} />
    </BookSkin>
  );
}
