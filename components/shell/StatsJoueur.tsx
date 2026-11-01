"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Tabs from "@/components/shared/Tabs";
import { TITLE_FAMILIES } from "@/src/core/stats/titleTiers";
import type { PlayerStatsView } from "@/src/server/services/playerStats";
import { chargerStatsJoueurApi, type PorteeStats } from "@/lib/ui/statsJoueurApi";
import { classeBarre, formaterMoyenne, GRADUATIONS, hauteurBarre, maximumCompteurs } from "@/lib/ui/statsJoueur";
import CarteTitre from "./CarteTitre";

/** La grille de 20 colonnes PARTAGÉE par l'en-tête de chiffres, les barres et les graduations : c'est elle qui fait tomber chaque chiffre pile au-dessus de sa colonne. */
const GRILLE = "grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]";

type Etat = { phase: "chargement" } | { phase: "erreur" } | { phase: "pret"; vue: PlayerStatsView };

/**
 * V3.1-91 — Le volet « Tes dés et tes titres » de l'accueil joueur (remplace
 * `DiceStatsPanel`). Il ne calcule rien : la route `player-stats` rend les
 * compteurs et les titres déjà décidés par le noyau (`src/core/stats`) ; les
 * nombres de 1 et de 20 affichés SONT `counts[0]` et `counts[19]`, la même
 * source que la hauteur de leurs colonnes. Chargé à l'affichage, rechargé
 * seulement au changement de pilule (docs/QUOTAS.md Q1).
 */
export default function StatsJoueur({ campaignId }: { campaignId: string | null }) {
  const t = useTranslations("statsJoueur");
  const locale = useLocale();
  const [portee, setPortee] = useState<PorteeStats>("campaign");
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });

  useEffect(() => {
    if (!campaignId) return;
    let annule = false;
    chargerStatsJoueurApi(campaignId, portee)
      .then((vue) => {
        if (!annule) setEtat({ phase: "pret", vue });
      })
      .catch((erreur: unknown) => {
        console.error("Chargement des statistiques du joueur impossible", erreur);
        if (!annule) setEtat({ phase: "erreur" });
      });
    return () => {
      annule = true;
    };
  }, [campaignId, portee]);

  function changerPortee(suivante: PorteeStats) {
    setEtat({ phase: "chargement" });
    setPortee(suivante);
  }

  return (
    <section className="flex flex-col gap-2" aria-label={t("titre")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("titre")}</h3>
        {campaignId && (
          <Tabs<PorteeStats>
            className="w-full sm:w-auto"
            aria-label={t("porteeAria")}
            value={portee}
            onChange={changerPortee}
            items={[
              { value: "campaign", label: t("campagne") },
              { value: "last_session", label: t("derniereSeance") },
            ]}
          />
        )}
      </div>
      <Corps campaignId={campaignId} etat={etat} locale={locale} />
    </section>
  );
}

function Corps({ campaignId, etat, locale }: { campaignId: string | null; etat: Etat; locale: string }) {
  const t = useTranslations("statsJoueur");
  if (!campaignId) return <p className="text-xs text-ink-muted">{t("sansCampagne")}</p>;
  if (etat.phase === "erreur") return <p className="text-xs text-danger">{t("erreur")}</p>;
  if (etat.phase === "chargement") return <p className="text-xs text-ink-muted">{t("chargement")}</p>;
  const vue = etat.vue;
  if (vue.status === "no_character") return <p className="text-xs text-ink-muted">{t("sansPersonnage")}</p>;

  return (
    <div className="flex flex-col gap-2">
      {vue.histogram.tooFew ? (
        <p className="rounded-lg border border-edge bg-panel p-3 text-sm text-ink-muted">{t("peuDeJets")}</p>
      ) : (
        <>
          <Histogramme compteurs={vue.histogram.counts} total={vue.histogram.total} moyenne={vue.average} locale={locale} />
          <Titres titres={vue.titles} />
        </>
      )}
      {vue.legacyRolls && <p className="text-xs text-ink-muted">{t("depuisLe9Octobre")}</p>}
    </div>
  );
}

function Histogramme({ compteurs, total, moyenne, locale }: { compteurs: number[]; total: number; moyenne: number | null; locale: string }) {
  const t = useTranslations("statsJoueur");
  const maximum = maximumCompteurs(compteurs);
  const nombreDe1 = compteurs[0] ?? 0;
  const nombreDe20 = compteurs[19] ?? 0;

  return (
    <div role="group" aria-label={t("histogrammeAria")} className="rounded-lg border border-edge bg-panel p-3">
      {/* En-tête : sur la même grille que les barres. */}
      <div className={`${GRILLE} items-end`}>
        <span
          className="col-start-1 justify-self-start whitespace-nowrap font-display text-[17px] font-extrabold leading-none text-danger"
          aria-label={t("nombreDe1Aria", { nombre: nombreDe1 })}
        >
          {nombreDe1}
        </span>
        <div className="col-start-5 col-end-17 flex items-baseline justify-center gap-1.5 whitespace-nowrap">
          <span className="font-display text-[26px] font-extrabold leading-none text-ink" aria-label={t("moyenneAria", { valeur: formaterMoyenne(moyenne, locale) })}>
            {formaterMoyenne(moyenne, locale)}
          </span>
          <span className="text-xs text-ink-muted">{t("jets", { nombre: total })}</span>
        </div>
        <span
          className="col-start-20 justify-self-end whitespace-nowrap font-display text-[17px] font-extrabold leading-none text-success"
          aria-label={t("nombreDe20Aria", { nombre: nombreDe20 })}
        >
          {nombreDe20}
        </span>
      </div>

      {/* Barres : la hauteur max est celle de la zone, jamais au-delà. */}
      <div className={`${GRILLE} mt-1 h-[74px] items-end border-b border-edge lg:h-[84px]`}>
        {compteurs.map((n, i) => (
          <div
            key={i}
            role="img"
            title={t("survol", { face: i + 1, nombre: n })}
            aria-label={t("survol", { face: i + 1, nombre: n })}
            className="flex h-full items-end"
          >
            <div className={`w-full rounded-t-[3px] ${classeBarre(i + 1)}`} style={{ height: `${hauteurBarre(n, maximum)}%` }} />
          </div>
        ))}
      </div>

      {/* Graduations : un chiffre centré sous sa colonne. */}
      <div className={`${GRILLE} mt-0.5`} aria-hidden="true">
        {GRADUATIONS.map((g) => (
          <span key={g} style={{ gridColumnStart: g }} className="justify-self-center font-mono text-xs leading-none text-ink-muted">
            {g}
          </span>
        ))}
      </div>
    </div>
  );
}

function Titres({ titres }: { titres: Extract<PlayerStatsView, { status: "ok" }>["titles"] }) {
  const t = useTranslations("statsJoueur");
  return (
    <ul aria-label={t("titresAria")} className="grid grid-cols-2 gap-2">
      {TITLE_FAMILIES.map((famille) => {
        const titre = titres.find((x) => x.family === famille);
        const palier = titre?.tier ?? null;
        // Une case sans palier reste présente, vide : la grille garde ses quatre cases.
        if (!titre || !palier) return <li key={famille} aria-hidden="true" className="min-h-[52px] rounded-lg border border-edge bg-panel-sunken" />;
        return (
          <li key={famille} className="min-w-0">
            <CarteTitre icone={palier.icon_key} couleur={palier.color_token} nom={palier.name} texte={titre.text} />
          </li>
        );
      })}
    </ul>
  );
}
