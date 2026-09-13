"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useModalKeyboard } from "@/components/shared/useModalKeyboard";

interface MyAssignment {
  id: string;
  ingameDateLabel: string;
}

/**
 * Bannière du devoir en attente (V2.1-3, retour utilisateur : "pouvoir
 * donner le devoir à un joueur") — au-dessus du wiki joueur, jamais dans le
 * sommaire lui-même (pas demandé ce tour-ci, voir docs/BACKLOG_V2.1.md).
 * Ouvre un simple champ de titre : la rédaction du récit se fait ensuite
 * dans l'édition NORMALE de la fiche créée (mêmes blocs que partout).
 */
export default function SessionJournalBanner({ worldSlug }: { worldSlug: string }) {
  const router = useRouter();
  const [assignment, setAssignment] = useState<MyAssignment | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalKeyboard({ open, onClose: () => setOpen(false), panelRef });

  useEffect(() => {
    fetch(`/api/worlds/${worldSlug}/session-journal/my-assignment`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { assignment: MyAssignment | null }) => setAssignment(body.assignment))
      .catch(() => {});
  }, [worldSlug]);

  function submit() {
    if (!assignment) return;
    if (title.trim() === "") {
      setError("Un titre est requis.");
      return;
    }
    setSubmitting(true);
    fetch(`/api/worlds/${worldSlug}/session-journal/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: assignment.id, title }),
    })
      .then((res) => (res.ok ? res.json() : res.json().then((b) => Promise.reject(new Error(b.error)))))
      .then((body: { slug: string }) => {
        setOpen(false);
        setAssignment(null);
        router.push(`/m/${worldSlug}/joueur/wiki/${body.slug}`);
      })
      .catch((err: Error) => {
        setError(err.message || "Impossible de créer l'entrée.");
        setSubmitting(false);
      });
  }

  if (!assignment) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-accent/50 bg-accent/10 px-3 py-2 text-sm">
      <span className="text-ink">
        Devoir : rédiger le récit du <span className="font-medium">{assignment.ingameDateLabel}</span>
      </span>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink hover:bg-accent-hover">
        Commencer à écrire
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Rédiger l'entrée">
            <div ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border border-edge-strong bg-panel-raised p-4 shadow-2xl outline-none">
              <h2 className="mb-2 text-sm font-semibold text-ink">Titre de l&apos;entrée</h2>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
                placeholder="Ce que le Grelot Fêlé a vu passer"
                className="w-full rounded border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
                autoFocus
              />
              {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-edge px-3 py-1 text-xs text-ink-muted hover:bg-panel">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-50"
                >
                  Créer et rédiger
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
