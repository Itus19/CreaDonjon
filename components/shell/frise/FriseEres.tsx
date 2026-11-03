"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { aDesModifications, calendrierValide, reduireCalendrier } from "@/lib/ui/calendrierEdition";
import { plageEre } from "@/lib/ui/frise";
import { enregistrerCalendrier } from "@/lib/ui/friseApi";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";

const CHAMP = "rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none";

/**
 * Panneau « Ères… » (V3.1-98) : une ligne par ère (nom, année de début, plage
 * calculée). Rien n'est écrit avant « Enregistrer » ; l'écriture est celle de
 * l'outil Calendrier (même route, même `CalendarConfig.eras`), et le même
 * réducteur (`reduireCalendrier`) en garde les bornes.
 */
export default function FriseEres({
  worldSlug,
  calendrier,
  todayYear,
  onEnregistre,
  onFermer,
}: {
  worldSlug: string;
  /** Le calendrier enregistré : le brouillon part de lui. */
  calendrier: CalendarConfigInput;
  todayYear: number | null;
  onEnregistre: (calendrier: CalendarConfigInput) => void;
  onFermer: () => void;
}) {
  const t = useTranslations("frise.eres");
  const [brouillon, setBrouillon] = useState<CalendarConfigInput>(calendrier);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const modifie = aDesModifications(calendrier, brouillon);
  const valide = calendrierValide(brouillon);

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    const envoye = brouillon;
    const res = await enregistrerCalendrier(worldSlug, envoye);
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.message ?? t("erreur"));
      return;
    }
    onEnregistre(envoye);
  }

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col gap-3 border-l border-edge bg-panel p-4 shadow-[-20px_0_40px_-20px_rgba(0,0,0,.7)] @max-[48rem]:absolute @max-[48rem]:right-0 @max-[48rem]:top-0 @max-[48rem]:z-30 @max-[48rem]:max-w-[90%] @[48rem]:shadow-none">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{t("titre")}</h2>
        <button type="button" onClick={onFermer} aria-label={t("fermer")} className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink transition-colors hover:bg-panel-raised">
          ✕
        </button>
      </div>
      <p className="text-xs text-ink-muted">{t("aide")}</p>
      <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {brouillon.eras.length === 0 && <li className="text-xs text-ink-muted">{t("aucune")}</li>}
        {brouillon.eras.map((ere, i) => {
          const plage = plageEre(brouillon.eras, i, todayYear);
          return (
            <li key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <input
                  value={ere.name}
                  onChange={(e) => setBrouillon((c) => reduireCalendrier(c, { type: "ereRenommer", index: i, nom: e.target.value }))}
                  aria-label={t("nom")}
                  className={`${CHAMP} min-w-0 flex-1`}
                />
                <input
                  type="number"
                  value={ere.startYear}
                  onChange={(e) => {
                    const annee = Number(e.target.value);
                    if (Number.isFinite(annee)) setBrouillon((c) => reduireCalendrier(c, { type: "ereDebut", index: i, annee }));
                  }}
                  aria-label={t("debut", { nom: ere.name })}
                  className={`${CHAMP} w-24`}
                />
                <button
                  type="button"
                  onClick={() => setBrouillon((c) => reduireCalendrier(c, { type: "ereSupprimer", index: i }))}
                  aria-label={t("supprimer", { nom: ere.name })}
                  className="rounded-full border border-edge px-2 py-0.5 text-xs text-danger transition-colors hover:bg-panel-raised"
                >
                  ×
                </button>
              </div>
              <span className="font-mono text-xs text-ink-muted">
                {plage.fin === null ? t("plageOuverte", { debut: plage.debut }) : t("plage", { debut: plage.debut, fin: plage.fin })}
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => setBrouillon((c) => reduireCalendrier(c, { type: "ereAjouter", nom: t("nouvelle") }))}
        className="self-start rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
      >
        {t("ajouter")}
      </button>
      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${modifie ? "text-accent" : "text-ink-muted"}`}>{modifie ? t("nonEnregistre") : t("toutEnregistre")}</span>
        <button
          type="button"
          onClick={() => void enregistrer()}
          disabled={enCours || !modifie || !valide}
          className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {enCours ? t("enCours") : t("enregistrer")}
        </button>
      </div>
    </aside>
  );
}
