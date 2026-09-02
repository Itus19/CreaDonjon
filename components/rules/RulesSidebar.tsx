"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { RuleEntrySummary } from "@/src/server/services/rules";
import { useOpenRuleLink } from "@/components/shell/useOpenRuleLink";
import { useCollapsedGroups } from "@/components/shell/useCollapsedGroups";
import SectionToggle from "@/components/shell/SectionToggle";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";

function RuleEntryLink({
  entry,
  worldSlug,
  currentKey,
  onNavigate,
  nested,
  disambiguation,
}: {
  entry: RuleEntrySummary;
  worldSlug: string;
  currentKey: string | null;
  onNavigate: () => void;
  nested?: boolean;
  /** Nom de classe affiché en retrait sous le nom (ticket #57) — seulement pour les Aptitudes dont le nom est partagé par plusieurs classes. */
  disambiguation?: string;
}) {
  const link = useOpenRuleLink(worldSlug, entry.key);
  return (
    <Link
      href={link.href}
      onClick={(e) => {
        link.onClick(e);
        onNavigate();
      }}
      className={`block truncate rounded px-2 py-1 text-sm transition-colors hover:bg-panel-raised ${
        entry.key === currentKey ? "bg-panel-raised text-accent" : "text-ink-soft"
      }`}
      style={nested ? { paddingLeft: "22px" } : undefined}
    >
      {entry.name}
      {disambiguation && <span className="ml-1 text-xs text-ink-muted">— {disambiguation}</span>}
    </Link>
  );
}

/**
 * Un groupe par entry_type, pliable (meme motif que NodeRow dans
 * components/shell/EntityTree.tsx). `childrenByParent` (V1-D7, sur retour
 * utilisateur : "je dois pouvoir trouver Évocateur sous Magicien", puis
 * "les sous-especes dependantes de leur espece principale") n'est fourni
 * que par les groupes Classe et Espece — chaque sous-classe/sous-espece
 * s'affiche directement sous son parent (`entry.key`), pas dans un groupe
 * a part.
 */
function RuleTypeGroup({
  entryType,
  items,
  worldSlug,
  currentKey,
  onNavigate,
  childrenByParent,
  classNameByKey,
  collapsed,
  onToggle,
}: {
  entryType: string;
  items: RuleEntrySummary[];
  worldSlug: string;
  currentKey: string | null;
  onNavigate: () => void;
  childrenByParent?: Map<string, RuleEntrySummary[]>;
  /** Nom de classe par `entry_key` de classe (ticket #57) — seulement fourni pour le groupe "feature", sert à désambiguer les noms d'Aptitude partagés par plusieurs classes ("Sorts", "Amélioration de caractéristique"...). */
  classNameByKey?: Map<string, string>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("shell");
  const tRegles = useTranslations("regles");
  const entryTypeLabels = tRegles.raw("entryTypes") as Record<string, string>;
  const expanded = !collapsed;

  // Un nom n'est desambigue que s'il est vraiment partage par plusieurs
  // fiches de ce groupe — jamais un suffixe systematique qui alourdirait
  // les Aptitudes deja uniques (la grande majorite).
  const duplicateNames = useMemo(() => {
    if (!classNameByKey) return null;
    const counts = new Map<string, number>();
    for (const entry of items) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
  }, [items, classNameByKey]);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
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
              <RuleEntryLink
                entry={entry}
                worldSlug={worldSlug}
                currentKey={currentKey}
                onNavigate={onNavigate}
                disambiguation={
                  duplicateNames?.has(entry.name) && entry.parentClassKey
                    ? classNameByKey?.get(entry.parentClassKey)
                    : undefined
                }
              />
              {childrenByParent?.get(entry.key)?.map((sub) => (
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
export default function RulesSidebar({ worldSlug }: { worldSlug: string }) {
  const entries = useWorldRuleEntries(worldSlug);
  const t = useTranslations("regles");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { isCollapsed, toggle } = useCollapsedGroups(`creadonjon:collapsed:rules:${worldSlug}`);
  const pathname = usePathname();
  const match = pathname.match(/\/regles\/([^/]+)/);
  const currentKey = match ? decodeURIComponent(match[1]) : null;

  const { groups, subclassesByParent, subspeciesByParent, classNameByKey } = useMemo(() => {
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

    // Sous-espece nichee sous son espece (V1-D7, sur retour utilisateur),
    // meme principe que sous-classe/classe ci-dessus — mais sans repli
    // "orphelins" distinct : contrairement a Sous-classe, une sous-espece
    // partage `entryType: "species"` avec son parent (la 5.2.1 n'a pas
    // d'entry_type dedie), donc une sous-espece dont le parent est absent
    // du filtre reste deja dans le groupe "species" normal ci-dessous, sans
    // rien retirer a part.
    const speciesKeys = new Set(filtered.filter((e) => e.entryType === "species" && !e.parentSpeciesKey).map((e) => e.key));
    const subspeciesByParent = new Map<string, RuleEntrySummary[]>();
    for (const entry of filtered) {
      if (entry.entryType !== "species" || !entry.parentSpeciesKey) continue;
      if (!speciesKeys.has(entry.parentSpeciesKey)) continue;
      const list = subspeciesByParent.get(entry.parentSpeciesKey) ?? [];
      list.push(entry);
      subspeciesByParent.set(entry.parentSpeciesKey, list);
    }
    for (const list of subspeciesByParent.values()) list.sort((a, b) => a.name.localeCompare(b.name));

    const byType = new Map<string, RuleEntrySummary[]>();
    for (const entry of filtered) {
      if (entry.entryType === "subclass") continue;
      if (entry.entryType === "species" && entry.parentSpeciesKey && speciesKeys.has(entry.parentSpeciesKey)) continue;
      const list = byType.get(entry.entryType) ?? [];
      list.push(entry);
      byType.set(entry.entryType, list);
    }
    for (const list of byType.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    if (orphanSubclasses.length > 0) {
      byType.set("subclass", [...orphanSubclasses].sort((a, b) => a.name.localeCompare(b.name)));
    }

    // Nom de classe par cle (ticket #57) : construit sur `entries` en
    // entier, jamais sur `filtered` — une recherche qui exclut le groupe
    // Classe ne doit pas priver les Aptitudes filtrees de leur suffixe.
    const classNameByKey = new Map(entries.filter((e) => e.entryType === "class").map((e) => [e.key, e.name]));

    return { groups: [...byType.entries()].sort(([a], [b]) => a.localeCompare(b)), subclassesByParent, subspeciesByParent, classNameByKey };
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
        <SectionToggle worldSlug={worldSlug} />
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
              childrenByParent={entryType === "class" ? subclassesByParent : entryType === "species" ? subspeciesByParent : undefined}
              classNameByKey={entryType === "feature" ? classNameByKey : undefined}
              collapsed={isCollapsed(entryType)}
              onToggle={() => toggle(entryType)}
            />
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t border-edge pt-3">
          <Link
            href={`/m/${worldSlug}/regles/nouvelle-arme`}
            onClick={() => setOpen(false)}
            className="block w-full rounded-full bg-accent px-4 py-2 text-center text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
          >
            {t("creerArmeMaison")}
          </Link>
          <Link
            href={`/m/${worldSlug}/regles/nouvel-historique`}
            onClick={() => setOpen(false)}
            className="block w-full rounded-full border border-edge px-4 py-2 text-center text-sm font-medium text-ink transition-colors hover:bg-panel-raised"
          >
            {t("creerHistoriqueMaison")}
          </Link>
          <Link
            href={`/m/${worldSlug}/regles/bac-a-sable`}
            onClick={() => setOpen(false)}
            className="block w-full rounded-full border border-edge px-4 py-2 text-center text-sm font-medium text-ink transition-colors hover:bg-panel-raised"
          >
            {t("bacASable")}
          </Link>
        </div>
      </aside>
    </>
  );
}
