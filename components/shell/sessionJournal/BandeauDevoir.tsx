"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { JournalStatus } from "@/src/core/sessionJournal/devoir";

function jourIrl(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/**
 * Bandeau d'une page de devoir de journal, pour son autrice (V3.1-150,
 * piste A). En cours : la date en jeu et « Devoir fait ». Rendu : un rappel
 * vert, jusqu'à ce que le MJ valide (le layout ne le transmet plus ensuite).
 * Le rendu est définitif : une confirmation le dit avant.
 */
export default function BandeauDevoir({
  worldSlug,
  devoir,
}: {
  worldSlug: string;
  devoir: { id: string; status: Exclude<JournalStatus, "validated">; dateEnJeu: string; writtenAt: string | null };
}) {
  const router = useRouter();
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function rendre() {
    setConfirmer(false);
    setEnvoi(true);
    setErreur(null);
    fetch(`/api/worlds/${worldSlug}/session-journal/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: devoir.id }),
    })
      .then(async (res) => {
        if (res.ok) {
          // C5 : le rail (layout) et la page changent tous deux d'état.
          router.refresh();
          return;
        }
        const corps: unknown = await res.json().catch(() => null);
        throw new Error(corps && typeof corps === "object" && "error" in corps && typeof corps.error === "string" ? corps.error : "Impossible de rendre le devoir.");
      })
      .catch((err: Error) => setErreur(err.message))
      .finally(() => setEnvoi(false));
  }

  if (devoir.status === "written") {
    return (
      <section aria-label="Devoir rendu" className="mb-4 flex items-start gap-3 rounded-[14px] border border-success/60 bg-success/10 px-4 py-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-success" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        </svg>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink">
            Devoir rendu{devoir.writtenAt ? ` le ${jourIrl(devoir.writtenAt)}` : ""} : ta page est dans le Livre de sessions
          </span>
          <span className="text-xs text-ink-soft">Toute la table peut la lire. Ce rappel disparaît quand le MJ valide le devoir.</span>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Devoir de journal" className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-accent/60 bg-accent/10 px-4 py-3">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-accent" aria-hidden="true">
        <path d="M4 20h4L19 9l-4-4L4 16z" />
        <path d="M13 7l4 4" />
      </svg>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-ink">Devoir de journal : le récit de la séance du {devoir.dateEnJeu}</span>
        <span className="text-xs text-ink-soft">Seuls le MJ et toi voyez cette page tant que le devoir n&apos;est pas rendu.</span>
        {erreur && <span className="text-xs text-danger">{erreur}</span>}
      </div>
      <button
        type="button"
        onClick={() => setConfirmer(true)}
        disabled={envoi}
        className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        Devoir fait
      </button>
      <ConfirmDialog
        open={confirmer}
        title="Rendre le devoir"
        message="Ta page sera publiée dans le Livre de sessions, pour toute la table. Ce geste est définitif."
        confirmLabel="Devoir fait"
        cancelLabel="Pas encore"
        onConfirm={rendre}
        onCancel={() => setConfirmer(false)}
      />
    </section>
  );
}
