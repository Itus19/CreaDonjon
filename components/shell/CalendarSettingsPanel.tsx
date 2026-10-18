"use client";

import { useReducer, useState } from "react";
import { useTranslations } from "next-intl";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { aDesModifications, calendrierValide, reduireCalendrier } from "@/lib/ui/calendrierEdition";
import FriseEres from "./calendrier/FriseEres";
import JourActuel from "./calendrier/JourActuel";
import ReglageEres from "./calendrier/ReglageEres";
import ReglageMois from "./calendrier/ReglageMois";
import SemaineEnPuces from "./calendrier/SemaineEnPuces";
import VignetteMois from "./calendrier/VignetteMois";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";

type Selection = { type: "mois"; index: number } | { type: "eres" } | null;

const BOUTON_ENREGISTRER =
  "rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50";

/**
 * Calendrier du monde (V2-H2, specs/wiki-blocs.md §3, refait en V3.1-55) : l'année
 * d'un coup d'œil — frise des ères, jour actuel, mois en vignettes, semaine en
 * puces, et un réglage contextuel (à droite, sous l'année sur tablette, en
 * feuille du bas sur téléphone). Un seul calendrier par monde, remplacé en
 * entier à l'enregistrement. Toute modification est locale
 * (`lib/ui/calendrierEdition.ts`) : AUCUNE requête avant « Enregistrer ». Ce
 * calendrier alimente ensuite `sort_key` pour le bloc `timeline`.
 */
export default function CalendarSettingsPanel({
  worldSlug,
  initialCalendar,
}: {
  worldSlug: string;
  initialCalendar: CalendarConfigInput;
}) {
  const t = useTranslations("calendrier");
  const mobile = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const [calendar, dispatch] = useReducer(reduireCalendrier, initialCalendar);
  const [enregistre, setEnregistre] = useState<CalendarConfigInput>(initialCalendar);
  const [selection, setSelection] = useState<Selection>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modifie = aDesModifications(enregistre, calendar);
  const valide = calendrierValide(calendar);
  const annee = calendar.currentDate?.year ?? 0;
  // Un mois supprime peut laisser la selection hors du calendrier : on la ramene au dernier.
  const indexMois = selection?.type === "mois" ? Math.min(selection.index, calendar.months.length - 1) : -1;

  async function save() {
    setPending(true);
    setError(null);
    const envoye = calendar;
    const res = await fetch(`/api/worlds/${worldSlug}/calendar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envoye),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? t("erreurEnregistrement"));
      return;
    }
    setEnregistre(envoye);
  }

  const reglage =
    selection?.type === "eres" ? (
      <ReglageEres calendrier={calendar} dispatch={dispatch} />
    ) : selection?.type === "mois" ? (
      <ReglageMois
        key={indexMois}
        calendrier={calendar}
        index={indexMois}
        annee={annee}
        dispatch={dispatch}
        onChoisir={(index) => setSelection({ type: "mois", index })}
      />
    ) : null;
  const titreReglage = selection?.type === "eres" ? t("eresTitre") : indexMois >= 0 ? calendar.months[indexMois].name : "";

  const statut = (
    <span className={`text-xs ${modifie ? "text-accent" : "text-ink-muted"}`}>
      {modifie ? t("nonEnregistre") : t("toutEnregistre")}
    </span>
  );
  const boutonEnregistrer = (
    <button type="button" onClick={save} disabled={pending || !modifie || !valide} className={BOUTON_ENREGISTRER}>
      {pending ? t("enregistrement") : t("enregistrer")}
    </button>
  );
  const messages = (
    <>
      {!valide && <span className="text-xs text-danger">{t("nomVide")}</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{t("titre")}</h2>
          <p className="text-sm text-ink-muted">{t("intro")}</p>
        </div>
        {mobile && boutonEnregistrer}
      </div>
      {mobile && (
        <div className="flex flex-wrap items-center gap-2">
          {statut}
          {messages}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="order-2 md:order-1">
              <FriseEres calendrier={calendar} actif={selection?.type === "eres"} onOuvrir={() => setSelection({ type: "eres" })} />
            </div>
            <div className="order-1 md:order-2">
              <JourActuel calendrier={calendar} dispatch={dispatch} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 xl:grid-cols-4">
            {calendar.months.map((_, i) => (
              <VignetteMois
                key={i}
                calendrier={calendar}
                index={i}
                annee={annee}
                selectionne={indexMois === i}
                onChoisir={() => setSelection({ type: "mois", index: i })}
              />
            ))}
          </div>

          <SemaineEnPuces calendrier={calendar} dispatch={dispatch} />
        </div>

        {/* Reglage : a droite (ordinateur), sous l'annee (tablette) ; en feuille du bas sur telephone. */}
        {!mobile && (
          <aside className="flex flex-col gap-3 self-start rounded-xl border border-edge bg-panel p-3 lg:sticky lg:top-2">
            {selection ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold text-ink">{titreReglage}</h3>
                  <button
                    type="button"
                    onClick={() => setSelection(null)}
                    aria-label={t("fermerReglage")}
                    className="flex h-7 w-7 items-center justify-center rounded text-sm text-ink-muted transition-colors hover:text-ink"
                  >
                    ×
                  </button>
                </div>
                {reglage}
              </>
            ) : (
              <p className="text-xs italic text-ink-muted">{t("reglageVide")}</p>
            )}
          </aside>
        )}
      </div>

      {mobile && selection && (
        <FeuilleDuBas titre={titreReglage} titreVisible onFermer={() => setSelection(null)}>
          {reglage}
        </FeuilleDuBas>
      )}

      {!mobile && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-panel p-3">
          {statut}
          {messages}
          <span className="flex-1" />
          {boutonEnregistrer}
        </div>
      )}
    </div>
  );
}
