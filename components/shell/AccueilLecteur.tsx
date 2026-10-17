"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  filterEntityTree,
  type EntityTreeNode,
} from "@/src/core/entity-tree/build-tree";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import type { EspaceRecents } from "@/lib/ui/recents";
import { createBlankEntityAction } from "@/app/m/[worldSlug]/actions";
import { useArbreLecteur } from "./ArbreLecteurContext";
import ListeRecents from "./ListeRecents";

/** Nombre maximal de résultats de règles montrés : la liste du monde compte des milliers d'entrées. */
const MAX_RESULTATS_REGLES = 40;

const CLASSE_LIEN =
  "flex items-baseline justify-between gap-3 rounded px-2 py-2 text-sm text-ink-soft transition-colors hover:bg-panel-raised hover:text-ink";

/** Les noeuds d'un groupe, enfants compris, à plat (parcours en profondeur). */
function aplatir(noeuds: EntityTreeNode[]): EntityTreeNode[] {
  return noeuds.flatMap((n) => [n, ...aplatir(n.children)]);
}

/** Recherche locale dans l'arbre déjà chargé par le layout (même filtre que `BookSkin`). */
function ResultatsEntites({
  hrefBase,
  requete,
}: {
  hrefBase: string;
  requete: string;
}) {
  const t = useTranslations("shell");
  const arbre = useArbreLecteur();
  const kindLabels = t.raw("kindLabels") as Record<string, string>;
  const groupes = useMemo(
    () => filterEntityTree(arbre, requete),
    [arbre, requete],
  );

  if (groupes.length === 0)
    return <p className="text-sm text-ink-muted">{t("aucunResultat")}</p>;
  return (
    <div className="flex flex-col gap-3">
      {groupes.map((g) => (
        <div key={g.kind}>
          <div className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {kindLabels[g.kind] ?? g.kind}
          </div>
          <ul>
            {aplatir(g.items).map((n) => (
              <li key={n.id}>
                <Link
                  href={`${hrefBase}/${n.slug}`}
                  prefetch={false}
                  className={CLASSE_LIEN}
                >
                  <span className="min-w-0 truncate">{n.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Recherche locale dans la liste des règles du monde (même filtre par nom que les barres latérales). */
function ResultatsRegles({
  worldSlug,
  hrefBase,
  requete,
}: {
  worldSlug: string;
  hrefBase: string;
  requete: string;
}) {
  const t = useTranslations("regles");
  const entrees = useWorldRuleEntries(worldSlug);
  const libelles = t.raw("entryTypes") as Record<string, string>;
  const trouvees = useMemo(() => {
    const q = requete.trim().toLowerCase();
    return entrees
      .filter((e) => e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .slice(0, MAX_RESULTATS_REGLES);
  }, [entrees, requete]);

  if (trouvees.length === 0)
    return <p className="text-sm text-ink-muted">{t("aucuneRegleTrouvee")}</p>;
  return (
    <ul>
      {trouvees.map((e) => (
        <li key={e.key}>
          <Link
            href={`${hrefBase}/${e.key}`}
            prefetch={false}
            className={CLASSE_LIEN}
          >
            <span className="min-w-0 truncate">{e.name}</span>
            <span className="shrink-0 text-xs text-ink-muted">
              {libelles[e.entryType] ?? e.entryType}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Écran d'accueil de Monde (MJ), Wiki (joueur) et Règles (MJ et joueur) sur
 * téléphone (V3.1-30), sous 768 px seulement : titre, recherche locale et
 * « Consultées récemment ». Le ☰ du sommaire complet est celui de la
 * coquille (fixé en haut à gauche, hors de ce composant) : l'accueil lui
 * laisse la place par le rembourrage de la page.
 *
 * La recherche ne charge rien : elle filtre ce que la page a déjà (l'arbre du
 * layout, ou la liste des règles que la barre latérale charge de toute façon).
 * Pendant la frappe, les résultats prennent la place de la liste récente.
 *
 * `worldId` : seulement pour Monde (MJ) — le « + » crée une entité vierge,
 * avec la même action que « Nouvelle entité » de la barre latérale.
 */
export default function AccueilLecteur({
  worldSlug,
  espace,
  worldId,
}: {
  worldSlug: string;
  espace: EspaceRecents;
  worldId?: string;
}) {
  const t = useTranslations("lecteur");
  const tShell = useTranslations("shell");
  const tRegles = useTranslations("regles");
  const [requete, setRequete] = useState("");
  const estRegle = espace === "mj-regles" || espace === "joueur-regles";
  const titre = estRegle
    ? t("titreRegles")
    : espace === "joueur-wiki"
      ? t("titreWiki")
      : t("titreMonde");
  const hrefBase = {
    "mj-monde": `/m/${worldSlug}/f`,
    "mj-regles": `/m/${worldSlug}/regles`,
    "joueur-wiki": `/m/${worldSlug}/joueur/wiki`,
    "joueur-regles": `/m/${worldSlug}/joueur/regles`,
  }[espace];
  const enRecherche = requete.trim() !== "";

  return (
    <div className="flex flex-col gap-4 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-chrome text-xl font-semibold text-ink">{titre}</h1>
        {worldId && (
          <form action={createBlankEntityAction}>
            <input type="hidden" name="worldId" value={worldId} />
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <button
              type="submit"
              aria-label={t("nouvelleEntiteCourt")}
              title={tShell("nouvelleEntite")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-lg font-medium leading-none text-accent-ink transition-colors hover:bg-accent-hover"
            >
              +
            </button>
          </form>
        )}
      </div>

      <input
        type="search"
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        placeholder={
          estRegle ? tRegles("rechercherRegle") : tShell("rechercherEntite")
        }
        aria-label={
          estRegle ? tRegles("rechercherRegle") : tShell("rechercherEntite")
        }
        className="w-full rounded-md border border-edge bg-panel-raised px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted"
      />

      {enRecherche ? (
        <section aria-label={t("resultats")}>
          {estRegle ? (
            <ResultatsRegles
              worldSlug={worldSlug}
              hrefBase={hrefBase}
              requete={requete}
            />
          ) : (
            <ResultatsEntites hrefBase={hrefBase} requete={requete} />
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t("consulteesRecemment")}
          </h2>
          <ListeRecents
            worldSlug={worldSlug}
            espace={espace}
            messageVide={t("rienEncore")}
          />
        </section>
      )}
    </div>
  );
}
