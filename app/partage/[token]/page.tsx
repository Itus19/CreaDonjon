import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveShareLink, listPublicEntities } from "@/src/server/services/publicShare";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import { hasVerifiedSharePassword } from "./passwordActions";
import SharePasswordGate from "@/components/entities/public/SharePasswordGate";

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

  const entities = await listPublicEntities(resolved.worldId);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <p className="font-mech text-xs text-ink-muted">Lecture seule — lien de partage</p>
      <h1 className="entity-title">{resolved.worldName}</h1>

      {entities.length === 0 ? (
        <p className="text-sm text-ink-muted">Ce monde n&apos;a encore aucun contenu public.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entities.map((entity) => (
            <li key={entity.id}>
              <Link
                href={`/partage/${token}/${entity.slug}`}
                className="flex items-center justify-between gap-2 rounded-md border border-edge px-3 py-2 text-sm transition-colors hover:bg-panel-raised"
              >
                <span>{entity.name || "(sans nom)"}</span>
                <span className="text-xs text-ink-muted">
                  {ENTITY_KIND_LABELS[entity.entity_kind as keyof typeof ENTITY_KIND_LABELS] ?? entity.entity_kind}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
