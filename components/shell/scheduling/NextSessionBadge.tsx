"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalKeyboard } from "@/components/shared/useModalKeyboard";
import AvailabilityCalendar from "./AvailabilityCalendar";

interface NextSessionResponse {
  campaignId: string | null;
  session: { scheduled_date: string; starts_at: string } | null;
}

function formatSessionDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Bannière verticale en bas de la barre latérale joueuse (V2.1-4, retour
 * utilisateur : "prochaine session dimanche 27 septembre 2026" écrit
 * verticalement). Devient un bouton tant qu'aucune séance n'est confirmée
 * — ouvre le calendrier de disponibilités plutôt que de rester un simple
 * message, pour que le joueur contribue tout de suite.
 */
export default function NextSessionBadge({ worldSlug }: { worldSlug: string }) {
  const [data, setData] = useState<NextSessionResponse | null>(null);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalKeyboard({ open, onClose: () => setOpen(false), panelRef });

  useEffect(() => {
    fetch(`/api/worlds/${worldSlug}/scheduling/next-session`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(setData)
      .catch(() => {});
  }, [worldSlug]);

  if (!data || !data.campaignId) return null;

  return (
    <>
      {data.session ? (
        <span
          className="border-t border-edge py-2 font-mono text-[clamp(7px,1.15vh,10px)] text-accent"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Prochaine session — {formatSessionDate(data.session.scheduled_date)}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-accent px-1 py-2 font-mono text-[clamp(7px,1.15vh,10px)] text-accent-ink hover:bg-accent-hover"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Renseigner mes disponibilités
        </button>
      )}

      {open &&
        data.campaignId &&
        createPortal(
          <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Mes disponibilités">
            <div ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-lg border border-edge-strong bg-panel-raised p-4 shadow-2xl outline-none">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Mes disponibilités</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded px-1.5 py-0.5 text-ink-muted hover:bg-panel hover:text-ink">
                  ×
                </button>
              </div>
              <AvailabilityCalendar campaignId={data.campaignId} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
