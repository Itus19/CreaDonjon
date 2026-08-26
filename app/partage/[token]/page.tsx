import { notFound } from "next/navigation";
import {
  resolveShareLink,
  getPublicEntityTree,
  getPublicCampaignName,
  getPublicWikiWelcomeMessage,
} from "@/src/server/services/publicShare";
import { hasVerifiedSharePassword } from "./passwordActions";
import SharePasswordGate from "@/components/entities/public/SharePasswordGate";
import BookSkin from "@/components/entities/public/BookSkin";

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
  // validation, jamais "charge puis masque" — on s'arrete ici tant que le
  // cookie de verification n'est pas present.
  if (resolved.passwordHash && !(await hasVerifiedSharePassword(token))) {
    return <SharePasswordGate token={token} worldName={resolved.worldName} />;
  }

  const [tree, campaignName, welcomeMessage] = await Promise.all([
    getPublicEntityTree(resolved.worldId),
    getPublicCampaignName(resolved.worldId),
    getPublicWikiWelcomeMessage(resolved.worldId),
  ]);
  const title = campaignName ?? resolved.worldName;

  return (
    <BookSkin title={title} worldSlug={resolved.worldSlug} tree={tree} hrefBase={`/partage/${token}`}>
      <h1 className="entity-title whitespace-pre-line">
        {welcomeMessage || `Bienvenue dans la campagne — ${title} ! L'aventure commence ici !`}
      </h1>
      {tree.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Ce monde n&apos;a encore aucun contenu public.</p>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">Choisissez une entité dans le sommaire.</p>
      )}
    </BookSkin>
  );
}
