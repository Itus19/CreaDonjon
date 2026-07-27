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
    <div className="flex flex-1 items-center justify-center font-sans">
      <form action={createWorld} className="form-card flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-xl font-semibold text-foreground">
          Créer un monde
        </h1>

        {error && <p className="text-sm text-danger">{error}</p>}

        <label className="field-label">
          Nom du monde
          <input name="name" type="text" required className="input-field" />
        </label>

        <label className="field-label">
          Système de règles par défaut
          <select name="default_ruleset_id" className="input-field">
            <option value="">Aucun pour l&apos;instant</option>
            {rulesets?.map((ruleset) => (
              <option key={ruleset.id} value={ruleset.id}>
                {ruleset.name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn-accent mt-2">
          Créer
        </button>
      </form>
    </div>
  );
}
