import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listWorldCards } from "@/src/server/services/worlds";
import { listSelectableRulesetsForCurrentUser } from "@/src/server/services/rules";
import { logout } from "./login/actions";
import CreateWorldForm from "./CreateWorldForm";

const MODE_LABELS: Record<"campaign" | "solo", string> = { campaign: "MJ", solo: "Solo" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [worlds, selectableRulesets] = await Promise.all([
    listWorldCards(supabase),
    listSelectableRulesetsForCurrentUser(supabase),
  ]);
  const officialRulesets = (selectableRulesets ?? []).filter((r) => r.is_official_base);

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

        <CreateWorldForm officialRulesets={officialRulesets} />

        <ul className="flex flex-col gap-2">
          {worlds.map((world) => (
            <li key={world.id}>
              <Link
                href={`/m/${world.slug}`}
                className="block rounded-lg border border-edge bg-panel p-4 transition-colors hover:bg-panel-raised"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-ink">{world.name}</p>
                  {world.mode && (
                    <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                      {MODE_LABELS[world.mode]}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-muted">
                  {world.rulesetName ?? "Aucun ruleset"} · Modifié le {formatDate(world.lastModified)}
                </p>
                <p className="text-sm text-ink-muted">
                  {world.players.length > 0 ? world.players.join(", ") : "Aucun joueur"}
                </p>
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
