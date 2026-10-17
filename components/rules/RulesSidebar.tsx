"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { RuleEntrySummary } from "@/src/server/services/rules";
import { useOpenRuleLink } from "@/components/shell/useOpenRuleLink";
import { useOpenRuleToolLink } from "@/components/shell/useOpenRuleToolLink";
import { useCollapsedGroups } from "@/components/shell/useCollapsedGroups";
import { classeItemFlyout, IconeRail, OutilsDalle, Rail, RailFilet, RailPart, RailRow, TraitSvg, useRailReplie } from "@/components/shell/Rail";
import { SectionRailRows } from "@/components/shell/SectionToggle";
import { SectionRecemment } from "@/components/shell/ListeRecents";
import { EnTeteRail } from "@/components/shell/WorldSidebarHeader";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import AddRuleMenu from "@/components/rules/AddRuleMenu";

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

/** Entree d'un menu de categorie (rail replie) : meme lien et meme ouverture de fenetre que dans la liste. */
function RuleMenuLink({
  entry,
  worldSlug,
  currentKey,
  fermer,
  nested,
}: {
  entry: RuleEntrySummary;
  worldSlug: string;
  currentKey: string | null;
  fermer: () => void;
  nested?: boolean;
}) {
  const link = useOpenRuleLink(worldSlug, entry.key);
  return (
    <Link
      role="menuitem"
      href={link.href}
      onClick={(e) => {
        link.onClick(e);
        fermer();
      }}
      className={classeItemFlyout(entry.key === currentKey)}
      style={nested ? { paddingLeft: "20px" } : undefined}
    >
      {entry.name}
    </Link>
  );
}

/** Icone de la categorie, rail replie. Un type inconnu retombe sur les livres. */
function IconeCategorie({ entryType }: { entryType: string }) {
  switch (entryType) {
    case "spell":
      return (
        <TraitSvg>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
        </TraitSvg>
      );
    case "class":
    case "subclass":
    case "feature":
      return <IconeRail nom="bouclier" />;
    case "monster":
      return (
        <TraitSvg>
          <path d="M12 3c3 0 6 2.5 6 6 0 2-1 3-1 5 0 3-2 6-5 7-3-1-5-4-5-7 0-2-1-3-1-5 0-3.5 3-6 6-6Z" />
          <path d="M9.5 10h.01M14.5 10h.01" />
        </TraitSvg>
      );
    case "item":
    case "weapon":
    case "armor":
    case "magic_item":
    case "mount":
      return (
        <TraitSvg>
          <path d="M5 8h14l-1 12H6L5 8Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </TraitSvg>
      );
    default:
      return <IconeRail nom="livres" />;
  }
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
export default function RulesSidebar({ worldSlug, worldName }: { worldSlug: string; worldName: string }) {
  const entries = useWorldRuleEntries(worldSlug);
  const t = useTranslations("regles");
  const entryTypeLabels = t.raw("entryTypes") as Record<string, string>;
  const { replie, basculer } = useRailReplie();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { isCollapsed, toggle } = useCollapsedGroups(`creadonjon:collapsed:rules:${worldSlug}`);
  const pathname = usePathname();
  const match = pathname.match(/\/regles\/([^/]+)/);
  const currentKey = match ? decodeURIComponent(match[1]) : null;

  // Fenetres flottantes de creation de regle (retour utilisateur, V2 —
  // "comme les autres fiches") : memes hooks `useOpenXLink` que les entrees
  // de regle/outils MJ, jamais une simple navigation qui fermerait le
  // brouillon en cours d'une autre fenetre deja ouverte.
  const openNouvelleArme = useOpenRuleToolLink(worldSlug, "nouvelle-arme");
  const openNouvelHistorique = useOpenRuleToolLink(worldSlug, "nouvel-historique");
  const openNouveauDon = useOpenRuleToolLink(worldSlug, "nouveau-don");
  const openNouvelleSousClasse = useOpenRuleToolLink(worldSlug, "nouvelle-sous-classe");
  const openNouveauSort = useOpenRuleToolLink(worldSlug, "nouveau-sort");
  const openBacASable = useOpenRuleToolLink(worldSlug, "bac-a-sable");
  const openBacASableDeclencheurs = useOpenRuleToolLink(worldSlug, "bac-a-sable-declencheurs");

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
        // V2.1-16 : plus d'en-tete au-dessus, donc plus de decalage de 68px.
        className="fixed left-3 top-3 z-40 rounded-md border border-edge bg-panel-raised p-2 text-sm text-ink shadow-md md:hidden"
      >
        ☰
      </button>

      <Rail ouvert={open} replie={replie} onBasculer={basculer} onFermer={() => setOpen(false)} titreFeuille={t("reglesDuMonde")}>
        <RailPart className="md:min-h-0 md:flex-1">
          {/* V2.1-16 — `md:h-screen` retire, meme raison que `Sidebar.tsx` : la
              hauteur vient de la rangee bornee par `AppShell`, pas du viewport.
              Ce bloc regroupe l'en-tete, les sections et le filtre ; sous 768 px
              il reproduit l'espacement d'origine (`gap-3`). */}
          <div className="flex flex-col gap-3 md:gap-0.5 md:p-2 md:pb-0">
            <EnTeteRail worldSlug={worldSlug} worldName={worldName} replie={replie} />
            {/* V3.1-30 : la bascule Monde/Regles/MJ n'est plus dans la feuille (la
                barre du telephone la remplace) ; « Recemment » prend la tete. */}
            <div className="md:hidden">
              <SectionRecemment worldSlug={worldSlug} espace="mj-regles" onNavigate={() => setOpen(false)} />
            </div>
            <SectionRailRows worldSlug={worldSlug} />
            <RailFilet />
            {!replie && (
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("rechercherRegle")}
                className="rounded-md border border-edge bg-panel-raised px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted md:mt-1"
              />
            )}
          </div>

          <nav aria-label={t("reglesDuMonde")} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto md:gap-0.5 md:overflow-x-hidden md:p-2">
            {groups.length === 0 && <p className="px-1 text-sm text-ink-muted">{t("aucuneRegleTrouvee")}</p>}
            {replie
              ? // Replie : une ligne par categorie, dont le menu flottant liste ses regles.
                groups.map(([entryType, items]) => {
                  const enfants = entryType === "class" ? subclassesByParent : entryType === "species" ? subspeciesByParent : undefined;
                  return (
                    <RailRow
                      key={entryType}
                      icone={<IconeCategorie entryType={entryType} />}
                      libelle={entryTypeLabels[entryType] ?? entryType}
                      actif={items.some((e) => e.key === currentKey || enfants?.get(e.key)?.some((sub) => sub.key === currentKey))}
                      menu={(fermer) =>
                        items.flatMap((entry) => [
                          <RuleMenuLink key={entry.key} entry={entry} worldSlug={worldSlug} currentKey={currentKey} fermer={fermer} />,
                          ...(enfants?.get(entry.key) ?? []).map((sub) => (
                            <RuleMenuLink key={sub.key} entry={sub} worldSlug={worldSlug} currentKey={currentKey} fermer={fermer} nested />
                          )),
                        ])
                      }
                    />
                  );
                })
              : groups.map(([entryType, items]) => (
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

          <div className="flex flex-col gap-2 border-t border-edge pt-3 md:border-0 md:p-2 md:pt-0">
            {replie ? (
              // Replie, le menu deroulant et les deux boutons de bas de liste
              // tiendraient mal dans 64 px : une ligne en pointilles, dont le menu
              // reprend les memes sept liens.
              <RailRow
                pointille
                icone={<IconeRail nom="plus" />}
                libelle={t("ajouterUneRegle")}
                menu={(fermer) =>
                  [
                    { cle: "arme", etiquette: t("creerArmeMaison"), lien: openNouvelleArme },
                    { cle: "historique", etiquette: t("creerHistoriqueMaison"), lien: openNouvelHistorique },
                    { cle: "don", etiquette: t("creerDonMaison"), lien: openNouveauDon },
                    { cle: "sous-classe", etiquette: t("creerSousClasseMaison"), lien: openNouvelleSousClasse },
                    { cle: "sort", etiquette: t("creerSortMaison"), lien: openNouveauSort },
                    { cle: "bac", etiquette: t("bacASable"), lien: openBacASable },
                    { cle: "declencheurs", etiquette: t("bacASableDeclencheurs"), lien: openBacASableDeclencheurs },
                  ].map(({ cle, etiquette, lien }) => (
                    <Link
                      key={cle}
                      role="menuitem"
                      href={lien.href}
                      onClick={(e) => {
                        lien.onClick(e);
                        fermer();
                      }}
                      className={classeItemFlyout(false)}
                    >
                      {etiquette}
                    </Link>
                  ))
                }
              />
            ) : (
              <>
                <AddRuleMenu
                  label={t("ajouterUneRegle")}
                  onNavigate={() => setOpen(false)}
                  items={[
                    { href: openNouvelleArme.href, label: t("creerArmeMaison"), onClick: openNouvelleArme.onClick },
                    { href: openNouvelHistorique.href, label: t("creerHistoriqueMaison"), onClick: openNouvelHistorique.onClick },
                    { href: openNouveauDon.href, label: t("creerDonMaison"), onClick: openNouveauDon.onClick },
                    { href: openNouvelleSousClasse.href, label: t("creerSousClasseMaison"), onClick: openNouvelleSousClasse.onClick },
                    { href: openNouveauSort.href, label: t("creerSortMaison"), onClick: openNouveauSort.onClick },
                  ]}
                />
                <Link
                  href={openBacASable.href}
                  onClick={(e) => {
                    openBacASable.onClick(e);
                    setOpen(false);
                  }}
                  className="block w-full rounded-full border border-edge px-4 py-2 text-center text-sm font-medium text-ink transition-colors hover:bg-panel-raised"
                >
                  {t("bacASable")}
                </Link>
                <Link
                  href={openBacASableDeclencheurs.href}
                  onClick={(e) => {
                    openBacASableDeclencheurs.onClick(e);
                    setOpen(false);
                  }}
                  className="block w-full rounded-full border border-edge px-4 py-2 text-center text-sm font-medium text-ink transition-colors hover:bg-panel-raised"
                >
                  {t("bacASableDeclencheurs")}
                </Link>
              </>
            )}
          </div>
        </RailPart>
        <OutilsDalle worldSlug={worldSlug} />
      </Rail>
    </>
  );
}
