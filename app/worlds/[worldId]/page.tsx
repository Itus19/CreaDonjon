import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorld } from "@/src/server/services/worlds";
import { listEntities } from "@/src/server/services/entities";

export default async function WorldPage({
  params,
}: {
  params: Promise<{ worldId: string }>;
}) {
  const { worldId } = await params;
  const supabase = await createClient();
  const world = await getWorld(supabase, worldId);
  if (!world) notFound();

  const entities = await listEntities(supabase, worldId);

  return (
    <div className="flex flex-1 justify-center font-sans">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-16 px-8">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-sm text-muted hover:text-foreground">
              &larr; Mes mondes
            </Link>
            <h1 className="text-2xl font-semibold tracking-wide text-accent">{world.name}</h1>
          </div>
          <Link
            href={`/worlds/${worldId}/entities/new`}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            + Nouvelle entité
          </Link>
        </div>

        <ul className="flex flex-col gap-2">
          {entities.map((entity) => (
            <li key={entity.id}>
              <Link
                href={`/worlds/${worldId}/entities/${entity.slug}`}
                className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-hover"
              >
                <p className="font-medium text-foreground">{entity.name}</p>
                <p className="text-sm text-muted">
                  {entity.entity_kind} · {entity.slug}
                </p>
              </Link>
            </li>
          ))}
          {entities.length === 0 && <p className="text-muted">Aucune entité pour l&apos;instant.</p>}
        </ul>
      </main>
    </div>
  );
}
