import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { resolveShareLink, getPublicEntityDetail } from "@/src/server/services/publicShare";
import PublicEntityBody from "@/components/entities/public/PublicEntityBody";
import { hasVerifiedSharePassword } from "../passwordActions";
import SharePasswordGate from "@/components/entities/public/SharePasswordGate";
import type { Locale } from "@/src/i18n/request";
import { WikiBackgroundRegistrar } from "@/components/entities/public/WikiBackgroundProvider";
import WikiBackgroundPreload from "@/components/entities/public/WikiBackgroundPreload";

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
  //
  // V2.1-19 volet B : le layout pose desormais la MEME garde avant de charger
  // le sommaire, et celle-ci reste ici — elle n'est pas redondante. Layout et
  // page s'executent concurremment : sans cette garde-ci, le layout aurait
  // beau refuser de rendre ses `children`, la fiche aurait deja ete chargee.
  // `resolveShareLink` etant memoise (volet A), la seconde verification ne
  // coute aucune requete.
  if (resolved.passwordHash && !(await hasVerifiedSharePassword(token))) {
    return <SharePasswordGate token={token} worldName={resolved.worldName} />;
  }

  const detail = await getPublicEntityDetail(resolved.worldId, entitySlug, (await getLocale()) as Locale);
  if (!detail) notFound();

  return (
    <>
      {/* V2.1-19 : la coquille vient du layout, comme sur /apercu et l'onglet
          joueur depuis V2.1-12. Cette page ne declare plus que le fond de
          CETTE fiche — la seule chose qui change d'une fiche a l'autre. */}
      <WikiBackgroundPreload background={detail.wikiBackground} />
      <WikiBackgroundRegistrar background={detail.wikiBackground} />
      <PublicEntityBody {...detail} hrefBase={`/partage/${token}`} />
    </>
  );
}
