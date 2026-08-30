import Link from "next/link";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { listRuleEntriesForWorld } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";

/**
 * Règles en lecture seule (V2-M7b, coquille joueur) — liste plate plutot
 * que la sidebar MJ complete (groupes par type, sous-classes imbriquees) :
 * un joueur cherche une regle precise, pas ne navigue pas le catalogue
 * entier. Meme donnee (`listRuleEntriesForWorld`), deja en lecture seule
 * par nature (une regle officielle ne se modifie jamais, regle absolue
 * n°12).
 */
export default async function JoueurReglesPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const entries = await listRuleEntriesForWorld(supabase, worldSlug, locale);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-ink">Règles</h2>
      {(!entries || entries.length === 0) && <p className="text-sm text-ink-muted">Aucun ruleset pour ce monde.</p>}
      <ul className="flex flex-col gap-1">
        {entries?.map((entry) => (
          <li key={entry.key}>
            <Link
              href={`/m/${worldSlug}/joueur/regles/${entry.key}`}
              className="block rounded-md border border-edge bg-panel px-3 py-2 text-sm text-ink transition-colors hover:bg-panel-raised"
            >
              {entry.name}
              <span className="ml-2 text-xs text-ink-muted">{entry.entryType}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
