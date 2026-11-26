"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useSoloContexte, type OngletMonde } from "@/components/solo/SoloContexte";

/**
 * V3.2-12 — La bande du Monde replié (ordinateur seulement).
 *
 * Une icône par onglet de la colonne : un clic déplie le volet SUR cet
 * onglet. L'onglet ouvert en dernier reste marqué en accent, pour qu'on
 * sache où l'on rouvrira.
 *
 * Icônes au trait, jamais d'émoji (docs/CHARTE-UI.md §10).
 */
const ICONES: Record<OngletMonde, ReactNode> = {
  // Un livre ouvert.
  wiki: <path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5m0-14.5c2-1.5 5-2 8-1.5V19c-3-.5-6 0-8 1.5m0-14.5v14.5" />,
  // Un parchemin.
  quetes: <path d="M7 4h11a2 2 0 0 1 0 4h-2v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h2V6a2 2 0 0 0-2-2m5 5h2m-2 4h2" />,
  // Deux silhouettes.
  presents: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9c0-3 2.7-5 6-5s6 2 6 5m1-9a2.5 2.5 0 1 0-1-4.8M17 15c2.4.3 4 2.1 4 5" />,
  // Une balance.
  regles: <path d="M12 4v16m-6 0h12M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0L5 8Zm14 0-2.5 6a3 3 0 0 0 5 0L19 8Z" />,
  // V3.2-27 : une plume sur une ligne (ce qui s'est écrit dans le monde).
  changements: <path d="M4 20h16M7 16l9.5-9.5a2.1 2.1 0 0 1 3 3L10 19H7v-3Z" />,
};

const ORDRE: OngletMonde[] = ["wiki", "quetes", "presents", "regles", "changements"];

export default function BandeMonde({ children }: { children?: ReactNode }) {
  const t = useTranslations("solo.bandeMonde");
  const { ongletMonde, deplierMonde } = useSoloContexte();

  return (
    <>
      <nav aria-label={t("aria")} className="flex flex-col items-center gap-1">
        {ORDRE.map((onglet) => {
          const libelle = t("ouvrir", { onglet: t(onglet) });
          return (
            <button
              key={onglet}
              type="button"
              onClick={() => deplierMonde(onglet)}
              aria-label={libelle}
              title={libelle}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-panel-raised hover:text-ink motion-reduce:transition-none ${
                onglet === ongletMonde ? "text-accent" : "text-ink-muted"
              }`}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONES[onglet]}
              </svg>
            </button>
          );
        })}
      </nav>
      {children}
    </>
  );
}
