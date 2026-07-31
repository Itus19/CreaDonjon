import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listWorlds } from "@/src/server/services/worlds";
import { logout } from "./login/actions";
import CreateWorldForm from "./CreateWorldForm";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const worlds = await listWorlds(supabase);

  return (
    <div className="flex flex-1 justify-center font-sans">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-16 px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-wide text-accent">
            CreaDonjon
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-ink-muted">{user?.email}</span>
            <form action={logout}>
              <button className="rounded-full border border-edge px-3 py-1 text-ink transition-colors hover:bg-panel-raised">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>

        <CreateWorldForm />

        <ul className="flex flex-col gap-2">
          {worlds.map((world) => (
            <li key={world.id}>
              <Link
                href={`/m/${world.slug}`}
                className="block rounded-lg border border-edge bg-panel p-4 transition-colors hover:bg-panel-raised"
              >
                <p className="font-medium text-ink">{world.name}</p>
                <p className="text-sm text-ink-muted">{world.slug}</p>
              </Link>
            </li>
          ))}
          {worlds.length === 0 && (
            <p className="text-ink-muted">Aucun monde pour l&apos;instant.</p>
          )}
        </ul>
      </main>
    </div>
  );
}
