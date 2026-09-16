import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  resolveShareLink,
  getPublicEntityTree,
  getPublicCampaignName,
  getPublicWikiBackground,
} from "@/src/server/services/publicShare";
import { EN_TETE_CHEMIN, entitySlugFromPathname } from "@/lib/wikiPath";
import { hasVerifiedSharePassword } from "./passwordActions";
import SharePasswordGate from "@/components/entities/public/SharePasswordGate";
import BookSkin from "@/components/entities/public/BookSkin";
import WikiBackgroundProvider from "@/components/entities/public/WikiBackgroundProvider";

/**
 * Seul endroit qui persiste entre deux fiches d'un meme lien de partage
 * (V2-G13 suite) : porte le fond de page wiki, pour qu'il puisse
 * s'estomper en quittant une fiche plutot que de couper net a chaque
 * navigation — voir `WikiBackgroundProvider.tsx`.
 *
 * V2.1-19 volet B : porte aussi la COQUILLE (`BookSkin`), comme
 * `apercu/layout.tsx` depuis V2.1-12. Elle vivait dans chaque page, donc
 * elle se reconstruisait a chaque fiche : cinq requetes pour refaire un
 * sommaire identique, la recherche videe, le defilement remis a zero et le
 * repli qui scintille (lu depuis `localStorage` dans un effet, apres le
 * premier rendu). `/partage` etait la derniere des trois routes de wiki dans
 * ce cas.
 *
 * La raison qui l'en avait exclue — "la hisser obligerait le layout a
 * charger le sommaire avant la garde par mot de passe" — n'etait pas fausse,
 * elle etait incomplete. La garde precede bien le chargement ci-dessous.
 * Mais la deplacer ici ne SUFFIT pas : en rendu serveur React, layout et
 * page s'executent concurremment, et un layout qui ne rend pas ses
 * `children` n'annule pas le travail que la page a deja lance. La garde
 * reste donc AUSSI dans chaque page, et c'est la memoisation de
 * `resolveShareLink` (volet A) qui rend cette duplication gratuite —
 * `hasVerifiedSharePassword` ne lit qu'un cookie.
 */
export default async function ShareLinkLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const resolved = await resolveShareLink(token);
  if (!resolved) notFound();

  // Jamais de contenu recupere avant validation, jamais "charge puis masque"
  // (V1-C4) : rien de ce qui suit ne part tant que le cookie est absent.
  if (resolved.passwordHash && !(await hasVerifiedSharePassword(token))) {
    return <SharePasswordGate token={token} worldName={resolved.worldName} />;
  }

  // V2.1-20 lot 2.1 : la fiche rendue sous ce layout, tiree de l'en-tete pose
  // par le middleware (`lib/wikiPath.ts`) — Next ne donne pas au layout les
  // parametres de son segment enfant, et le fond est par FICHE alors que la
  // coquille qui porte ses jetons est par MONDE. `null` sur la page de
  // sommaire, et `getPublicWikiBackground` rend alors `null` sans requete.
  const entitySlug = entitySlugFromPathname((await headers()).get(EN_TETE_CHEMIN), `/partage/${token}`);

  const [tree, campaignName, initialBackground] = await Promise.all([
    getPublicEntityTree(resolved.worldId),
    getPublicCampaignName(resolved.worldId),
    // Memoise : la page demande le meme fond dans ce meme rendu, les deux
    // attendent une seule resolution. Sans ce partage, ces trois vagues
    // feraient du layout le chemin critique d'une fiche ordinaire.
    entitySlug ? getPublicWikiBackground(resolved.worldId, entitySlug) : Promise.resolve(null),
  ]);

  return (
    <WikiBackgroundProvider initialBackground={initialBackground}>
      <BookSkin
        title={campaignName ?? resolved.worldName}
        worldSlug={resolved.worldSlug}
        tree={tree}
        hrefBase={`/partage/${token}`}
      >
        {children}
      </BookSkin>
    </WikiBackgroundProvider>
  );
}
