"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ENTRY_TYPE_LABELS_FR } from "@/src/i18n/fr";
import type { RuleEntrySummary } from "@/src/server/services/rules";

/** Un groupe par entry_type, pliable (meme motif que NodeRow dans components/shell/EntityTree.tsx). */
function RuleTypeGroup({
  entryType,
  items,
  worldSlug,
  currentKey,
  onNavigate,
}: {
  entryType: string;
  items: RuleEntrySummary[];
  worldSlug: string;
  currentKey: string | null;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? "Replier" : "Déplier"}
        className="flex w-full items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted"
      >
        <span className="w-3 text-[10px]">{expanded ? "▾" : "▸"}</span>
        {ENTRY_TYPE_LABELS_FR[entryType] ?? entryType}
      </button>
      {expanded && (
        <ul>
          {items.map((entry) => (
            <li key={entry.key}>
              <Link
                href={`/m/${worldSlug}/regles/${entry.key}`}
                onClick={onNavigate}
                className={`block truncate rounded px-2 py-1 text-sm transition-colors hover:bg-panel-raised ${
                  entry.key === currentKey ? "bg-panel-raised text-accent" : "text-ink-soft"
                }`}
              >
                {entry.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Barre laterale de l'onglet Regles (miroir de components/shell/Sidebar.tsx
 * cote Monde, meme repli mobile en panneau coulissant) : filtre local +
 * regroupement par entry_type. Pas de barre ⌘K ni de recherche serveur —
 * quelques milliers d'entrees filtrees en memoire suffisent, meme ordre de
 * grandeur que la liste d'entites d'un monde deja geree ainsi.
 */
export default function RulesSidebar({
  worldSlug,
  entries,
}: {
  worldSlug: string;
  entries: RuleEntrySummary[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const match = pathname.match(/\/regles\/([^/]+)/);
  const currentKey = match ? decodeURIComponent(match[1]) : null;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q === "" ? entries : entries.filter((e) => e.name.toLowerCase().includes(q));
    const byType = new Map<string, RuleEntrySummary[]>();
    for (const entry of filtered) {
      const list = byType.get(entry.entryType) ?? [];
      list.push(entry);
      byType.set(entry.entryType, list);
    }
    for (const list of byType.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return [...byType.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir la liste des règles"
        className="fixed left-3 top-[68px] z-40 rounded-md border border-edge bg-panel-raised p-2 text-sm text-ink shadow-md md:hidden"
      >
        ☰
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-scrim md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 top-14 z-50 flex w-[280px] shrink-0 flex-col gap-3 border-r border-edge bg-panel-sunken p-4 transition-transform md:static md:top-0 md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une règle…"
          className="rounded-md border border-edge bg-panel-raised px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />

        <nav aria-label="Règles du monde" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {groups.length === 0 && <p className="px-1 text-sm text-ink-muted">Aucune règle trouvée.</p>}
          {groups.map(([entryType, items]) => (
            <RuleTypeGroup
              key={entryType}
              entryType={entryType}
              items={items}
              worldSlug={worldSlug}
              currentKey={currentKey}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
