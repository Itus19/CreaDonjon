"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalKeyboard } from "@/components/shared/useModalKeyboard";
import NextSessionPanel from "./NextSessionPanel";

interface NextSessionResponse {
  campaignId: string | null;
  session: { scheduled_date: string; starts_at: string } | null;
}

function formatSessionDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Bouton "Prochaine session" en bas de la barre latérale joueuse (V2.1-4,
 * recalibré V3.1-9 : le texte pivoté à 90° d'origine concaténait tout en un
 * seul bloc continu ("Prochaine session — dimanche 27 septembre 2026"),
 * devenu illisible sur les hauteurs d'écran resserrées — retour utilisateur,
 * capture à l'appui). Reste vertical (retour utilisateur : "je voulais le
 * garder vertical") mais scindé en deux lignes distinctes — deux blocs sous
 * `writing-mode: vertical-rl` deviennent deux colonnes verticales cote à
 * cote plutôt qu'une seule longue colonne, chacune bien plus courte que
 * l'ancien texte concaténé.
 *
 * Un seul bouton désormais, confirmée ou non (plus deux présentations
 * différentes comme avant) : ouvre un panneau à onglets donnant accès aux
 * séances à venir, passées, et à la saisie des disponibilités
 * (`NextSessionPanel.tsx`).
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        className="rounded-md border border-accent px-1.5 py-2 font-mono text-[clamp(8px,1.3vh,11px)] leading-tight text-accent transition-colors hover:bg-panel-raised"
      >
        <span className="block">Prochaine session</span>
        <span className="block font-semibold">{data.session ? formatSessionDate(data.session.scheduled_date) : "à définir"}</span>
      </button>

      {open &&
        data.campaignId &&
        createPortal(
          <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Prochaine session">
            <div ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-lg border border-edge-strong bg-panel-raised p-4 shadow-2xl outline-none">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Prochaine session</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded px-1.5 py-0.5 text-ink-muted hover:bg-panel hover:text-ink">
                  ×
                </button>
              </div>
              <NextSessionPanel campaignId={data.campaignId} hasUpcoming={data.session !== null} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
