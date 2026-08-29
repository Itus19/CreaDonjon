"use client";

import Dropdown from "@/components/shared/Dropdown";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { DATE_PRECISIONS, type DatePrecision, type GameDate } from "@/src/core/calendar/types";
import { formatGameDate } from "@/src/core/calendar/formatDate";

const PRECISION_LABELS_FR: Record<DatePrecision, string> = {
  day: "Jour",
  month: "Mois",
  season: "Saison",
  year: "Année",
  decade: "Décennie",
  era: "Ère",
};

/**
 * Saisie d'une date de jeu structurée (V2-H2, specs/wiki-blocs.md §3) — un
 * seul composant partagé entre le bloc `timeline` et, en phase 3, la
 * migration des dates ingame en texte libre des blocs `personality`/
 * `relationship`. Respecte le calendrier du monde (noms de mois, nombre de
 * mois) plutôt qu'un calendrier grégorien codé en dur.
 */
export default function GameDateInput({
  calendar,
  value,
  onChange,
}: {
  calendar: CalendarConfigInput;
  value: GameDate;
  onChange: (date: GameDate) => void;
}) {
  const monthOptions = calendar.months.map((m, i) => ({ value: String(i + 1), label: m.name }));
  const showMonth = value.precision === "day" || value.precision === "month";
  const showDay = value.precision === "day";
  const maxDay = calendar.months[(value.month ?? 1) - 1]?.days ?? 31;

  function set(patch: Partial<GameDate>) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Dropdown
          value={value.precision}
          options={DATE_PRECISIONS.map((p) => ({ value: p, label: PRECISION_LABELS_FR[p] }))}
          onChange={(v) => set({ precision: v as DatePrecision, month: v === "day" || v === "month" ? (value.month ?? 1) : null, day: v === "day" ? (value.day ?? 1) : null })}
          aria-label="Précision de la date"
        />
        <input
          type="number"
          value={value.year}
          onChange={(e) => set({ year: Number(e.target.value) })}
          className="w-20 rounded border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
          aria-label="Année"
        />
        {showMonth && (
          <Dropdown
            value={String(value.month ?? 1)}
            options={monthOptions}
            onChange={(v) => set({ month: Number(v) })}
            aria-label="Mois"
          />
        )}
        {showDay && (
          <input
            type="number"
            min={1}
            max={maxDay}
            value={value.day ?? 1}
            onChange={(e) => set({ day: Number(e.target.value) })}
            className="w-16 rounded border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
            aria-label="Jour"
          />
        )}
      </div>

      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={value.end !== null}
          onChange={(e) => set({ end: e.target.checked ? { year: value.year, month: null, day: null } : null })}
        />
        Période (a une fin) — une guerre dure
        {value.end && (
          <input
            type="number"
            value={value.end.year}
            onChange={(e) => set({ end: { ...value.end!, year: Number(e.target.value) } })}
            className="w-20 rounded border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
            aria-label="Année de fin"
          />
        )}
      </label>

      <input
        value={value.label ?? ""}
        onChange={(e) => set({ label: e.target.value.trim() === "" ? null : e.target.value })}
        placeholder="Étiquette libre (facultatif) : « le Troisième Hiver Noir »"
        className="rounded border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
      />

      <span className="text-[10px] text-ink-muted">Affiché : {formatGameDate(value, calendar)}</span>
    </div>
  );
}
