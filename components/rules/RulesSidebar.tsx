"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { RuleEntrySummary } from "@/src/server/services/rules";
import RulesetSelector from "./RulesetSelector";

function RuleEntryLink({
  entry,
  worldSlug,
  currentKey,
  onNavigate,
  nested,
}: {
  entry: RuleEntrySummary;
  worldSlug: string;
  currentKey: string | null;
  onNavigate: () => void;
  nested?: boolean;
}) {
  return (
    <Link
      href={`/m/${worldSlug}/regles/${entry.key}`}
      onClick={onNavigate}
      className={`block truncate rounded px-2 py-1 text-sm transition-colors hover:bg-panel-raised ${
        entry.key === currentKey ? "bg-panel-raised text-accent" : "text-ink-soft"
      }`}
      style={nested ? { paddingLeft: "22px" } : undefined}
    >
      {entry.name}
    </Link>
  );
}

/**
 * Un groupe par entry_type, pliable (meme motif que NodeRow dans
 * components/shell/EntityTree.tsx). `subclassesByParent` (V1-D7, sur
 * retour utilisateur : "je dois pouvoir trouver Évocateur sous Magicien")
 * n'est fourni que par le groupe Classe — chaque sous-classe s'affiche
 * directement sous sa classe (`entry.key`), pas dans un groupe a part.
 */
function RuleTypeGroup({
  entryType,
  items,
  worldSlug,
  currentKey,
  onNavigate,
  subclassesByParent,
}: {
  entryType: string;
  items: RuleEntrySummary[];
  worldSlug: string;
  currentKey: string | null;
  onNavigate: () => void;
  subclassesByParent?: Map<string, RuleEntrySummary[]>;
}) {
  const t = useTranslations("shell");
  const tRegles = useTranslations("regles");
  const entryTypeLabels = tRegles.raw("entryTypes") as Record<string, string>;
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? t("replier") : t("deplier")}
        className="flex w-full items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted"
      >
        <span className="w-3 text-[10px]">{expanded ? "▾" : "▸"}</span>
        {entryTypeLabels[entryType] ?? entryType}
      </button>
      {expanded && (
        <ul>
          {items.map((entry) => (
            <li key={entry.key}>
              <RuleEntryLink entry={entry} worldSlug={worldSlug} currentKey={currentKey} onNavigate={onNavigate} />
              {subclassesByParent?.get(entry.key)?.map((sub) => (
                <RuleEntryLink key={sub.key} entry={sub} worldSlug={worldSlug} currentKey={currentKey} onNavigate={onNavigate} nested />
              ))}
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
  const t = useTranslations("regles");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const match = pathname.match(/\/regles\/([^/]+)/);
  const currentKey = match ? decodeURIComponent(match[1]) : null;

  const { groups, subclassesByParent } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q === "" ? entries : entries.filter((e) => e.name.toLowerCase().includes(q));

    // Sous-classe nichee sous sa classe (V1-D7, sur retour utilisateur :
    // "je dois pouvoir trouver Évocateur sous Magicien"), jamais un groupe
    // a part — sauf si la classe elle-meme n'est pas dans le resultat
    // filtre (recherche sur le nom d'une sous-classe seule, ou classe
    // parente absente du ruleset) : repli dans un groupe "subclass" normal
    // plutot que de la faire disparaitre silencieusement.
    const classKeys = new Set(filtered.filter((e) => e.entryType === "class").map((e) => e.key));
    const subclassesByParent = new Map<string, RuleEntrySummary[]>();
    const orphanSubclasses: RuleEntrySummary[] = [];
    for (const entry of filtered) {
      if (entry.entryType !== "subclass") continue;
      if (entry.parentClassKey && classKeys.has(entry.parentClassKey)) {
        const list = subclassesByParent.get(entry.parentClassKey) ?? [];
        list.push(entry);
        subclassesByParent.set(entry.parentClassKey, list);
      } else {
        orphanSubclasses.push(entry);
      }
    }
    for (const list of subclassesByParent.values()) list.sort((a, b) => a.name.localeCompare(b.name));

    const byType = new Map<string, RuleEntrySummary[]>();
    for (const entry of filtered) {
      if (entry.entryType === "subclass") continue;
      const list = byType.get(entry.entryType) ?? [];
      list.push(entry);
      byType.set(entry.entryType, list);
    }
    for (const list of byType.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    if (orphanSubclasses.length > 0) {
      byType.set("subclass", [...orphanSubclasses].sort((a, b) => a.name.localeCompare(b.name)));
    }

    return { groups: [...byType.entries()].sort(([a], [b]) => a.localeCompare(b)), subclassesByParent };
  }, [entries, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("ouvrirListe")}
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
          placeholder={t("rechercherRegle")}
          className="rounded-md border border-edge bg-panel-raised px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />

        <nav aria-label={t("reglesDuMonde")} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {groups.length === 0 && <p className="px-1 text-sm text-ink-muted">{t("aucuneRegleTrouvee")}</p>}
          {groups.map(([entryType, items]) => (
            <RuleTypeGroup
              key={entryType}
              entryType={entryType}
              items={items}
              worldSlug={worldSlug}
              currentKey={currentKey}
              onNavigate={() => setOpen(false)}
              subclassesByParent={entryType === "class" ? subclassesByParent : undefined}
            />
          ))}
        </nav>

        <div className="border-t border-edge pt-3">
          <RulesetSelector worldSlug={worldSlug} />
        </div>
      </aside>
    </>
  );
}
