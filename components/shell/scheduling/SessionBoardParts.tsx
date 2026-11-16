"use client";

import { minutesToTime, type SessionCategory } from "@/src/core/scheduling/overlap";
import type { GridHeatmap, GridRequest, GridResponse } from "./AvailabilityGrid";

/** Ce que renvoie `/api/campaigns/[id]/scheduling/requests/open` (V3.1-16) — lu à l'identique par le MJ et la joueuse. */
export interface RankedDay {
  date: string;
  count: number;
  expected: number;
  start: number;
  end: number;
  durationMinutes: number;
  category: SessionCategory;
  people: { userId: string; name: string }[];
  respondentCount: number;
}
/** Une carte de la rangée des demandes (V3.1-190) — `RequestCard`, `src/server/services/scheduling.ts`. */
export interface RequestCard {
  id: string;
  title: string;
  candidateCount: number;
  startsAt: string;
  endsAt: string;
  respondedCount: number;
  expectedCount: number;
  missingNames: string[];
  ready: boolean;
  viewerResponded: boolean;
}
export interface OpenRequestBoard {
  /** V3.1-190 : toutes les demandes ouvertes ; `request` est celle affichée. */
  requests: RequestCard[];
  request: GridRequest | null;
  days: RankedDay[];
  heatmap: GridHeatmap | null;
  expected: number;
  responses: { userId: string; name: string; responded: boolean }[];
  myResponses: GridResponse[];
  declined: boolean;
  viewerId: string | null;
  targetMinutes: number;
}
export interface RealSession {
  id: string;
  scheduled_date: string;
  starts_at: string;
  duration_minutes: number;
  source?: string;
}

export function formatDayShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
export function formatDayLong(date: string): string {
  const label = new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
export function formatHours(minutes: number): string {
  return `${String(Math.round((minutes / 60) * 10) / 10).replace(".", ",")} h`;
}

/** Nombre de personnes ayant répondu à la ronde — d'après la carte de chaleur, qui porte déjà qui couvre chaque case. */
export function respondentCount(heatmap: GridHeatmap | null): number {
  return new Set((heatmap?.cells ?? []).flatMap((c) => c.users.map((u) => u.userId))).size;
}

/**
 * Les dates possibles (V3.1-16) : seulement les jours où quelqu'un est
 * disponible, déjà classés par le serveur (plus de présents, puis plus long
 * créneau). `onConfirm` absent : lecture seule (vue joueuse).
 */
export function PossibleDates({
  title,
  hint,
  days,
  targetMinutes,
  onConfirm,
}: {
  title: string;
  hint: string;
  days: RankedDay[];
  /** Durée visée : sous elle, l'étiquette dit « Moins de 5 h » plutôt que « Session complète ». */
  targetMinutes: number;
  onConfirm?: (day: RankedDay) => void;
}) {
  return (
    <section className="flex flex-col rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)] pb-1.5 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-2.5">
        <h2 className="font-display text-lg text-ink">{title}</h2>
        <span className="text-xs text-ink-muted">{hint}</span>
      </div>
      {days.length === 0 && <p className="border-t border-edge/40 px-4 py-3 text-sm italic text-ink-muted">Personne n&apos;a encore indiqué de disponibilité.</p>}
      {days.map((day, index) => {
        const full = day.category === "full";
        return (
          <div key={day.date} className="flex items-center gap-3.5 border-t border-edge/40 px-4 py-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-panel-raised text-xs font-semibold text-ink">{index + 1}</span>
            <span className="min-w-11 text-right font-display text-xl font-semibold text-ink">
              {day.count}/{day.expected}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <strong className="text-sm text-ink">{formatDayShort(day.date)}</strong>
                <span className="font-mono text-xs text-ink-muted">
                  {minutesToTime(day.start)}–{minutesToTime(day.end)} · {formatHours(day.durationMinutes)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${full ? "bg-success/20 text-success" : "bg-accent/15 text-accent"}`}>
                  {full ? "Session complète" : `Moins de ${formatHours(targetMinutes)}`}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">{day.people.map((p) => p.name).join(", ")}</div>
              <div className="mt-1.5 h-1 max-w-80 rounded-full bg-panel-raised">
                <div className="h-1 rounded-full bg-accent" style={{ width: `${Math.round((100 * day.count) / Math.max(day.expected, 1))}%` }} />
              </div>
            </div>
            {onConfirm && (
              <button
                type="button"
                onClick={() => onConfirm(day)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${full ? "bg-accent font-medium text-accent-ink hover:bg-accent-hover" : "border border-accent text-accent hover:bg-accent/10"}`}
              >
                Confirmer
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** « Séances à venir » / « Déjà jouées » : une ligne par séance, `onCancel` absent en lecture seule. */
export function SessionsCard({
  title,
  sessions,
  emptyLabel,
  muted,
  onCancel,
}: {
  title: string;
  sessions: RealSession[];
  emptyLabel: string;
  muted?: boolean;
  onCancel?: (id: string) => void;
}) {
  return (
    <section className="rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)] p-4">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {title} · {sessions.length}
      </span>
      <div className="mt-2 flex flex-col">
        {sessions.length === 0 && <p className="py-2 text-sm italic text-ink-muted">{emptyLabel}</p>}
        {sessions.map((s) => (
          <div key={s.id} className={`flex items-center gap-2.5 border-t border-edge/30 py-2 text-sm ${muted ? "text-ink-muted" : "text-ink"}`}>
            <span className="flex-1">
              {formatDayShort(s.scheduled_date)} · {s.starts_at.slice(0, 5)} · {formatHours(s.duration_minutes)}
            </span>
            {onCancel && (
              <button type="button" onClick={() => onCancel(s.id)} className="rounded-full border border-danger px-2.5 py-0.5 text-xs text-danger transition-colors hover:bg-danger/10">
                Annuler
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

function untilLabel(date: string): string {
  const n = daysUntil(date);
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return "demain";
  return `dans ${n} jours`;
}

function formatDayMonth(date: string): { day: string; month: string } {
  const d = new Date(`${date}T00:00:00`);
  return { day: String(d.getDate()), month: d.toLocaleDateString("fr-FR", { month: "short" }) };
}

/** La prochaine séance confirmée, en tête du Calendrier réel (MJ sans demande, et joueuse) — c'est ce qu'on vient chercher en premier. */
export function NextSessionCard({ session, loading }: { session: RealSession | null; loading?: boolean }) {
  return (
    <section className="flex items-center gap-5 rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)] p-6">
      {session ? (
        <>
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-[16px] border border-accent/60 bg-accent/15">
            <span className="text-xs text-accent">{formatDayMonth(session.scheduled_date).month}</span>
            <span className="font-display text-3xl font-bold leading-none text-ink">{formatDayMonth(session.scheduled_date).day}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Prochaine séance confirmée</div>
            <div className="font-display text-2xl font-semibold text-ink">
              {formatDayLong(session.scheduled_date)} · {session.starts_at.slice(0, 5)}
            </div>
            <div className="text-xs text-ink-muted">
              environ {formatHours(session.duration_minutes)} · {untilLabel(session.scheduled_date)}
            </div>
          </div>
        </>
      ) : (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Prochaine séance</div>
          <div className="text-sm italic text-ink-muted">{loading ? "Chargement…" : "Aucune séance confirmée pour l'instant."}</div>
        </div>
      )}
    </section>
  );
}

/**
 * V3.1-190 — la rangée des demandes ouvertes, en tête de l'écran : une carte
 * par demande, celle affichée en doré. Côté MJ (« Demandes en cours ») : état
 * « Prête à fixer » / « En attente » et la barre des réponses, plus « +
 * Nouvelle demande ». Côté joueuse (« Demandes du MJ ») : « À répondre » ou
 * « ✓ Répondu ».
 */
export function RequestTabs({
  requests,
  selectedId,
  onSelect,
  mode,
  onNew,
}: {
  requests: RequestCard[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  mode: "mj" | "joueur";
  onNew?: () => void;
}) {
  // Sans demande ouverte, l'écran vide a déjà son bouton « Demander les disponibilités ».
  if (requests.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {mode === "mj" ? "Demandes en cours" : "Demandes du MJ"} · {requests.length}
      </span>
      <div className="flex flex-wrap items-stretch gap-2.5">
        {requests.map((r) => {
          const choisie = r.id === selectedId;
          const pourcent = r.expectedCount > 0 ? Math.round((r.respondedCount / r.expectedCount) * 100) : 0;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              aria-pressed={choisie}
              title={mode === "mj" && r.missingNames.length > 0 ? `Manquent : ${r.missingNames.join(", ")}` : undefined}
              className={`flex w-64 flex-col gap-1.5 rounded-[14px] border px-3.5 py-3 text-left transition-colors ${
                choisie ? "border-accent bg-panel-raised" : "border-edge bg-panel hover:bg-panel-raised"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">{r.title}</span>
                {mode === "mj" ? (
                  r.ready ? (
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink">Prête à fixer</span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-edge-strong px-2 py-0.5 text-xs text-ink-soft">En attente</span>
                  )
                ) : r.viewerResponded ? (
                  <span className="shrink-0 rounded-full bg-success/20 px-2 py-0.5 text-xs font-semibold text-success">✓ Répondu</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink">À répondre</span>
                )}
              </span>
              {mode === "mj" ? (
                <span className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-sunken">
                    <span className={`block h-full rounded-full ${r.ready ? "bg-accent" : "bg-ink-muted"}`} style={{ width: `${pourcent}%` }} />
                  </span>
                  <span className="font-mono text-xs font-medium text-ink">
                    {r.respondedCount}/{r.expectedCount}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-ink-muted">
                  {r.candidateCount} jours · {r.startsAt.slice(0, 5)} – {r.endsAt.slice(0, 5)}
                </span>
              )}
            </button>
          );
        })}
        {onNew && (
          <button
            type="button"
            onClick={onNew}
            className="rounded-[14px] border border-dashed border-edge-strong px-4 text-sm font-semibold text-accent transition-colors hover:bg-panel-raised"
          >
            + Nouvelle demande
          </button>
        )}
      </div>
    </div>
  );
}

/** V3.1-190 — la ligne « Réponses » du MJ : qui a répondu à la demande affichée, et qui manque. */
export function ResponsesLine({ responses }: { responses: { userId: string; name: string; responded: boolean }[] }) {
  if (responses.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-ink-muted">Réponses :</span>
      {responses.map((r) => (
        <span key={r.userId} className={`rounded-full px-2 py-0.5 ${r.responded ? "bg-success/15 text-success" : "border border-edge text-ink-muted"}`}>
          {r.responded ? `✓ ${r.name}` : `${r.name} · en attente`}
        </span>
      ))}
    </div>
  );
}

