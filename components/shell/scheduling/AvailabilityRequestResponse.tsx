"use client";

import { useState } from "react";

interface AvailabilityRequest {
  id: string;
  title: string;
  candidate_dates: string[];
  starts_at: string;
  ends_at: string;
}
interface MyResponse {
  date: string;
  starts_at: string;
  ends_at: string;
}

function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Réponse à une ronde de demande (V3.1-8) — remplace `AvailabilityCalendar.tsx`
 * (calendrier libre sur 12 mois, retiré du parcours joueuse) : la joueuse ne
 * répond plus que sur les dates candidates précises proposées par le MJ,
 * une ligne par date plutôt qu'un calendrier à naviguer.
 */
export default function AvailabilityRequestResponse({
  campaignId,
  request,
  myResponses,
  onSaved,
}: {
  campaignId: string;
  request: AvailabilityRequest;
  myResponses: MyResponse[];
  onSaved: () => void;
}) {
  const byDate = new Map(myResponses.map((r) => [r.date, r]));
  const [drafts, setDrafts] = useState<Record<string, { startsAt: string; endsAt: string }>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set(myResponses.map((r) => r.date)));
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function draftFor(date: string) {
    return drafts[date] ?? { startsAt: byDate.get(date)?.starts_at.slice(0, 5) ?? request.starts_at.slice(0, 5), endsAt: byDate.get(date)?.ends_at.slice(0, 5) ?? request.ends_at.slice(0, 5) };
  }
  function setDraft(date: string, patch: Partial<{ startsAt: string; endsAt: string }>) {
    setDrafts((prev) => ({ ...prev, [date]: { ...draftFor(date), ...patch } }));
  }

  async function save(date: string) {
    const draft = draftFor(date);
    if (draft.endsAt <= draft.startsAt) {
      setError("L'heure de fin doit être après le début.");
      return;
    }
    setError(null);
    setSavingDate(date);
    const res = await fetch(`/api/campaigns/${campaignId}/scheduling/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, startsAt: draft.startsAt, endsAt: draft.endsAt }),
    });
    setSavingDate(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec de l'enregistrement.");
      return;
    }
    setSaved((prev) => new Set(prev).add(date));
    onSaved();
  }

  const dates = [...request.candidate_dates].sort();

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">{request.title}</p>
      {dates.map((date) => {
        const draft = draftFor(date);
        const isSaved = saved.has(date);
        return (
          <div key={date} className={`flex flex-col gap-1.5 rounded-md border p-2 ${isSaved ? "border-accent/40 bg-accent/5" : "border-edge"}`}>
            <span className="text-xs font-medium text-ink">{formatDateLabel(date)}</span>
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <input type="time" value={draft.startsAt} onChange={(e) => setDraft(date, { startsAt: e.target.value })} className="rounded border border-edge bg-transparent px-1.5 py-0.5 text-ink" />
              <span>à</span>
              <input type="time" value={draft.endsAt} onChange={(e) => setDraft(date, { endsAt: e.target.value })} className="rounded border border-edge bg-transparent px-1.5 py-0.5 text-ink" />
              <button
                type="button"
                disabled={savingDate === date}
                onClick={() => save(date)}
                className="ml-auto rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-50"
              >
                {isSaved ? "Modifier" : "Enregistrer"}
              </button>
            </div>
          </div>
        );
      })}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
