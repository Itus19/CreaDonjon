"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import GameDateInput from "@/components/shared/GameDateInput";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import { useModalKeyboard } from "@/components/shared/useModalKeyboard";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { GameDate } from "@/src/core/calendar/types";

export interface Redactrice {
  userId: string;
  role: "gm" | "player";
  name: string | null;
}

const VERRE = "rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)]";

/** Le contenu de la feuille « Assigner le devoir » : séance réelle et date en jeu proposées d'office, « Qui l'écrit » présélectionné. */
function Contenu({
  calendrier,
  libelleSeance,
  dateEnJeu,
  onDateEnJeu,
  roster,
  choisie,
  suggeree,
  onChoisir,
  envoi,
  erreur,
  onEnvoyer,
  onFermer,
}: {
  calendrier: CalendarConfigInput;
  libelleSeance: string | null;
  dateEnJeu: GameDate;
  onDateEnJeu: (d: GameDate) => void;
  roster: Redactrice[];
  choisie: string;
  suggeree: string | null;
  onChoisir: (id: string) => void;
  envoi: boolean;
  erreur: string | null;
  onEnvoyer: () => void;
  onFermer: () => void;
}) {
  const nomChoisie = roster.find((r) => r.userId === choisie)?.name ?? "?";
  const nomSuggeree = roster.find((r) => r.userId === suggeree)?.name ?? null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <h2 className="flex-1 text-base font-semibold text-ink">Assigner le devoir</h2>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="flex h-7 w-7 items-center justify-center rounded-full border border-edge text-ink-muted hover:bg-panel-raised">
          ×
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Séance réelle</span>
        <span className="text-sm text-ink">{libelleSeance ?? "Aucune séance jouée"}</span>
        <span className="text-xs text-ink-muted">d&apos;après le calendrier réel</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Date en jeu</span>
        <GameDateInput calendar={calendrier} value={dateEnJeu} onChange={onDateEnJeu} hidePeriod />
        <span className="text-xs text-ink-muted">date courante du calendrier</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Qui l&apos;écrit</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Qui l'écrit">
          {roster.map((r) => (
            <button
              key={r.userId}
              type="button"
              aria-pressed={r.userId === choisie}
              onClick={() => onChoisir(r.userId)}
              className={
                r.userId === choisie
                  ? "rounded-full border border-accent bg-accent/10 px-3 py-1 text-xs text-accent"
                  : "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
              }
            >
              {r.name ?? "?"}
            </button>
          ))}
        </div>
        {nomSuggeree && <span className="text-xs text-ink-muted">Suggéré : {nomSuggeree}, qui n&apos;a pas écrit depuis le plus longtemps.</span>}
      </div>
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
      <button
        type="button"
        onClick={onEnvoyer}
        disabled={envoi || !choisie}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        Assigner à {nomChoisie}
      </button>
    </div>
  );
}

export type PropsFeuilleAssigner = Parameters<typeof Contenu>[0] & {
  /** Étroit : feuille du bas ; sinon fenêtre centrée en verre. */
  etroit: boolean;
};

export default function FeuilleAssigner({ etroit, ...contenu }: PropsFeuilleAssigner) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalKeyboard({ open: !etroit, onClose: contenu.onFermer, panelRef });
  if (etroit) {
    return (
      <FeuilleDuBas titre="Assigner le devoir" onFermer={contenu.onFermer}>
        <div className="p-4">
          <Contenu {...contenu} />
        </div>
      </FeuilleDuBas>
    );
  }
  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim" onClick={contenu.onFermer} role="dialog" aria-modal="true" aria-label="Assigner le devoir">
      <div ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} className={`${VERRE} w-full max-w-md border-edge-strong p-5 shadow-2xl outline-none`}>
        <Contenu {...contenu} />
      </div>
    </div>,
    document.body
  );
}
