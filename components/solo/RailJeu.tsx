"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { FournisseurRail, RailFilet, RailRow, useRailReplie } from "@/components/shell/Rail";
import { ICONES_MONDE } from "@/components/solo/BandeMonde";
import { AvatarPresent, libellePerception } from "@/components/solo/RondsPresents";
import { ZONE_LABELS } from "@/components/solo/ScenePanel";
import { useSoloContexte, type OngletMonde } from "@/components/solo/SoloContexte";
import { rondsDuRail } from "@/lib/ui/railJeu";
import type { SceneView } from "@/lib/solo/types";

/**
 * ADR 0120, V3.2-55 — Le rail de jeu.
 *
 * Sur la page solo, `PlayerShell` garde son rail (même place, même repli,
 * même dalle du dé) mais n'y met plus ses destinations : il laisse un
 * EMPLACEMENT, que la page remplit par un portail. La raison : ce que montre
 * le rail de jeu (les présents, l'onglet ouvert du volet) arrive avec la page
 * solo (docs/CABLAGE.md, C1) et vit dans la coquille solo (`SoloShell`), un
 * arbre que le layout ne voit pas. Un portail évite un second chargement et
 * un état partagé entre layout et page.
 */

const EmplacementRailJeu = createContext<HTMLElement | null>(null);

export const FournisseurEmplacementRailJeu = EmplacementRailJeu.Provider;

/** L'élément du rail que la page solo remplit ; `null` hors de la coquille joueur (le MJ à distance garde son rail). */
export function useEmplacementRailJeu(): HTMLElement | null {
  return useContext(EmplacementRailJeu);
}

const ENTREES: OngletMonde[] = ["quetes", "changements", "wiki", "regles"];

function IconeTrait({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/**
 * Le contenu du rail de jeu : les entrées du volet, puis les visages des
 * présents. Un clic sur l'entrée ouverte referme le volet (`basculerVolet`).
 */
function ContenuRailJeu({
  worldSlug,
  present,
  sketches,
  voletOuvert,
  basculerVolet,
}: {
  worldSlug: string;
  present: SceneView["present"];
  sketches: SceneView["sketches"];
  voletOuvert: boolean;
  basculerVolet: (onglet: OngletMonde) => void;
}) {
  const t = useTranslations("solo");
  const { replie } = useRailReplie();
  const { ongletMonde, interlocuteur } = useSoloContexte();
  const { visibles, autres } = rondsDuRail(present, sketches);

  return (
    <FournisseurRail replie={replie}>
      <div className="flex w-full flex-col gap-0.5">
        {ENTREES.map((onglet) => (
          <RailRow
            key={onglet}
            icone={<IconeTrait>{ICONES_MONDE[onglet]}</IconeTrait>}
            libelle={t(`bandeMonde.${onglet}`)}
            actif={voletOuvert && ongletMonde === onglet}
            onClick={() => basculerVolet(onglet)}
          />
        ))}
        {/* V3.2-58 : la prise de notes dans le volet viendra ; d'ici là, la page Notes. */}
        <RailRow
          href={`/m/${worldSlug}/joueur/notes`}
          icone={
            <IconeTrait>
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M8 8h8M8 12h8M8 16h5" />
            </IconeTrait>
          }
          libelle={t("railJeu.notes")}
        />
      </div>

      {visibles.length > 0 && (
        <>
          <RailFilet />
          <ul aria-label={t("railJeu.presentsAria")} className="flex w-full flex-col gap-0.5">
            {visibles.map((r, i) => {
              const perception = libellePerception(r.perception);
              const libelle = [r.nom, perception, ZONE_LABELS[r.zone], r.esquisse ? t("bandeMonde.sansFiche") : null].filter(Boolean).join(" · ");
              const nouvelleZone = i > 0 && visibles[i - 1].zone !== r.zone;
              const parle = interlocuteur !== null && interlocuteur.toLowerCase() === r.nom.toLowerCase();
              return (
                <li key={r.id} className={nouvelleZone ? "mt-1 border-t border-edge pt-1" : ""}>
                  <button
                    type="button"
                    onClick={() => basculerVolet("presents")}
                    aria-label={libelle}
                    title={replie ? libelle : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-panel-raised motion-reduce:transition-none ${
                      r.zone === "far" ? "opacity-60 hover:opacity-100" : ""
                    } ${parle ? "bg-accent/10" : ""}`}
                  >
                    <AvatarPresent nom={r.nom} perception={r.perception} esquisse={r.esquisse} taille={32} />
                    {!replie && (
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-[12.5px] text-ink">{r.nom}</span>
                        <span className="truncate text-xs text-ink-muted">{perception ?? ZONE_LABELS[r.zone]}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {autres > 0 && (
            <button
              type="button"
              onClick={() => basculerVolet("presents")}
              aria-label={t("railJeu.autresAria", { n: autres })}
              title={t("railJeu.autresAria", { n: autres })}
              className="mx-1.5 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-edge-strong text-xs font-semibold text-ink-soft transition-colors hover:bg-panel-raised hover:text-ink motion-reduce:transition-none"
            >
              {t("railJeu.autres", { n: autres })}
            </button>
          )}
        </>
      )}
    </FournisseurRail>
  );
}

/** Rend le contenu du rail de jeu dans l'emplacement que `PlayerShell` a laissé. */
export default function RailJeu(props: {
  emplacement: HTMLElement;
  worldSlug: string;
  present: SceneView["present"];
  sketches: SceneView["sketches"];
  voletOuvert: boolean;
  basculerVolet: (onglet: OngletMonde) => void;
}) {
  const { emplacement, ...reste } = props;
  return createPortal(<ContenuRailJeu {...reste} />, emplacement);
}
