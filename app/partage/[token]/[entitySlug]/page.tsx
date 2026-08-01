import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createShareLinkServiceClient } from "@/lib/supabase/service";
import { resolveShareLink, getPublicEntityDetail } from "@/src/server/services/publicShare";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import PublicBlockView from "@/components/entities/public/PublicBlockView";

export default async function ShareLinkEntityPage({
  params,
}: {
  params: Promise<{ token: string; entitySlug: string }>;
}) {
  const { token, entitySlug } = await params;

  const supabase = await createClient();
  const resolved = await resolveShareLink(supabase, token);
  if (!resolved) notFound();

  const serviceClient = createShareLinkServiceClient();
  const detail = await getPublicEntityDetail(serviceClient, resolved.worldId, entitySlug);
  if (!detail) notFound();

  const { entity, blocks } = detail;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Link href={`/partage/${token}`} className="text-xs text-ink-muted hover:underline">
        ← {resolved.worldName}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="entity-title flex-1">{entity.name || "(sans nom)"}</h1>
        <span className="shrink-0 whitespace-nowrap text-sm font-medium text-ink-muted">
          {ENTITY_KIND_LABELS[entity.entity_kind as keyof typeof ENTITY_KIND_LABELS] ?? entity.entity_kind}
        </span>
      </div>

      {entity.aliases.length > 0 && (
        <p className="text-xs text-ink-muted">Alias : {entity.aliases.join(", ")}</p>
      )}

      {blocks.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucun contenu public pour cette fiche.</p>
      ) : (
        <div className="flex flex-col">
          {blocks.map((block) => (
            <PublicBlockView key={block.id} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}
