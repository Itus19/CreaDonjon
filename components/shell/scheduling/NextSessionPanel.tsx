"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { chargerProchaineSession } from "@/src/server/services/prochaineSession";
import AvailabilityGrid from "./AvailabilityGrid";
import { NextSessionCard, PossibleDates, RequestTabs, SessionsCard, type OpenRequestBoard, type RealSession } from "./SessionBoardParts";

/**
 * Page « Prochaine session » côté joueuse (V3.1-9, redessinée V3.1-16 d'après
 * l'esquisse « Vue joueuse », `Joueuse.dc.html`) : le même écran que le
 * Calendrier réel du MJ, **sans aucun outil MJ** — ni durée visée, ni
 * annulation, ni confirmation, ni date à la main :
 *
 * 1. la prochaine séance confirmée, en tête — c'est ce qu'on vient chercher ;
 * 2. V3.1-190 : la rangée « Demandes du MJ » (`RequestTabs`), chacune « À
 *    répondre » ou « ✓ Répondu », puis, pour la demande choisie, sa grille à
 *    bascule (`AvailabilityGrid.tsx`) et « Aucune date ne me va » ;
 * 3. les dates qui se dessinent, en lecture seule ;
 * 4. séances à venir et déjà jouées.
 */
export default function NextSessionPanel({
  worldSlug,
  initial,
}: {
  worldSlug: string;
  /**
   * V3.1-62, étape 3 (C1) : ce que la page a lu avec elle — `null` si le monde
   * n'a pas de campagne. Les relectures après un geste passent par la route
   * `requests/open`.
   */
  initial: Awaited<ReturnType<typeof chargerProchaineSession>>;
}) {
  const campaignId = initial?.campaignId ?? null;
  const [board, setBoard] = useState<OpenRequestBoard | null>(initial?.board ?? null);
  const [upcoming] = useState<RealSession[]>(initial?.upcoming ?? []);
  const [past] = useState<RealSession[]>(initial?.past ?? []);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  /** La demande affichée ; `null` : la plus ancienne. */
  const demandeVisee = useRef<string | null>(null);

  const loadBoard = useCallback(
    (requestId: string | null = demandeVisee.current) => {
      if (!campaignId) return;
      demandeVisee.current = requestId;
      const query = requestId ? `?requestId=${encodeURIComponent(requestId)}` : "";
      fetch(`/api/campaigns/${campaignId}/scheduling/requests/open${query}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
        .then((body: OpenRequestBoard) => {
          setError(null);
          setBoard(body);
        })
        .catch(() => setError("Impossible de charger les demandes de disponibilités."));
    },
    [campaignId]
  );

  // Le badge du rail est lu par le layout : il suit au prochain changement de page.
  useEffect(() => setError(null), [worldSlug]);

  async function declineRequest(requestId: string) {
    if (!campaignId) return;
    setDeclining(true);
    const res = await fetch(`/api/campaigns/${campaignId}/scheduling/requests/${requestId}/decline`, { method: "POST" });
    setDeclining(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec de l'enregistrement.");
      return;
    }
    loadBoard(requestId);
  }

  if (!campaignId) return <p className="text-sm italic text-ink-muted">Ce monde n&apos;a pas encore de campagne.</p>;

  const next = upcoming[0] ?? null;
  const request = board?.request ?? null;
  const carte = board?.requests.find((r) => r.id === request?.id);

  return (
    <div className="flex flex-col gap-5">
      <NextSessionCard session={next} />

      {board && (
        <RequestTabs requests={board.requests} selectedId={request?.id ?? null} onSelect={(id) => loadBoard(id)} mode="joueur" />
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <section className="flex flex-col gap-3 rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)] p-4">
        {board && request ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg text-ink">{request.title} — tes disponibilités</h2>
                <div className="mt-0.5 text-xs text-ink-muted">
                  Le MJ propose {request.candidate_dates.length} jours, entre {request.starts_at.slice(0, 5)} et {request.ends_at.slice(0, 5)}. Coche tout ce qui t&apos;irait.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${carte?.viewerResponded ? "bg-success/20 text-success" : "bg-accent/15 text-accent"}`}>
                  {board.declined ? "Aucune date ne te va" : carte?.viewerResponded ? "Réponse enregistrée" : "Pas encore répondu"}
                </span>
                {!board.declined && (
                  <button
                    type="button"
                    onClick={() => declineRequest(request.id)}
                    disabled={declining}
                    className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
                  >
                    Aucune date ne me va
                  </button>
                )}
              </div>
            </div>
            <AvailabilityGrid
              key={`${request.id}-${board.declined ? "non" : "oui"}`}
              campaignId={campaignId}
              request={request}
              myResponses={board.myResponses}
              heatmap={board.heatmap}
              expected={board.expected}
              viewerId={board.viewerId}
              onSaved={() => loadBoard(request.id)}
            />
            <p className="text-xs text-ink-muted">
              Tes cases s&apos;enregistrent toutes seules ; en cocher une annule « Aucune date ne me va ». Tu peux revenir les modifier tant que le MJ n&apos;a pas fixé la date.
            </p>
          </>
        ) : (
          <p className="text-sm italic text-ink-muted">Aucune demande de disponibilités pour le moment.</p>
        )}
      </section>

      {board && request && (
        <PossibleDates title="Les dates qui se dessinent" hint="c'est le MJ qui choisit · seuls les jours où quelqu'un est disponible" days={board.days} targetMinutes={board.targetMinutes} />
      )}

      <div className="@container">
        <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
          <SessionsCard title="Séances à venir" sessions={upcoming} emptyLabel="Aucune séance confirmée." />
          <SessionsCard title="Déjà jouées" sessions={past} emptyLabel="Aucune séance passée." muted />
        </div>
      </div>
    </div>
  );
}
