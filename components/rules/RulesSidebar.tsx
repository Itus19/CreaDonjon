"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useOpenRuleToolLink } from "@/components/shell/useOpenRuleToolLink";
import { useCollapsedGroups } from "@/components/shell/useCollapsedGroups";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "@/components/shell/useMatchMedia";
import { OutilsDalle, Rail, RailPart, useRailReplie } from "@/components/shell/Rail";
import { SectionRailRows } from "@/components/shell/SectionToggle";
import { SectionRecemment } from "@/components/shell/ListeRecents";
import { EnTeteRail } from "@/components/shell/WorldSidebarHeader";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import AddRuleMenu from "@/components/rules/AddRuleMenu";
import { RuleTypeGroup, useCleRegleCourante, useGroupesRegles } from "@/components/rules/SommaireRegles";

/**
 * Barre de l'onglet Regles. V3.1-93 : la liste des regles a quitte la barre
 * pour la zone de travail (`SommaireRegles`, montee par `WindowsDesktop`) ; sur
 * ordinateur il ne reste ici que le rail commun (en-tete, sections, de et
 * radio). Sous 768 px (V3.1-30, inchange) la feuille du bas garde « Recemment »,
 * le filtre, la liste et les boutons d'ajout.
 */
export default function RulesSidebar({ worldSlug, worldName }: { worldSlug: string; worldName: string }) {
  const t = useTranslations("regles");
  const { replie, basculer } = useRailReplie();
  const [open, setOpen] = useState(false);
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);

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
          <div className="flex flex-col gap-3 md:gap-0.5 md:p-2 md:pb-0">
            <EnTeteRail worldSlug={worldSlug} worldName={worldName} replie={replie} />
            {/* V3.1-30 : la bascule Monde/Regles/MJ n'est plus dans la feuille (la
                barre du telephone la remplace) ; « Recemment » prend la tete. */}
            <div className="md:hidden">
              <SectionRecemment worldSlug={worldSlug} espace="mj-regles" onNavigate={() => setOpen(false)} />
            </div>
            <SectionRailRows worldSlug={worldSlug} />
          </div>
          {estTelephone && <ListeTelephone worldSlug={worldSlug} onNavigate={() => setOpen(false)} />}
        </RailPart>
        <OutilsDalle worldSlug={worldSlug} />
      </Rail>
    </>
  );
}

/** Filtre, liste et boutons d'ajout de la feuille du telephone (monte seulement sous 768 px). */
function ListeTelephone({ worldSlug, onNavigate }: { worldSlug: string; onNavigate: () => void }) {
  const entries = useWorldRuleEntries(worldSlug);
  const t = useTranslations("regles");
  const [query, setQuery] = useState("");
  const { isCollapsed, toggle } = useCollapsedGroups(`creadonjon:collapsed:rules:${worldSlug}`);
  const currentKey = useCleRegleCourante();
  const { groups, subclassesByParent, subspeciesByParent, classNameByKey } = useGroupesRegles(entries, query);

  const openNouvelleArme = useOpenRuleToolLink(worldSlug, "nouvelle-arme");
  const openNouvelHistorique = useOpenRuleToolLink(worldSlug, "nouvel-historique");
  const openNouveauDon = useOpenRuleToolLink(worldSlug, "nouveau-don");
  const openNouvelleSousClasse = useOpenRuleToolLink(worldSlug, "nouvelle-sous-classe");
  const openNouveauSort = useOpenRuleToolLink(worldSlug, "nouveau-sort");
  const openBacASable = useOpenRuleToolLink(worldSlug, "bac-a-sable");
  const openBacASableDeclencheurs = useOpenRuleToolLink(worldSlug, "bac-a-sable-declencheurs");

  return (
    <>
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
            onNavigate={onNavigate}
            childrenByParent={entryType === "class" ? subclassesByParent : entryType === "species" ? subspeciesByParent : undefined}
            classNameByKey={entryType === "feature" ? classNameByKey : undefined}
            collapsed={isCollapsed(entryType)}
            onToggle={() => toggle(entryType)}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-2 border-t border-edge pt-3">
        <AddRuleMenu
          label={t("ajouterUneRegle")}
          onNavigate={onNavigate}
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
            onNavigate();
          }}
          className="block w-full rounded-full border border-edge px-4 py-2 text-center text-sm font-medium text-ink transition-colors hover:bg-panel-raised"
        >
          {t("bacASable")}
        </Link>
        <Link
          href={openBacASableDeclencheurs.href}
          onClick={(e) => {
            openBacASableDeclencheurs.onClick(e);
            onNavigate();
          }}
          className="block w-full rounded-full border border-edge px-4 py-2 text-center text-sm font-medium text-ink transition-colors hover:bg-panel-raised"
        >
          {t("bacASableDeclencheurs")}
        </Link>
        {/* V3.1-132 : la vue des règles à rendre jouables ; page serveur réservée au MJ. */}
        <Link
          href={`/m/${encodeURIComponent(worldSlug)}/regles/non-jouables`}
          onClick={() => onNavigate()}
          className="block w-full rounded-full border border-edge px-4 py-2 text-center text-sm font-medium text-ink transition-colors hover:bg-panel-raised"
        >
          {t("briques.nonJouablesLien")}
        </Link>
      </div>
    </>
  );
}
