"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { RuleEntrySummary } from "@/src/server/services/rules";
import { useOpenRuleLink } from "@/components/shell/useOpenRuleLink";
import { useOpenRuleToolLink } from "@/components/shell/useOpenRuleToolLink";
import { useCollapsedGroups } from "@/components/shell/useCollapsedGroups";
import { useRecents } from "@/components/shell/useRecents";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import AddRuleMenu from "@/components/rules/AddRuleMenu";

/** Lien vers une règle : s'ouvre dans la zone de travail (volets) sur ordinateur, navigue sur téléphone. */
export function RuleEntryLink({
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
  onNavigate?: () => void;
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
        onNavigate?.();
      }}
      aria-current={entry.key === currentKey ? "page" : undefined}
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
export function RuleTypeGroup({
  entryType,
  items,
  worldSlug,
  currentKey,
  onNavigate,
  childrenByParent,
  classNameByKey,
  collapsed,
  onToggle,
  afficherNombre = false,
}: {
  entryType: string;
  items: RuleEntrySummary[];
  worldSlug: string;
  currentKey: string | null;
  onNavigate?: () => void;
  childrenByParent?: Map<string, RuleEntrySummary[]>;
  /** Nom de classe par `entry_key` de classe (ticket #57) — seulement fourni pour le groupe "feature", sert à désambiguer les noms d'Aptitude partagés par plusieurs classes ("Sorts", "Amélioration de caractéristique"...). */
  classNameByKey?: Map<string, string>;
  collapsed: boolean;
  onToggle: () => void;
  /** V3.1-93 : le sommaire de la fenêtre montre le nombre de fiches (sous-classes et sous-espèces comprises) ; la feuille du téléphone, non. */
  afficherNombre?: boolean;
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

  const nombre = items.reduce((total, entry) => total + 1 + (childrenByParent?.get(entry.key)?.length ?? 0), 0);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? t("replier") : t("deplier")}
        className="flex w-full items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted"
      >
        <span className="w-3 text-xs">{expanded ? "▾" : "▸"}</span>
        {entryTypeLabels[entryType] ?? entryType}
        {afficherNombre && <span className="ml-auto font-normal normal-case tracking-normal">{nombre}</span>}
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

/** Règle ouverte, lue dans l'adresse (`/regles/<clé>`) ; `null` sur l'accueil et sur les outils sans clé de règle. */
export function useCleRegleCourante(): string | null {
  const pathname = usePathname();
  const match = pathname.match(/\/regles\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Filtre local + regroupement par entry_type. Pas de recherche serveur —
 * quelques milliers d'entrees filtrees en memoire suffisent, meme ordre de
 * grandeur que la liste d'entites d'un monde deja geree ainsi.
 */
export function useGroupesRegles(entries: RuleEntrySummary[], query: string) {
  return useMemo(() => {
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
}

/** Une pastille de « Récemment » : une règle s'ouvre comme depuis la liste (volet), tout autre lien navigue. */
function PastilleRecente({ worldSlug, href, titre }: { worldSlug: string; href: string; titre: string }) {
  const cle = href.match(/\/regles\/([^/]+)$/)?.[1];
  const link = useOpenRuleLink(worldSlug, cle ? decodeURIComponent(cle) : "");
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={(e) => {
        if (cle) link.onClick(e);
      }}
      className="max-w-full truncate rounded-full border border-edge px-2 py-px text-xs text-ink-soft transition-colors hover:bg-panel-raised hover:text-ink"
    >
      {titre}
    </Link>
  );
}

/**
 * Sommaire des règles dans la zone de travail (V3.1-93), colonne de 250 px
 * montée par `WindowsDesktop` : recherche, « Récemment » (lu dans le
 * navigateur, même clé que le téléphone), catégories repliables avec leur
 * nombre de fiches, puis en pied les menus « Ajouter une règle » et
 * « Bacs à sable ». Chaque geste ouvre sa fiche en volet (`useOpenRuleLink`,
 * `useOpenRuleToolLink`), comme l'ancienne barre.
 */
export default function SommaireRegles({ worldSlug }: { worldSlug: string }) {
  const entries = useWorldRuleEntries(worldSlug);
  const t = useTranslations("regles");
  const tLecteur = useTranslations("lecteur");
  const [query, setQuery] = useState("");
  const { isCollapsed, toggle } = useCollapsedGroups(`creadonjon:collapsed:rules:${worldSlug}`);
  const currentKey = useCleRegleCourante();
  const recents = useRecents(worldSlug, "mj-regles");
  const { groups, subclassesByParent, subspeciesByParent, classNameByKey } = useGroupesRegles(entries, query);

  // Fenetres de creation de regle et bacs a sable : memes hooks que l'ancienne
  // barre, jamais une navigation qui fermerait le brouillon d'une autre fiche.
  const openNouvelleArme = useOpenRuleToolLink(worldSlug, "nouvelle-arme");
  const openNouvelHistorique = useOpenRuleToolLink(worldSlug, "nouvel-historique");
  const openNouveauDon = useOpenRuleToolLink(worldSlug, "nouveau-don");
  const openNouvelleSousClasse = useOpenRuleToolLink(worldSlug, "nouvelle-sous-classe");
  const openNouveauSort = useOpenRuleToolLink(worldSlug, "nouveau-sort");
  const openBacASable = useOpenRuleToolLink(worldSlug, "bac-a-sable");
  const openBacASableDeclencheurs = useOpenRuleToolLink(worldSlug, "bac-a-sable-declencheurs");

  const recentes = query.trim() === "" ? recents.slice(0, 5) : [];

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 border-r border-edge bg-panel-sunken px-2.5 py-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("rechercherRegle")}
        aria-label={t("rechercherRegle")}
        className="w-full rounded-full border border-edge bg-panel px-3 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-ink-muted"
      />

      <nav aria-label={t("sommaireRegles")} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden">
        {recentes.length > 0 && (
          <section className="flex flex-col gap-1 pb-1">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{tLecteur("recemment")}</h2>
            <div className="flex flex-wrap gap-1">
              {recentes.map((r) => (
                <PastilleRecente key={r.href} worldSlug={worldSlug} href={r.href} titre={r.titre} />
              ))}
            </div>
          </section>
        )}
        {groups.length === 0 && <p className="px-1 text-sm text-ink-muted">{t("aucuneRegleTrouvee")}</p>}
        {groups.map(([entryType, items]) => (
          <RuleTypeGroup
            key={entryType}
            entryType={entryType}
            items={items}
            worldSlug={worldSlug}
            currentKey={currentKey}
            childrenByParent={entryType === "class" ? subclassesByParent : entryType === "species" ? subspeciesByParent : undefined}
            classNameByKey={entryType === "feature" ? classNameByKey : undefined}
            collapsed={isCollapsed(entryType)}
            onToggle={() => toggle(entryType)}
            afficherNombre
          />
        ))}
      </nav>

      <div className="flex shrink-0 flex-col gap-1.5 border-t border-edge pt-2">
        <AddRuleMenu
          label={t("ajouterUneRegleMenu")}
          items={[
            { href: openNouvelleArme.href, label: t("creerArmeMaison"), onClick: openNouvelleArme.onClick },
            { href: openNouvelHistorique.href, label: t("creerHistoriqueMaison"), onClick: openNouvelHistorique.onClick },
            { href: openNouveauDon.href, label: t("creerDonMaison"), onClick: openNouveauDon.onClick },
            { href: openNouvelleSousClasse.href, label: t("creerSousClasseMaison"), onClick: openNouvelleSousClasse.onClick },
            { href: openNouveauSort.href, label: t("creerSortMaison"), onClick: openNouveauSort.onClick },
          ]}
        />
        <AddRuleMenu
          contour
          label={t("bacsASableMenu")}
          items={[
            { href: openBacASable.href, label: t("bacASable"), onClick: openBacASable.onClick },
            { href: openBacASableDeclencheurs.href, label: t("bacASableDeclencheurs"), onClick: openBacASableDeclencheurs.onClick },
          ]}
        />
      </div>
    </div>
  );
}
