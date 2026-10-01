"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateSlots, rangeFromSlots } from "@/src/core/scheduling/availabilityGrid";
import { minutesToTime, timeToMinutes } from "@/src/core/scheduling/overlap";

const STEP_MINUTES = 30;
/** Géométrie de l'esquisse V3.1-16 (`Main.dc.html`/`Joueuse.dc.html`) — l'info-bulle se place d'après elle. */
const LABEL_W = 68;
/** En-tête de date : le mois (au premier jour et à chaque changement), le jour abrégé, le numéro. */
const HEADER_H = 58;
/** Colonnes élargies quand il y a peu de dates (esquisse « Formulaire »/« EnCours ») : jamais sous 40 px, jamais au-delà de 140. */
const CELL_W_MIN = 40;
const CELL_W_MAX = 140;
const CELL_H = 20;
const TIP_W = 250;

export interface GridRequest {
  id: string;
  title: string;
  candidate_dates: string[];
  starts_at: string;
  ends_at: string;
}
export interface GridResponse {
  date: string;
  starts_at: string;
  ends_at: string;
}
export interface GridHeatmap {
  slots: number[];
  step: number;
  cells: { date: string; slotStart: number; users: { userId: string; name: string }[] }[];
}

type Mode = "mine" | "table";

/**
 * Fond OPAQUE des cases figées (colonne des heures, coin) : `--panel` est
 * translucide, et les cases qui défilent dessous transparaîtraient. Le
 * panneau est posé sur le fond de page, l'accent par-dessus quand la case
 * est allumée par le survol.
 */
function stickyBackground(lit: boolean): React.CSSProperties {
  const layers = ["linear-gradient(var(--panel), var(--panel))", "var(--bg)"];
  if (lit) layers.unshift("linear-gradient(color-mix(in oklch, var(--accent) 25%, transparent), color-mix(in oklch, var(--accent) 25%, transparent))");
  return { background: layers.join(", ") };
}

function monthShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { month: "short" });
}
function weekdayShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short" });
}
function weekdayLong(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" });
}
function dayIndex(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}
function slotsFromRange(startMinutes: number, endMinutes: number, allSlots: readonly number[]): Set<number> {
  return new Set(allSlots.filter((s) => s >= startMinutes && s + STEP_MINUTES <= endMinutes));
}
function formatHours(slotCount: number): string {
  return `${String((slotCount * STEP_MINUTES) / 60).replace(".", ",")} h cochées`;
}

/**
 * La grille du Calendrier réel (V3.1-16), commune au MJ et à la joueuse :
 * UNE grille et une bascule « Mes disponibilités / Toute la table », jamais
 * deux grilles empilées (esquisse retenue par l'auteur, cadre A).
 *
 * - *Mes disponibilités* : on peint ses créneaux. La peinture et
 *   l'enregistrement sont repris tels quels de l'ancien
 *   `AvailabilityPaintGrid` : une plage continue par jour (`rangeFromSlots`),
 *   enregistrée seule au relâchement de la souris — les réponses déjà
 *   déposées gardent exactement leur forme.
 * - *Toute la table* : carte de chaleur, et une info-bulle qui nomme les
 *   personnes disponibles, la personne qui regarde en tête.
 *
 * Toutes les heures tiennent sans défilement vertical (la grille prend sa
 * hauteur), une ligne de clôture affiche la dernière heure, et la colonne
 * des heures reste à gauche quand on fait défiler les jours. Au survol, la
 * date et l'heure de la case s'allument, et sa ligne et sa colonne
 * s'éclaircissent — par une ombre intérieure, qui se pose aussi bien sur une
 * case vide que sur une case teintée (un filtre de luminosité ne change rien
 * à un fond transparent).
 */
export default function AvailabilityGrid({
  campaignId,
  request,
  myResponses,
  heatmap,
  expected,
  viewerId,
  onSaved,
  preview,
}: {
  campaignId: string;
  request: GridRequest;
  myResponses: GridResponse[];
  heatmap: GridHeatmap | null;
  /** Personnes attendues à la table : le dénominateur de l'info-bulle. */
  expected: number;
  viewerId: string | null;
  onSaved: () => void;
  /** Aperçu du formulaire de demande : la grille telle que la verront les joueuses, sans bascule, sans peinture, sans enregistrement. */
  preview?: boolean;
}) {
  const dates = useMemo(() => [...request.candidate_dates].sort(), [request.candidate_dates]);
  const slots = useMemo(() => generateSlots(timeToMinutes(request.starts_at), timeToMinutes(request.ends_at), STEP_MINUTES), [request.starts_at, request.ends_at]);

  const [mode, setMode] = useState<Mode>("mine");
  const [hover, setHover] = useState<{ date: string; slot: number } | null>(null);
  const [painted, setPainted] = useState<Record<string, Set<number>>>(() => {
    const initial: Record<string, Set<number>> = {};
    for (const r of myResponses) initial[r.date] = slotsFromRange(timeToMinutes(r.starts_at), timeToMinutes(r.ends_at), slots);
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dragModeRef = useRef<"add" | "remove" | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setAvailableWidth(el.clientWidth));
    observer.observe(el);
    setAvailableWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const cellW = Math.max(CELL_W_MIN, Math.min(CELL_W_MAX, Math.floor((availableWidth - LABEL_W - 2) / Math.max(dates.length, 1))));
  const touchedDatesRef = useRef<Set<string>>(new Set());

  const usersByCell = useMemo(() => {
    const map = new Map<string, { userId: string; name: string }[]>();
    for (const c of heatmap?.cells ?? []) map.set(`${c.date}|${c.slotStart}`, c.users);
    return map;
  }, [heatmap]);

  function paintCell(date: string, slotStart: number, add: boolean) {
    setPainted((prev) => {
      const next = { ...prev };
      const set = new Set(next[date] ?? []);
      if (add) set.add(slotStart);
      else set.delete(slotStart);
      next[date] = set;
      return next;
    });
    touchedDatesRef.current.add(date);
  }

  function startDrag(date: string, slotStart: number) {
    if (mode !== "mine" || preview) return;
    const add = !(painted[date]?.has(slotStart) ?? false);
    dragModeRef.current = add ? "add" : "remove";
    paintCell(date, slotStart, add);
  }

  function enterCell(date: string, slotStart: number) {
    setHover({ date, slot: slotStart });
    if (mode === "mine" && !preview && dragModeRef.current !== null) paintCell(date, slotStart, dragModeRef.current === "add");
  }

  /** `current` : l'état peint à enregistrer — passé explicitement au clavier, où le nouvel état n'est pas encore rendu. */
  async function saveTouchedDates(current: Record<string, Set<number>> = painted) {
    const touched = [...touchedDatesRef.current];
    touchedDatesRef.current.clear();
    if (touched.length === 0) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    let failed = false;
    await Promise.all(
      touched.map(async (date) => {
        const range = rangeFromSlots([...(current[date] ?? [])], STEP_MINUTES);
        const res = range
          ? await fetch(`/api/campaigns/${campaignId}/scheduling/availability`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date, startsAt: minutesToTime(range.startMinutes), endsAt: minutesToTime(range.endMinutes) }),
            })
          : await fetch(`/api/campaigns/${campaignId}/scheduling/availability/${date}`, { method: "DELETE" });
        if (!res.ok) {
          failed = true;
          const body = await res.json().catch(() => null);
          setError(body?.error ?? "Échec de l'enregistrement.");
        }
      })
    );
    setSaving(false);
    setSaved(!failed);
    onSaved();
  }

  function endDrag() {
    if (dragModeRef.current === null) return;
    dragModeRef.current = null;
    void saveTouchedDates();
  }

  const checkedSlots = Object.values(painted).reduce((sum, set) => sum + set.size, 0);
  const hoverIndex = hover ? dates.indexOf(hover.date) : -1;
  const hoverSlotIndex = hover ? slots.indexOf(hover.slot) : -1;
  const hoverUsers = hover ? (usersByCell.get(`${hover.date}|${hover.slot}`) ?? []) : [];
  const orderedHoverUsers = [...hoverUsers.filter((u) => u.userId === viewerId), ...hoverUsers.filter((u) => u.userId !== viewerId)];
  const tipFlip = hoverIndex > dates.length - 6;
  const tipLeft = LABEL_W + hoverIndex * cellW + (tipFlip ? -TIP_W - 8 : cellW + 8);
  const tipTop = HEADER_H + hoverSlotIndex * CELL_H - 6;

  function heatStyle(count: number): React.CSSProperties | undefined {
    if (count === 0 || expected === 0) return undefined;
    const pct = Math.round(18 + (82 * Math.min(count, expected)) / expected);
    return { backgroundColor: `color-mix(in oklch, var(--accent) ${pct}%, transparent)` };
  }

  return (
    <div className="flex flex-col gap-3" onMouseUp={endDrag}>
      {!preview && (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Vue de la grille" className="inline-flex gap-0.5 rounded-full border border-edge bg-panel-sunken p-[3px]">
          {(
            [
              ["mine", "Mes disponibilités"],
              ["table", "Toute la table"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setHover(null);
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${mode === value ? "bg-accent font-semibold text-accent-ink" : "text-ink hover:bg-panel-raised"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "mine" && (
          <span className="text-xs text-ink-muted">
            Clique ou glisse pour cocher · <span className="font-mono">{formatHours(checkedSlots)}</span>
            {saving && <span className="ml-2 text-accent">Enregistrement…</span>}
            {!saving && saved && !error && <span className="ml-2 text-success">Enregistré ✓</span>}
          </span>
        )}
      </div>
      )}

      <div
        ref={scrollerRef}
        className="relative overflow-x-auto overflow-y-hidden rounded-[10px] border border-edge bg-panel-sunken pb-2.5"
        onMouseLeave={() => {
          setHover(null);
          endDrag();
        }}
      >
        <div className="relative w-max select-none">
          <div className="flex">
            <div className="sticky left-0 z-[4] shrink-0 border-b border-r border-edge" style={{ width: LABEL_W, ...stickyBackground(false) }} />
            {dates.map((date, index) => {
              const lit = hover?.date === date;
              const weekend = dayIndex(date) === 0 || dayIndex(date) === 6;
              // Le mois au premier jour et à chaque changement : une demande à
              // cheval sur deux mois ne dit pas, sinon, à quel mois est le « 1 ».
              const showMonth = index === 0 || date.slice(0, 7) !== dates[index - 1].slice(0, 7);
              return (
                <div
                  key={date}
                  className={`flex shrink-0 flex-col items-center justify-end border-b border-edge pb-1.5 font-mono text-xs ${lit ? "bg-accent/25 text-accent" : weekend ? "bg-panel-raised/50 text-ink-muted" : "text-ink-muted"}`}
                  style={{ width: cellW, height: HEADER_H }}
                >
                  <span className="h-3.5 font-sans text-xs font-semibold leading-3.5 text-accent">{showMonth ? monthShort(date) : ""}</span>
                  <span>{weekdayShort(date)}</span>
                  <span className={`text-[13px] font-medium ${lit ? "text-accent" : "text-ink"}`}>{Number(date.slice(8, 10))}</span>
                </div>
              );
            })}
          </div>

          {slots.map((slotStart) => {
            const fullHour = slotStart % 60 === 0;
            const rowLit = hover?.slot === slotStart;
            return (
              <div key={slotStart} className="flex">
                <div
                  className={`sticky left-0 z-[2] shrink-0 border-r border-edge pr-2 text-right font-mono text-xs leading-5 ${rowLit ? "text-accent" : "text-ink-muted"}`}
                  style={{ width: LABEL_W, height: CELL_H, ...stickyBackground(rowLit) }}
                >
                  {fullHour ? minutesToTime(slotStart) : ""}
                </div>
                {dates.map((date) => {
                  const isMine = painted[date]?.has(slotStart) ?? false;
                  const users = usersByCell.get(`${date}|${slotStart}`) ?? [];
                  const lit = hover !== null && (hover.date === date || hover.slot === slotStart);
                  const exact = hover?.date === date && hover.slot === slotStart;
                  const endOfWeek = dayIndex(date) === 0;
                  const label =
                    mode === "mine"
                      ? `${weekdayLong(date)} ${minutesToTime(slotStart)} — ${isMine ? "coché" : "libre"}`
                      : `${weekdayLong(date)} ${minutesToTime(slotStart)} — ${users.length} sur ${expected} disponibles`;
                  return (
                    <button
                      key={date}
                      type="button"
                      aria-label={label}
                      aria-pressed={mode === "mine" ? isMine : undefined}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        startDrag(date, slotStart);
                      }}
                      onMouseEnter={() => enterCell(date, slotStart)}
                      onFocus={() => setHover({ date, slot: slotStart })}
                      onKeyDown={(e) => {
                        if (mode === "mine" && !preview && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          const set = new Set(painted[date] ?? []);
                          if (isMine) set.delete(slotStart);
                          else set.add(slotStart);
                          paintCell(date, slotStart, !isMine);
                          void saveTouchedDates({ ...painted, [date]: set });
                        }
                      }}
                      className={[
                        "shrink-0 border-r",
                        endOfWeek ? "border-r-edge-strong" : "border-r-edge/40",
                        fullHour ? "border-t border-t-edge/70" : "",
                        mode === "mine" ? (isMine ? "bg-accent" : "") : "",
                        mode === "table" || preview ? "cursor-default" : "cursor-pointer",
                        lit ? "shadow-[inset_0_0_0_40px_color-mix(in_oklch,var(--ink)_9%,transparent)]" : "",
                        exact ? "outline outline-2 -outline-offset-2 outline-ink" : "",
                      ].join(" ")}
                      style={{ width: cellW, height: CELL_H, ...(mode === "table" ? heatStyle(users.length) : undefined) }}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Ligne de clôture : sans elle, la grille finit sur la case
              21:30–22:00 et la dernière heure proposée ne se lit nulle part. */}
          <div className="flex">
            <div
              className="sticky left-0 z-[2] shrink-0 border-r border-t border-edge pr-2 text-right font-mono text-xs leading-[22px] text-accent"
              style={{ width: LABEL_W, height: 22, ...stickyBackground(false) }}
            >
              {request.ends_at.slice(0, 5)}
            </div>
          </div>

          {mode === "table" && hover && hoverIndex >= 0 && hoverSlotIndex >= 0 && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-[6] rounded-[10px] border border-edge-strong bg-panel-raised px-3 py-2.5 shadow-lg"
              style={{ left: tipLeft, top: tipTop, width: TIP_W }}
            >
              <div className="whitespace-nowrap text-sm font-semibold text-ink">
                {weekdayLong(hover.date)} · {minutesToTime(hover.slot)}–{minutesToTime(hover.slot + STEP_MINUTES)}
              </div>
              <div className="mb-1.5 mt-0.5 text-xs text-accent">
                {hoverUsers.length}/{expected} disponibles
              </div>
              {orderedHoverUsers.length === 0 ? (
                <div className="text-sm text-ink-muted">Personne pour l&apos;instant</div>
              ) : (
                orderedHoverUsers.map((u) => (
                  <div key={u.userId} className="text-sm text-ink">
                    {u.name}
                    {u.userId === viewerId ? " (toi)" : ""}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {mode === "table" && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <span>Moins</span>
          {[30, 55, 80, 100].map((pct) => (
            <span key={pct} className="inline-block h-3.5 w-3.5 rounded-[3px]" style={{ backgroundColor: `color-mix(in oklch, var(--accent) ${pct}%, transparent)` }} />
          ))}
          <span>Toute la table</span>
          <span className="flex-1" />
          <span>Survole une case pour voir qui est là</span>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
