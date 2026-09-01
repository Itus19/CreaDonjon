"use client";

import { useState } from "react";
import GameDateInput from "@/components/shared/GameDateInput";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { GameDate } from "@/src/core/calendar/types";

/** Point de depart quand le MJ active "jour actuel" pour la premiere fois — an 0, jour 1, jamais suppose (aucune annee "naturelle" n'existe avant que le MJ en regle une). */
function blankCurrentDate(): GameDate {
  return { year: 0, month: 1, day: 1, precision: "day", end: null, label: null };
}

/**
 * Reglage du calendrier du monde (V2-H2, specs/wiki-blocs.md §3) : noms des
 * mois, jours par mois, jours par semaine, eres — un seul calendrier par
 * monde, remplace en entier a chaque enregistrement (meme profil que
 * `entity_kind_order`). Ce calendrier alimente ensuite `sort_key`
 * (`src/core/calendar/sortKey.ts`) pour le bloc `timeline` (phase 2).
 */
export default function CalendarSettingsPanel({
  worldSlug,
  initialCalendar,
}: {
  worldSlug: string;
  initialCalendar: CalendarConfigInput;
}) {
  const [calendar, setCalendar] = useState<CalendarConfigInput>(initialCalendar);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateMonth(index: number, patch: Partial<{ name: string; days: number }>) {
    setSaved(false);
    setCalendar((c) => ({
      ...c,
      months: c.months.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
  }
  function addMonth() {
    setSaved(false);
    setCalendar((c) => ({ ...c, months: [...c.months, { name: `Mois ${c.months.length + 1}`, days: 30 }] }));
  }
  function removeMonth(index: number) {
    setSaved(false);
    setCalendar((c) => ({ ...c, months: c.months.filter((_, i) => i !== index) }));
  }
  function moveMonth(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= calendar.months.length) return;
    setSaved(false);
    setCalendar((c) => {
      const months = [...c.months];
      [months[index], months[target]] = [months[target], months[index]];
      return { ...c, months };
    });
  }

  function updateEra(index: number, patch: Partial<{ name: string; startYear: number }>) {
    setSaved(false);
    setCalendar((c) => ({ ...c, eras: c.eras.map((e, i) => (i === index ? { ...e, ...patch } : e)) }));
  }
  function addEra() {
    setSaved(false);
    setCalendar((c) => ({ ...c, eras: [...c.eras, { name: "Nouvelle ère", startYear: 0 }] }));
  }
  function removeEra(index: number) {
    setSaved(false);
    setCalendar((c) => ({ ...c, eras: c.eras.filter((_, i) => i !== index) }));
  }

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/worlds/${worldSlug}/calendar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calendar),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Impossible d'enregistrer le calendrier.");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Calendrier</h2>
        <p className="text-sm text-ink-muted">
          Un seul calendrier par monde : noms des mois, jours par mois, jours par semaine, ères nommées. Utilisé par
          la chronologie et les dates de jeu du monde.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-edge bg-panel-raised p-3">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          <input
            type="checkbox"
            checked={calendar.currentDate !== null}
            onChange={(e) => {
              setSaved(false);
              setCalendar((c) => ({ ...c, currentDate: e.target.checked ? blankCurrentDate() : null }));
            }}
          />
          Jour actuel de la campagne
        </label>
        <p className="text-xs text-ink-muted">
          Propagé partout où une date de jeu est affichée (ex. la chronologie centre sa vue dessus et le marque
          « Aujourd&apos;hui »).
        </p>
        {calendar.currentDate && (
          <>
            <GameDateInput
              calendar={calendar}
              value={calendar.currentDate}
              onChange={(date) => {
                setSaved(false);
                setCalendar((c) => ({ ...c, currentDate: date }));
              }}
              hidePeriod
            />
            <span className="text-xs text-ink-muted">
              Aujourd&apos;hui : <span className="font-semibold text-ink">{formatGameDate(calendar.currentDate, calendar)}</span>
            </span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Jours par semaine</span>
        <input
          type="number"
          min={1}
          max={30}
          value={calendar.daysPerWeek}
          onChange={(e) => {
            setSaved(false);
            setCalendar((c) => ({ ...c, daysPerWeek: Number(e.target.value) }));
          }}
          className="w-24 rounded border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Mois (dans l&apos;ordre)
        </span>
        <div className="flex flex-col gap-1.5">
          {calendar.months.map((month, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={month.name}
                onChange={(e) => updateMonth(i, { name: e.target.value })}
                placeholder="Nom du mois"
                className="min-w-[140px] flex-1 rounded border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
              />
              <input
                type="number"
                min={1}
                max={60}
                value={month.days}
                onChange={(e) => updateMonth(i, { days: Number(e.target.value) })}
                className="w-20 rounded border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
              />
              <span className="text-xs text-ink-muted">jours</span>
              <button
                type="button"
                onClick={() => moveMonth(i, -1)}
                disabled={i === 0}
                className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
                aria-label="Monter"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveMonth(i, 1)}
                disabled={i === calendar.months.length - 1}
                className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
                aria-label="Descendre"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeMonth(i)}
                disabled={calendar.months.length <= 1}
                className="text-xs text-danger hover:underline disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addMonth}
          className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          + Ajouter un mois
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Ères nommées (optionnel)
        </span>
        <div className="flex flex-col gap-1.5">
          {calendar.eras.map((era, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={era.name}
                onChange={(e) => updateEra(i, { name: e.target.value })}
                placeholder="le Troisième Âge"
                className="min-w-[160px] flex-1 rounded border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
              />
              <span className="text-xs text-ink-muted">à partir de l&apos;an</span>
              <input
                type="number"
                value={era.startYear}
                onChange={(e) => updateEra(i, { startYear: Number(e.target.value) })}
                className="w-24 rounded border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
              />
              <button type="button" onClick={() => removeEra(i)} className="text-xs text-danger hover:underline">
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addEra}
          className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          + Ajouter une ère
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="self-start rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-xs text-ink-muted">Enregistré.</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
