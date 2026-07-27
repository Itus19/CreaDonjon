import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addBlock } from "./actions";

const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public",
  joueurs: "Joueurs",
  mj: "MJ uniquement",
  prive: "Privé",
};

export default async function EntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; entityId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: worldId, entityId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: entity } = await supabase
    .from("entities")
    .select("id, name, entity_kind, summary")
    .eq("id", entityId)
    .single();

  if (!entity) {
    notFound();
  }

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, block_type, data, visibility, display_order")
    .eq("entity_id", entityId)
    .order("display_order");

  const addBlockToEntity = addBlock.bind(null, worldId, entityId);

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-16 px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
              {entity.name}
            </h1>
            {entity.entity_kind && (
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
                {entity.entity_kind}
              </span>
            )}
          </div>
          <Link
            href={`/worlds/${worldId}`}
            className="text-sm text-zinc-500 hover:underline"
          >
            ← Retour au monde
          </Link>
        </div>

        {entity.summary && (
          <p className="text-zinc-700 dark:text-zinc-300">{entity.summary}</p>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-black dark:text-zinc-50">
            Blocs
          </h2>

          {blocks?.map((block) => (
            <div
              key={block.id}
              className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-black dark:text-zinc-50">
                  {block.block_type}
                </span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
                  {VISIBILITY_LABELS[block.visibility] ?? block.visibility}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {(block.data as { content?: string })?.content ??
                  JSON.stringify(block.data)}
              </p>
            </div>
          ))}
          {blocks?.length === 0 && (
            <p className="text-zinc-500">Aucun bloc pour l&apos;instant.</p>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
          <h2 className="text-lg font-medium text-black dark:text-zinc-50">
            Ajouter un bloc
          </h2>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <form action={addBlockToEntity} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              Type de bloc
              <input
                name="block_type"
                type="text"
                required
                list="block-type-suggestions"
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/10 dark:text-zinc-50"
              />
              <datalist id="block-type-suggestions">
                <option value="personnage" />
                <option value="biologie" />
                <option value="inventaire" />
                <option value="faction" />
                <option value="geographie" />
                <option value="relations" />
                <option value="objectifs" />
                <option value="chronologie" />
                <option value="statistiques" />
              </datalist>
            </label>

            <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              Contenu
              <textarea
                name="content"
                rows={4}
                required
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/10 dark:text-zinc-50"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              Visibilité
              <select
                name="visibility"
                defaultValue="public"
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/10 dark:text-zinc-50"
              >
                <option value="public">Public</option>
                <option value="joueurs">Joueurs</option>
                <option value="mj">MJ uniquement</option>
                <option value="prive">Privé</option>
              </select>
            </label>

            <button
              type="submit"
              className="self-start rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Ajouter
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
