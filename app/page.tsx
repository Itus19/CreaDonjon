import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            CreaDonjon
          </h1>
          <Link
            href="/login"
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const { data: worlds, error } = await supabase
    .from("worlds")
    .select("id, name, created_at");

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-16 px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            CreaDonjon
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">{user.email}</span>
            <form action={logout}>
              <button className="rounded-full border border-black/10 px-3 py-1 dark:border-white/10">
                Se deconnecter
              </button>
            </form>
          </div>
        </div>

        {error && (
          <p className="text-red-600 dark:text-red-400">
            Erreur: {error.message}
          </p>
        )}

        <Link
          href="/worlds/new"
          className="self-start rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Créer un monde
        </Link>

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
              <p className="text-zinc-500">
                Aucun monde visible pour ce compte.
              </p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
