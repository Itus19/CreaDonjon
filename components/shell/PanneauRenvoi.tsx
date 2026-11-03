"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { RuleEntryDetail } from "@/src/server/services/rules";
import { LARGEUR_PANNEAU_RENVOI } from "@/lib/ui/fenetreEtroite";

const RuleEntryView = dynamic(() => import("@/components/rules/RuleEntryView"), {
  ssr: false,
  loading: () => <p className="text-sm text-ink-muted">Chargement...</p>,
});

/**
 * Panneau de renvoi (V3.1-95) : en fenêtre étroite, toucher un renvoi de règle
 * ouvre sa fiche ici, par-dessus la page, depuis le bord droit. Fond PLEIN
 * (`bg-bg`, jamais un jeton translucide : le texte de la page dessous ne doit
 * pas transparaître). × ou Échap le ferme. La fiche vient de l'état des
 * fenêtres (`DesktopWindowsProvider`), qui la charge par la route `/window`.
 */
export default function PanneauRenvoi({
  worldSlug,
  data,
  onFermer,
}: {
  worldSlug: string;
  data: RuleEntryDetail | undefined;
  onFermer: () => void;
}) {
  const t = useTranslations("regles");

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  return (
    <aside
      role="complementary"
      aria-label={t("renvoiPanneau")}
      className="absolute right-0 top-0 z-50 flex h-full max-w-full flex-col border-l border-edge-strong bg-bg shadow-[-20px_0_40px_-20px_rgba(0,0,0,.7)]"
      style={{ width: LARGEUR_PANNEAU_RENVOI }}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-edge pl-4 pr-2">
        <span className="min-w-0 truncate font-chrome text-sm font-medium text-ink">{data?.name ?? t("renvoiPanneau")}</span>
        <button
          type="button"
          onClick={onFermer}
          aria-label={t("fermerRenvoi")}
          title={t("fermerRenvoi")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-edge text-sm text-ink-soft transition-colors hover:border-danger/60 hover:text-ink motion-reduce:transition-none"
        >
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {data ? <RuleEntryView entry={data} worldSlug={worldSlug} /> : <p className="text-sm text-ink-muted">Chargement...</p>}
      </div>
    </aside>
  );
}
