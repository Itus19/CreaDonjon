"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { ERES_MAX, type ActionCalendrier } from "@/lib/ui/calendrierEdition";

/** Le réglage des ères (V3.1-55) : nom, « dès l'an », ×, « + Ajouter une ère ». */
export default function ReglageEres({
  calendrier,
  dispatch,
}: {
  calendrier: CalendarConfigInput;
  dispatch: Dispatch<ActionCalendrier>;
}) {
  const t = useTranslations("calendrier");
  return (
    <div className="flex flex-col gap-3">
      {calendrier.eras.length === 0 && <p className="text-xs italic text-ink-muted">{t("aucuneEre")}</p>}
      <ul className="flex flex-col gap-2">
        {calendrier.eras.map((ere, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <input
              value={ere.name}
              onChange={(e) => dispatch({ type: "ereRenommer", index: i, nom: e.target.value })}
              aria-label={t("nomDeLEre")}
              placeholder={t("nomDeLEre")}
              className="min-w-32 flex-1 rounded border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none focus:border-accent"
            />
            <label className="flex items-center gap-1.5 text-xs text-ink-muted">
              {t("desLAn")}
              <input
                type="number"
                value={ere.startYear}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (e.target.value.trim() !== "" && Number.isFinite(n)) dispatch({ type: "ereDebut", index: i, annee: n });
                }}
                className="w-20 rounded border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <button
              type="button"
              onClick={() => dispatch({ type: "ereSupprimer", index: i })}
              aria-label={t("supprimerEre")}
              className="flex h-7 w-7 items-center justify-center rounded text-sm text-danger transition-colors hover:bg-panel-raised"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => dispatch({ type: "ereAjouter", nom: t("nouvelleEre") })}
        disabled={calendrier.eras.length >= ERES_MAX}
        className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-30"
      >
        {t("ajouterEre")}
      </button>
    </div>
  );
}
