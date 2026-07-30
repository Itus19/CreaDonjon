import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-wide text-accent">
          CreaDonjon
        </h1>
        <p className="text-muted">Connecté en tant que {user?.email}.</p>
        <form action={logout}>
          <button className="rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover">
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
