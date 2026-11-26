"use client";

import { useTranslations } from "next-intl";
import type { SceneWeatherView } from "@/lib/solo/types";

/**
 * ME-5 (specs/meteo.md §9) — la météo de la scène en une ligne : la
 * condition la plus marquante (précipitation, sinon brouillard, sinon ciel),
 * le vent s'il compte, la température et la saison. Dedans ou à l'abri, la
 * ligne dit que c'est le temps du dehors : le personnage n'y est pas.
 *
 * Tout vient du moteur (règle absolue 8) ; ce composant ne fait que libeller.
 */
export default function MeteoScene({ weather, className }: { weather: SceneWeatherView; className?: string }) {
  const t = useTranslations("solo.meteo");
  const principale =
    weather.precipitation !== "none" ? t(`precipitation.${weather.precipitation}`) : weather.fog ? t("brouillard") : t(`ciel.${weather.sky}`);
  const vent = weather.wind === "wind" || weather.wind === "gale" ? t(`vent.${weather.wind}`) : null;
  const condition = [principale, vent].filter((p): p is string => p !== null).join(", ");
  const enMinuscule = condition.charAt(0).toLocaleLowerCase("fr") + condition.slice(1);
  const texte =
    weather.exposure === "outdoor"
      ? condition
      : weather.exposure === "indoor"
        ? t("dehors", { condition: enMinuscule })
        : t("abri", { condition: enMinuscule });
  const morceaux = [texte, t("temperature", { n: weather.temperatureC }), weather.season ? t(`saison.${weather.season}`) : null].filter(
    (p): p is string => p !== null
  );
  return (
    <span className={className} title={t("titre")}>
      {morceaux.join(" · ")}
    </span>
  );
}
