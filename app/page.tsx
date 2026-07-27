import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: worlds, error } = await supabase
    .from("worlds")
    .select("id, name, created_at");

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-16 px-8">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          CreaDonjon — connexion Supabase
        </h1>

        {error && (
          <p className="text-red-600 dark:text-red-400">
            Erreur: {error.message}
          </p>
        )}

        {!error && (
          <ul className="flex flex-col gap-2">
            {worlds?.map((world) => (
              <li
                key={world.id}
                className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900"
              >
                <p className="font-medium text-black dark:text-zinc-50">
                  {world.name}
                </p>
                <p className="text-sm text-zinc-500">{world.id}</p>
              </li>
            ))}
            {worlds?.length === 0 && (
              <p className="text-zinc-500">Aucun monde visible.</p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
