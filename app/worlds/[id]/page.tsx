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
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-16 px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {world.name}
          </h1>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← Mes mondes
          </Link>
        </div>

        <Link
          href={`/worlds/${world.id}/entities/new`}
          className="self-start rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Créer une entité
        </Link>

        {error && (
          <p className="text-red-600 dark:text-red-400">
            Erreur: {error.message}
          </p>
        )}

        {!error && (
          <ul className="flex flex-col gap-2">
            {entities?.map((entity) => (
              <li key={entity.id}>
                <Link
                  href={`/worlds/${world.id}/entities/${entity.id}`}
                  className="block rounded-lg border border-black/10 bg-white p-4 hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-black dark:text-zinc-50">
                      {entity.name}
                    </p>
                    {entity.entity_kind && (
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
                        {entity.entity_kind}
                      </span>
                    )}
                  </div>
                  {entity.summary && (
                    <p className="text-sm text-zinc-500">{entity.summary}</p>
                  )}
                </Link>
              </li>
            ))}
            {entities?.length === 0 && (
              <p className="text-zinc-500">Aucune entité pour l&apos;instant.</p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
