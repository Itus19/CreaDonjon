import { createClient } from "@/lib/supabase/server";
import { listRuleEntriesForWorld } from "@/src/server/services/rules";

export default async function ReglesHomePage({
  params,
}: {
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const entries = await listRuleEntriesForWorld(supabase, worldSlug);

  if (!entries || entries.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Ce monde n&apos;a pas encore de ruleset assigné — aucune règle à consulter pour l&apos;instant.
      </p>
    );
  }

  return <p className="text-sm text-ink-muted">Choisissez une règle dans la barre latérale.</p>;
}
