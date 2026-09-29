"use client";

import { Fragment, useState } from "react";
import { minutesToTime } from "@/src/core/scheduling/overlap";

interface HeatmapCell {
  date: string;
  slotStart: number;
  users: { userId: string; name: string | null }[];
}

function formatDateHeader(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

/**
 * Carte de chaleur des disponibilités (V3.1-8, retour utilisateur : "des
 * zones de plus en plus foncées... avec une infobulle au survol") — lecture
 * seule, complète le classement/bouton Confirmer déjà existant
 * (`SchedulingMjPanel.tsx`) plutôt que de le remplacer.
 */
export default function AvailabilityHeatmap({
  dates,
  slots,
  cells,
  totalMembers,
}: {
  dates: string[];
  slots: number[];
  cells: HeatmapCell[];
  totalMembers: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const cellByKey = new Map(cells.map((c) => [`${c.date}|${c.slotStart}`, c]));

  if (dates.length === 0 || slots.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid gap-px"
        style={{ gridTemplateColumns: `48px repeat(${dates.length}, 28px)` }}
      >
        <div />
        {dates.map((date) => (
          <div key={date} className="pb-1 text-center font-mono text-[10px] text-ink-muted">
            {formatDateHeader(date)}
          </div>
        ))}
        {slots.map((slotStart) => (
          <Fragment key={slotStart}>
            <div className="pr-1 text-right font-mono text-[10px] leading-[18px] text-ink-muted">
              {slotStart % 60 === 0 ? minutesToTime(slotStart) : ""}
            </div>
            {dates.map((date) => {
              const key = `${date}|${slotStart}`;
              const cell = cellByKey.get(key);
              const count = cell?.users.length ?? 0;
              const intensity = totalMembers > 0 ? count / totalMembers : 0;
              return (
                <div key={key} className="relative">
                  <button
                    type="button"
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered((h) => (h === key ? null : h))}
                    className="h-[18px] w-full border border-panel-sunken"
                    style={{ backgroundColor: count > 0 ? "var(--accent)" : "var(--panel-sunken)", opacity: count > 0 ? 0.25 + intensity * 0.75 : 1 }}
                    aria-label={`${formatDateHeader(date)} ${minutesToTime(slotStart)} — ${count} disponible${count !== 1 ? "s" : ""}`}
                  />
                  {hovered === key && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-edge-strong bg-panel-raised px-2 py-1 text-[10px] text-ink shadow-lg">
                      <div className="font-medium">
                        {formatDateHeader(date)} {minutesToTime(slotStart)}
                      </div>
                      {count === 0 ? <div className="text-ink-muted">Personne disponible</div> : cell?.users.map((u) => <div key={u.userId}>{u.name ?? "?"}</div>)}
                    </div>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
