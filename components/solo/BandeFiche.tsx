"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bouclier, JaugeCirculaire } from "@/components/solo/FicheJouableEnTete";
import type { JaugesBande } from "@/lib/ui/solo";

/**
 * V3.1-36 — Les jauges de la fiche, en raccourci : CA, PV, Niveau, Charge
 * (et Épuisement en ligne). Deux formes d'une même donnée, calculée par la
 * fiche (`FicheJouableSolo`) — ce composant ne charge rien :
 * - `colonne` : la bande de 96 px de la fiche repliée, sur ordinateur.
 *   **V3.2-16** : la CA, puis quatre jauges circulaires, celles du bandeau de
 *   la fiche (`JaugeCirculaire`) : PV, marche vers le niveau suivant, charge,
 *   épuisement. Même forme, même lecture, ouverte ou repliée ;
 * - `ligne` : sous le bandeau du Jeu, sur téléphone.
 */
export default function BandeFiche({ jauges, variante }: { jauges: JaugesBande | null; variante: "colonne" | "ligne" }) {
  const t = useTranslations("solo");
  const locale = useLocale();

  if (jauges === null) {
    return <p className="text-xs text-ink-muted">{t("bandeChargement")}</p>;
  }

  const charge = t("bandeKg", { valeur: jauges.chargeKg.toLocaleString(locale) });
  const pv = `${jauges.hpCurrent}/${jauges.hpMax}`;
  const barrePv = (
    <div className="h-1 w-full overflow-hidden rounded-full bg-panel-sunken" aria-hidden="true">
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, jauges.pctPv))}%` }} />
    </div>
  );

  if (variante === "colonne") {
    const kg = (v: number) => v.toLocaleString(locale);
    return (
      <div
        role="group"
        aria-label={t("bandeTitre")}
        className="flex h-full flex-col items-center gap-3 overflow-y-auto rounded-lg border border-edge bg-panel px-2 py-3 text-center"
      >
        <Bouclier valeur={jauges.ac} />
        <JaugeCirculaire libelle={t("bandePv")} valeur={pv} pct={jauges.pctPv} titre={t("bandePvTitre", { pv: jauges.hpCurrent, max: jauges.hpMax })} />
        {/* Comme dans le bandeau de la fiche : sous la jauge le niveau ATTEINT, dedans la marche vers le suivant. */}
        <JaugeCirculaire
          libelle={t("bandeNiveauCourt", { niveau: jauges.level })}
          valeur={jauges.xpDansNiveau.toLocaleString(locale)}
          pct={jauges.pctXp}
          titre={t("bandeXpTitre", { xp: jauges.xpDansNiveau.toLocaleString(locale), plafond: jauges.xpVersSuivant.toLocaleString(locale), niveau: jauges.level + 1 })}
        />
        <JaugeCirculaire
          libelle={t("bandeCharge")}
          valeur={kg(Math.round(jauges.chargeKg))}
          pct={jauges.pctCharge}
          ton={jauges.encombre ? "danger" : "accent"}
          titre={t(jauges.encombre ? "bandeChargeTitreEncombre" : "bandeChargeTitre", { porte: kg(jauges.chargeKg), capacite: kg(jauges.capaciteKg) })}
        />
        {/* L'épuisement monte quand ça va mal : son anneau se remplit en ton d'alerte. */}
        <JaugeCirculaire
          libelle={t("bandeEpuisement")}
          valeur={`${jauges.exhaustion}/6`}
          pct={jauges.pctEpuisement}
          ton="danger"
          titre={t("bandeEpuisementTitre", { niveau: jauges.exhaustion })}
        />
      </div>
    );
  }

  return (
    <div role="group" aria-label={t("bandeTitre")} className="grid min-w-0 flex-1 grid-cols-5 gap-1 rounded-lg border border-edge bg-panel px-2 py-1.5 text-center">
      <div className="flex flex-col">
        <span className="text-xs text-ink-muted">{t("bandeCa")}</span>
        <span className="text-sm font-medium tabular-nums text-ink">{jauges.ac}</span>
      </div>
      <div className="flex min-w-0 flex-col items-center gap-0.5">
        <span className="text-xs text-ink-muted">{t("bandePv")}</span>
        <span className="text-sm font-medium tabular-nums text-ink">{pv}</span>
        {barrePv}
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-ink-muted">{t("bandeNiveau")}</span>
        <span className="text-sm font-medium tabular-nums text-ink">{jauges.level}</span>
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-ink-muted">{t("bandeCharge")}</span>
        <span className="truncate text-sm font-medium tabular-nums text-ink">{charge}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-ink-muted">{t("bandeEpuisement")}</span>
        <span className={`text-sm font-medium tabular-nums ${jauges.exhaustion > 0 ? "text-danger" : "text-ink"}`}>{jauges.exhaustion}/6</span>
      </div>
    </div>
  );
}
