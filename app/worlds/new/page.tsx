import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorld } from "./actions";

export default async function NewWorldPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: rulesets } = await supabase
    .from("rulesets")
    .select("id, name")
    .eq("is_official_base", true)
    .order("name");

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <form
        action={createWorld}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-900"
      >
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Créer un monde
        </h1>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Nom du monde
          <input
            name="name"
            type="text"
            required
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/10 dark:text-zinc-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Système de règles par défaut
          <select
            name="default_ruleset_id"
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/10 dark:text-zinc-50"
          >
            <option value="">Aucun pour l&apos;instant</option>
            {rulesets?.map((ruleset) => (
              <option key={ruleset.id} value={ruleset.id}>
                {ruleset.name}
              </option>
            ))}
          </select>
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
