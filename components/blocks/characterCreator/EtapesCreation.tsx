"use client";

import { useTranslations } from "next-intl";
import type { Chemin, CleEtape } from "@/lib/ui/cheminCreation";

/**
 * V3.1-49 — Les étapes à gauche, et sous chacune les choix qu'elle fait
 * naître : point doré à faire, vert fait ; « n à faire » sur l'étape. Les
 * sous-étapes d'une étape se montrent quand on y est, ou tant qu'il en
 * reste à faire (on voit d'un coup d'œil ce qui attend).
 *
 * V3.1-51 : sous Classe, seuls les choix du niveau 1 sont listés, plus une
 * ligne « Choix de niveau · n à faire » (les autres vivent en pastilles sur la
 * progression). `choixDeNiveau` absent : aucune réduction (montée de niveau,
 * où le chemin ne porte déjà que les choix nouveaux).
 */
export default function EtapesCreation({
  chemin,
  position,
  etapeCourante,
  choixDeNiveau,
  onAller,
}: {
  chemin: Chemin;
  position: string;
  etapeCourante: CleEtape;
  /** Somme des choix à faire au-delà du niveau 1 (`aFaireAuDelaDuPremier` de chaque classe). */
  choixDeNiveau?: number;
  onAller: (position: string) => void;
}) {
  const t = useTranslations("creation");
  return (
    <nav aria-label={t("etapesAria")} className="flex flex-col gap-0.5">
      {chemin.etapes.map((etape, i) => {
        const reduire = choixDeNiveau !== undefined && etape.cle === "classe";
        const sousVisibles = reduire ? etape.sous.filter((s) => s.niveau <= 1) : etape.sous;
        const aFaire = reduire ? sousVisibles.filter((s) => !s.fait).length + choixDeNiveau : etape.aFaire;
        const ok = aFaire === 0 && etape.cle !== "apercu";
        const ici = position === etape.cle;
        const montrer = etape.cle === etapeCourante || aFaire > 0;
        return (
          <div key={etape.cle} className="flex flex-col gap-0.5">
            <button
              type="button"
              aria-current={ici ? "step" : undefined}
              onClick={() => onAller(etape.cle)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                ici ? "bg-panel-raised font-semibold text-ink" : "text-ink-soft hover:bg-panel-raised"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  ok ? "border-success/60 bg-success/15 text-success" : "border-edge-strong text-ink-muted"
                }`}
              >
                {ok ? "✓" : i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{t(`etapes.${etape.cle}`)}</span>
              {aFaire > 0 && <span className="shrink-0 text-xs text-accent">{t("aFaire", { n: aFaire })}</span>}
            </button>
            {montrer &&
              sousVisibles.map((sous) => {
                const ouverte = position === `c:${sous.cle}`;
                return (
                  <button
                    key={sous.cle}
                    type="button"
                    aria-current={ouverte ? "step" : undefined}
                    onClick={() => onAller(`c:${sous.cle}`)}
                    className={`flex w-full items-center gap-2 rounded-md py-1 pl-9 pr-2 text-left text-xs transition-colors ${
                      ouverte ? "bg-panel-raised text-ink" : "text-ink-muted hover:bg-panel-raised"
                    }`}
                  >
                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${sous.fait ? "bg-success" : "bg-accent"}`} />
                    <span className="min-w-0 flex-1 truncate">
                      {sous.genre === "groupe" ? `${t("don", { nom: sous.libelle })} · ${t("compteGroupe", { fait: sous.choisis.length, total: sous.nombre })}` : sous.libelle}
                    </span>
                    <span className="sr-only">{sous.fait ? t("fait") : t("aFaireUn")}</span>
                  </button>
                );
              })}
            {montrer && reduire && (choixDeNiveau > 0 || etape.sous.some((s) => s.niveau > 1)) && (
              <button
                type="button"
                onClick={() => onAller("classe")}
                className="flex w-full items-center gap-2 rounded-md py-1 pl-9 pr-2 text-left text-xs text-ink-muted transition-colors hover:bg-panel-raised"
              >
                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${choixDeNiveau > 0 ? "bg-accent" : "bg-success"}`} />
                <span className="min-w-0 flex-1 truncate">
                  {t("choixDeNiveau")} · {choixDeNiveau > 0 ? t("aFaire", { n: choixDeNiveau }) : t("fait")}
                </span>
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
