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
      <div className="flex flex-1 items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-wide text-accent">
            CreaDonjon
          </h1>
          <Link
            href="/login"
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
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
    <div className="flex flex-col flex-1 items-center font-sans">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-16 px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-wide text-accent">
            CreaDonjon
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">{user.email}</span>
            <form action={logout}>
              <button className="rounded-full border border-border px-3 py-1 text-foreground transition-colors hover:bg-surface-hover">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>

        {error && <p className="text-danger">Erreur: {error.message}</p>}

        <Link
          href="/worlds/new"
          className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Créer un monde
        </Link>

        {!error && (
          <ul className="flex flex-col gap-2">
            {worlds?.map((world) => (
              <li key={world.id}>
                <Link
                  href={`/worlds/${world.id}`}
                  className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-hover"
                >
                  <p className="font-medium text-foreground">{world.name}</p>
                  <p className="text-sm text-muted">{world.id}</p>
                </Link>
              </li>
            ))}
            {worlds?.length === 0 && (
              <p className="text-muted">Aucun monde visible pour ce compte.</p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
