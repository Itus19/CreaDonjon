"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Checkbox from "@/components/shared/Checkbox";
import PlanCombat from "@/components/shell/combat/PlanCombat";
import type { AreaPlacement } from "@/src/core/rules/geometry";
import { apercuZone, ciblesAEnvoyer, etapeSuivante, etapesZone, type EtapeZone, type JetonPlan, type Point } from "@/lib/ui/planCombat";

/**
 * V3.1-170 (ADR 0077) — l'outil de zone de la fiche : le joueur pose le point
 * (sphère, cube, origine « point ») et/ou la direction (cône, ligne) sur le
 * plan, voit qui est dedans AVANT de valider. Le serveur recalcule les cibles
 * à partir de la même géométrie ; le MJ peut en décocher, et envoie alors
 * celles qu'il garde. Aucun chargement ici : les jetons viennent de l'appelant.
 */

const BOUTON_PRINCIPAL =
  "min-h-11 shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50";
const BOUTON_SECONDAIRE = "min-h-11 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";

export default function PoseZone({
  jetons,
  lanceurId,
  spec,
  portee,
  estMj,
  envoi,
  onValider,
  onAnnuler,
}: {
  jetons: readonly JetonPlan[];
  lanceurId: string;
  spec: AreaPlacement;
  portee?: number;
  estMj: boolean;
  envoi: boolean;
  onValider: (area: { point?: Point; aim?: Point }, ciblesRetenues: string[]) => void;
  onAnnuler: () => void;
}) {
  const t = useTranslations("planCombat");
  const [point, setPoint] = useState<Point | undefined>(undefined);
  const [aim, setAim] = useState<Point | undefined>(undefined);
  const [choix, setChoix] = useState<EtapeZone | null>(null);
  const [retirees, setRetirees] = useState<string[]>([]);

  const etapes = etapesZone(spec);
  const etape = choix && etapes.includes(choix) ? choix : etapeSuivante(spec, { point, aim });
  const zone = { spec, lanceurId, ...(portee !== undefined ? { portee } : {}) };
  const apercu = apercuZone({ zone, jetons, point, aim });
  const dedans = apercu.etat === "ok" ? apercu.ids : [];
  const gardees = dedans.filter((id) => !retirees.includes(id));
  const envoyer = ciblesAEnvoyer(dedans, estMj ? gardees : dedans);
  const nom = (id: string) => jetons.find((j) => j.id === id)?.label ?? id;

  function poser(e: EtapeZone, p: Point) {
    if (e === "point") setPoint(p);
    else setAim(p);
    setChoix(null);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-panel p-2.5" data-testid="pose-zone">
      <PlanCombat jetons={jetons} deplacables={() => false} moiId={lanceurId} zone={{ zone, point, aim, etape, onPoser: poser }} />

      {etapes.length > 0 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("etapesTitre")}>
          {etapes.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={etape === e}
              onClick={() => setChoix(e)}
              className={`min-h-11 rounded-full border px-3 py-1 text-xs ${etape === e ? "border-accent text-accent" : "border-edge text-ink-muted"}`}
            >
              {t(`poser.${e}`)}
            </button>
          ))}
        </div>
      )}

      {apercu.etat === "incomplet" ? (
        <p className="text-xs text-ink-muted" role="status">
          {t(`manque.${apercu.manque}`)}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("dedansTitre", { n: dedans.length })}</span>
          {dedans.length === 0 && <p className="text-xs text-ink-muted">{t("personneDedans")}</p>}
          {dedans.map((id) =>
            estMj ? (
              <div key={id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!retirees.includes(id)}
                  onChange={() => setRetirees((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))}
                  aria-label={t("garderCible", { nom: nom(id) })}
                  disabled={envoi}
                />
                <span className="min-w-0 flex-1 break-words text-ink">{nom(id)}</span>
              </div>
            ) : (
              <span key={id} className="text-sm text-ink">
                {nom(id)}
              </span>
            )
          )}
          {!envoyer.valide && <p className="text-xs text-ink-muted">{t("garderUneCible")}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BOUTON_PRINCIPAL}
          disabled={envoi || apercu.etat !== "ok" || !envoyer.valide}
          onClick={() => onValider({ ...(point ? { point } : {}), ...(aim ? { aim } : {}) }, envoyer.ids)}
        >
          {t("validerZone")}
        </button>
        <button type="button" className={BOUTON_SECONDAIRE} disabled={envoi} onClick={onAnnuler}>
          {t("annulerZone")}
        </button>
      </div>
    </div>
  );
}
