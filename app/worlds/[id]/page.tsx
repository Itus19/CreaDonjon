import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function WorldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: world } = await supabase
    .from("worlds")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!world) {
    notFound();
  }

  const { data: entities, error } = await supabase
    .from("entities")
    .select("id, name, entity_kind, summary")
    .eq("world_id", id)
    .order("name");

  return (
    <div className="flex flex-col flex-1 items-center font-sans">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-16 px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">
            {world.name}
          </h1>
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← Mes mondes
          </Link>
        </div>

        <Link
          href={`/worlds/${world.id}/entities/new`}
          className="btn-accent self-start"
        >
          Créer une entité
        </Link>

        {error && <p className="text-danger">Erreur: {error.message}</p>}

        {!error && (
          <ul className="flex flex-col gap-2">
            {entities?.map((entity) => (
              <li key={entity.id}>
                <Link
                  href={`/worlds/${world.id}/entities/${entity.id}`}
                  className="card block transition-colors hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">
                      {entity.name}
                    </p>
                    {entity.entity_kind && (
                      <span className="chip">{entity.entity_kind}</span>
                    )}
                  </div>
                  {entity.summary && (
                    <p className="text-sm text-muted">{entity.summary}</p>
                  )}
                </Link>
              </li>
            ))}
            {entities?.length === 0 && (
              <p className="text-muted">Aucune entité pour l&apos;instant.</p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
