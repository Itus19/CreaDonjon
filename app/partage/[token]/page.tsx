import { notFound, redirect } from "next/navigation";
import {
  resolveShareLink,
  getPublicEntityTree,
  getPublicCampaignName,
  getPublicWikiWelcomeMessage,
  getLatestPublicSessionJournalSlug,
} from "@/src/server/services/publicShare";
import { hasVerifiedSharePassword } from "./passwordActions";
import SharePasswordGate from "@/components/entities/public/SharePasswordGate";
import { WikiBackgroundRegistrar } from "@/components/entities/public/WikiBackgroundProvider";

export default async function ShareLinkWorldPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Meme reponse (404) pour "jamais existe", "expire" et "revoque"
  // (docs/BACKLOG.md V0-07) : resolveShareLink ne distingue jamais les
  // trois cotes appelant.
  const resolved = await resolveShareLink(token);
  if (!resolved) notFound();

  // Mot de passe optionnel (V1-C4) : jamais de contenu recupere avant
  // validation, jamais "charge puis masque". Posee ici EN PLUS du layout
  // (V2.1-19 volet B) : layout et page s'executent concurremment, seule
  // cette garde-ci empeche le chargement qui suit.
  if (resolved.passwordHash && !(await hasVerifiedSharePassword(token))) {
    return <SharePasswordGate token={token} worldName={resolved.worldName} />;
  }

  const latestSlug = await getLatestPublicSessionJournalSlug(resolved.worldId);
  if (latestSlug) redirect(`/partage/${token}/${latestSlug}`);

  // V2.1-19 : `tree` n'est plus lu pour construire la coquille (le layout
  // s'en charge) — seulement pour savoir si ce monde a du contenu public.
  // `getPublicEntityTree` est desormais memoise pour cette raison precise :
  // le layout l'a deja demande dans ce meme rendu, cet appel ne coute rien.
  const [tree, campaignName, welcomeMessage] = await Promise.all([
    getPublicEntityTree(resolved.worldId),
    getPublicCampaignName(resolved.worldId),
    getPublicWikiWelcomeMessage(resolved.worldId),
  ]);
  const title = campaignName ?? resolved.worldName;

  return (
    <>
      <WikiBackgroundRegistrar background={null} />
      <h1 className="entity-title whitespace-pre-line">
        {welcomeMessage || `Bienvenue dans la campagne — ${title} ! L'aventure commence ici !`}
      </h1>
      {tree.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Ce monde n&apos;a encore aucun contenu public.</p>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">Choisissez une entité dans le sommaire.</p>
      )}
    </>
  );
}
