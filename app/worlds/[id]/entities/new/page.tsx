import { createEntity } from "./actions";

export default async function NewEntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const createEntityForWorld = createEntity.bind(null, id);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <form
        action={createEntityForWorld}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-900"
      >
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Créer une entité
        </h1>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Nom
          <input
            name="name"
            type="text"
            required
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/10 dark:text-zinc-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Type (personnage, lieu, faction, objet...)
          <input
            name="entity_kind"
            type="text"
            list="entity-kind-suggestions"
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/10 dark:text-zinc-50"
          />
          <datalist id="entity-kind-suggestions">
            <option value="personnage" />
            <option value="lieu" />
            <option value="faction" />
            <option value="objet" />
            <option value="evenement" />
          </datalist>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Résumé (toujours visible, pas de secret ici)
          <textarea
            name="summary"
            rows={3}
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/10 dark:text-zinc-50"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Créer
        </button>
      </form>
    </div>
  );
}
