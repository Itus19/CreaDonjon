"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { JournalEntry } from "@/src/server/services/activityJournal";
import Tabs from "@/components/shared/Tabs";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import {
  ELEMENTS_JOURNAL,
  FILTRES_VIDES,
  compterParElement,
  compterParPartie,
  compterParQui,
  filtrer,
  initialeDe,
  listerParties,
  listerPersonnes,
  nombreFiltresActifs,
  type ElementJournal,
  type FiltresJournal,
  type LibellesElements,
  type TriJournal,
} from "@/lib/ui/journalHistorique";
import { useCachedGet } from "./useCachedGet";
import JournalCartes from "./journal/JournalCartes";
import JournalChrono from "./journal/JournalChrono";
import { CaseFacette, Puce, RangeeFiltre } from "./journal/JournalFiltres";
import type { EntreeJournal } from "./journal/types";

type Vue = "fiches" | "chrono";

const TRIS: TriJournal[] = ["recent", "ancien", "personne", "fiche"];

/** Ajoute la valeur si elle manque, la retire sinon. */
function basculer<T>(liste: T[], valeur: T): T[] {
  return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
}

/**
 * Journal historique de CE monde (V3.1-61) : « Par fiche » ou
 * « Chronologique », avec recherche et filtres (Qui, Élément, Partie
 * modifiée) faits côté client sur les entrées déjà reçues. Les nombres des
 * puces suivent les autres filtres. Sur téléphone, les filtres vivent dans
 * une feuille du bas. Chargement par `useCachedGet` (pas de flash au
 * changement de section) ; aucun autre chargement.
 */
export default function GmJournalPanel({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("journal");
  const tShell = useTranslations("shell");
  const { data } = useCachedGet<{ entries: JournalEntry[] }>(`journal:${worldSlug}`, `/api/worlds/${worldSlug}/journal`);

  const [vue, setVue] = useState<Vue>("fiches");
  const [tri, setTri] = useState<TriJournal>("recent");
  const [filtres, setFiltres] = useState<FiltresJournal>(FILTRES_VIDES);
  const [ouvertes, setOuvertes] = useState<ReadonlySet<number>>(new Set());
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

  const entrees = useMemo<EntreeJournal[] | null>(() => data?.entries.map((entree, id) => ({ ...entree, id })) ?? null, [data]);

  const libelles = useMemo<LibellesElements>(
    () => Object.fromEntries(ELEMENTS_JOURNAL.map((e) => [e, t(`elements.${e}`)])) as LibellesElements,
    [t],
  );

  function typeDe(entree: EntreeJournal): string {
    if (entree.entityKind === null) return t("sansFiche");
    if (entree.entityKind === "character") return tShell(entree.pc ? "kindLabels.pj" : "kindLabels.pnj");
    const cle = `kindLabelsSingular.${entree.entityKind}`;
    return tShell.has(cle) ? tShell(cle) : tShell("kindLabelsSingular.other");
  }

  const modifier = (partiel: Partial<FiltresJournal>) => setFiltres((courant) => ({ ...courant, ...partiel }));
  const effacer = () => setFiltres(FILTRES_VIDES);
  const seulementFiche = (slug: string) => modifier({ fiche: slug });

  const tous = entrees ?? [];
  const resultats = filtrer(tous, filtres, libelles);
  const nbActifs = nombreFiltresActifs(filtres);
  const personnes = listerPersonnes(tous);
  const parties = listerParties(tous);
  const comptesQui = compterParQui(tous, filtres, libelles);
  const comptesElement = compterParElement(tous, filtres, libelles);
  const comptesPartie = compterParPartie(tous, filtres, libelles);
  const nomFiche = filtres.fiche === null ? null : (tous.find((e) => e.entitySlug === filtres.fiche)?.entityName ?? filtres.fiche);

  const etiquettes: { cle: string; libelle: string; retirer: () => void }[] = [
    ...filtres.qui.map((nom) => ({ cle: `qui:${nom}`, libelle: nom, retirer: () => modifier({ qui: basculer(filtres.qui, nom) }) })),
    ...filtres.elements.map((el) => ({ cle: `el:${el}`, libelle: libelles[el], retirer: () => modifier({ elements: basculer(filtres.elements, el) }) })),
    ...filtres.parties.map((p) => ({ cle: `pa:${p}`, libelle: p, retirer: () => modifier({ parties: basculer(filtres.parties, p) }) })),
    ...(filtres.fiche !== null && nomFiche !== null ? [{ cle: "fiche", libelle: nomFiche, retirer: () => modifier({ fiche: null }) }] : []),
    ...(filtres.q.trim() !== "" ? [{ cle: "q", libelle: `« ${filtres.q.trim()} »`, retirer: () => modifier({ q: "" }) }] : []),
  ];

  const comptage = nbActifs > 0 ? t("modificationsSur", { n: resultats.length, total: tous.length }) : t("modifications", { n: resultats.length });

  const puceQui = (nom: string) => (
    <Puce key={nom} actif={filtres.qui.includes(nom)} compte={comptesQui.get(nom) ?? 0} avatar={initialeDe(nom)} onClick={() => modifier({ qui: basculer(filtres.qui, nom) })}>
      {nom}
    </Puce>
  );
  const puceElement = (el: ElementJournal) => (
    <Puce key={el} actif={filtres.elements.includes(el)} compte={comptesElement[el]} onClick={() => modifier({ elements: basculer(filtres.elements, el) })}>
      {libelles[el]}
    </Puce>
  );

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-edge bg-panel-sunken p-4">
      <h2 className="block-title text-base">{t("titre")}</h2>
      {entrees === null && <p className="text-xs text-ink-muted">{t("chargement")}</p>}
      {entrees && entrees.length === 0 && <p className="text-xs text-ink-muted">{t("aucuneActivite")}</p>}
      {entrees && entrees.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              aria-label={t("vues.ariaLabel")}
              value={vue}
              onChange={setVue}
              className="w-full max-w-[300px]"
              items={[
                { value: "fiches", label: t("vues.parFiche") },
                { value: "chrono", label: t("vues.chronologique") },
              ]}
            />
            <label className="flex min-w-0 flex-1 basis-56 items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1 text-sm focus-within:border-accent">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-ink-muted">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4-4" />
              </svg>
              <input
                value={filtres.q}
                onChange={(e) => modifier({ q: e.target.value })}
                placeholder={t("rechercheMarque")}
                aria-label={t("rechercheAria")}
                className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-muted"
              />
            </label>
            <button
              type="button"
              onClick={() => setFeuilleOuverte(true)}
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised md:hidden"
            >
              {nbActifs > 0 ? t("filtresActifs", { n: nbActifs }) : t("filtres")}
            </button>
          </div>

          <div className="hidden flex-col gap-1.5 md:flex">
            <RangeeFiltre libelle={t("qui")}>{personnes.map(puceQui)}</RangeeFiltre>
            <RangeeFiltre libelle={t("element")}>{ELEMENTS_JOURNAL.map(puceElement)}</RangeeFiltre>
            {vue === "chrono" && (
              <RangeeFiltre libelle={t("trier")}>
                {TRIS.map((valeur) => (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={tri === valeur}
                    onClick={() => setTri(valeur)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      tri === valeur ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-soft hover:bg-panel-raised"
                    }`}
                  >
                    {t(`tris.${valeur}`)}
                  </button>
                ))}
              </RangeeFiltre>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted" aria-live="polite">
            <span>{comptage}</span>
            {etiquettes.map((etiquette) => (
              <span key={etiquette.cle} className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent/10 py-0.5 pl-2.5 pr-1 text-accent">
                {etiquette.libelle}
                <button type="button" onClick={etiquette.retirer} aria-label={t("retirerFiltre", { nom: etiquette.libelle })} className="px-1 hover:text-ink">
                  ×
                </button>
              </span>
            ))}
            {nbActifs > 0 && (
              <button type="button" onClick={effacer} className="px-1 text-accent hover:underline">
                {t("toutEffacer")}
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {resultats.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">{t("aucunResultat")}</p>
            ) : vue === "fiches" ? (
              <JournalCartes entrees={resultats} typeDe={typeDe} onSeulementFiche={seulementFiche} />
            ) : (
              <JournalChrono
                entrees={resultats}
                tri={tri}
                typeDe={typeDe}
                ouvertes={ouvertes}
                onBasculer={(id) => setOuvertes((courant) => new Set(basculer([...courant], id)))}
                onSeulementFiche={seulementFiche}
              />
            )}
          </div>
        </>
      )}

      {feuilleOuverte && (
        <FeuilleDuBas titre={t("feuilleTitre")} titreVisible onFermer={() => setFeuilleOuverte(false)}>
          <div className="flex flex-col gap-1 pb-2">
            <div className="flex items-center justify-end">
              <button type="button" onClick={effacer} className="px-1 text-xs text-accent hover:underline">
                {t("toutEffacer")}
              </button>
            </div>
            {vue === "chrono" && (
              <>
                <span className="pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("trier")}</span>
                <div className="flex flex-wrap gap-1.5 pb-2">
                  {TRIS.map((valeur) => (
                    <button
                      key={valeur}
                      type="button"
                      aria-pressed={tri === valeur}
                      onClick={() => setTri(valeur)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        tri === valeur ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-soft hover:bg-panel-sunken"
                      }`}
                    >
                      {t(`tris.${valeur}`)}
                    </button>
                  ))}
                </div>
              </>
            )}
            <span className="pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("qui")}</span>
            {personnes.map((nom) => (
              <CaseFacette key={nom} actif={filtres.qui.includes(nom)} compte={comptesQui.get(nom) ?? 0} onClick={() => modifier({ qui: basculer(filtres.qui, nom) })}>
                {nom}
              </CaseFacette>
            ))}
            <span className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("element")}</span>
            {ELEMENTS_JOURNAL.map((el) => (
              <CaseFacette key={el} actif={filtres.elements.includes(el)} compte={comptesElement[el]} onClick={() => modifier({ elements: basculer(filtres.elements, el) })}>
                {libelles[el]}
              </CaseFacette>
            ))}
            {parties.length > 0 && <span className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("partie")}</span>}
            {parties.map((partie) => (
              <CaseFacette key={partie} actif={filtres.parties.includes(partie)} compte={comptesPartie.get(partie) ?? 0} onClick={() => modifier({ parties: basculer(filtres.parties, partie) })}>
                {partie}
              </CaseFacette>
            ))}
            <button
              type="button"
              onClick={() => setFeuilleOuverte(false)}
              className="mt-3 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
            >
              {t("voirResultats", { n: resultats.length })}
            </button>
          </div>
        </FeuilleDuBas>
      )}
    </div>
  );
}
