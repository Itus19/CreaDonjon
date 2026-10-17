"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { delaiEcoule, formaterSeance, prochainesSeances, type MondeAccueil } from "@/lib/ui/accueil";
import { useDerniereVisite } from "./useRecents";

type Role = "gm" | "player" | null;

interface MondeHaut extends MondeAccueil {
  name: string;
  slug: string;
  campaignName: string | null;
}

/**
 * Haut de l'accueil (V3.1-35) : les prochaines séances de tous les mondes, et
 * « Reprendre » sur la dernière fiche ouverte (mémorisée dans le navigateur,
 * ADR 0036 §4). Aucun appel réseau : la liste des mondes est déjà là.
 */
export default function AccueilHaut({ mondes }: { mondes: MondeHaut[] }) {
  const t = useTranslations("accueil");
  const locale = useLocale();
  const visite = useDerniereVisite();
  // L'heure est lue une fois, au montage : « il y a … » n'a pas besoin de tourner.
  const [maintenant] = useState(() => Date.now());
  const seances = prochainesSeances(mondes);
  const monde = visite ? (mondes.find((m) => m.slug === visite.worldSlug) ?? null) : null;

  function libelleRole(m: MondeHaut): string {
    const role: Role = m.myRole;
    return role === "player" ? t("roleJoueur") : m.mode === "solo" ? t("roleSolo") : t("roleMj");
  }

  function ilYa(): string {
    if (!visite) return "";
    const d = delaiEcoule(visite.quand, maintenant);
    if (d.unite === "minutes") return t("ilYaMinutes", { nombre: d.nombre });
    if (d.unite === "heures") return t("ilYaHeures", { nombre: d.nombre });
    if (d.unite === "jours") return t("ilYaJours", { nombre: d.nombre });
    return t("ilYaMaintenant");
  }

  if (seances.length === 0 && !(visite && monde)) return null;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start">
      {seances.length > 0 && (
        <section className="min-w-0 flex-1 rounded-lg border border-edge bg-panel p-3" aria-label={t("seancesTitre")}>
          <h2 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-ink-muted">{t("seancesTitre")}</h2>
          <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
            {seances.map((s) => (
              <li key={s.monde.id} className="text-sm text-ink-muted">
                <span className="font-mech text-ink">{formaterSeance(s.startsAt, locale)}</span>
                {" · "}
                <span className="text-ink">{s.monde.name}</span>
                {s.monde.campaignName && <> · {s.monde.campaignName}</>}
                {" · "}
                {libelleRole(s.monde)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {visite && monde && (
        <section className="min-w-0 flex-1 rounded-lg border border-edge bg-panel p-3" aria-label={t("reprendreTitre")}>
          <h2 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-ink-muted">{t("reprendreTitre")}</h2>
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-ink-muted">
              <span className="text-ink">{monde.name}</span>
              {" · "}
              {visite.titre}
              {" · "}
              {ilYa()}
            </p>
            <Link
              href={visite.href}
              className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
            >
              {t("reprendre")}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
