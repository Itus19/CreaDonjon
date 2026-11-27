"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { NotebookWorkspaceData } from "@/src/server/services/sharedNotes";

// L'éditeur du cahier est lourd : il ne se charge qu'à l'ouverture de l'entrée Notes.
const NotebookWorkspace = dynamic(() => import("@/components/shell/notebook/NotebookWorkspace"), {
  ssr: false,
  loading: () => <p className="text-sm text-ink-muted">Chargement…</p>,
});

/**
 * ADR 0120 (V3.2-58) — Le cahier de notes dans le volet de consultation : le
 * même cahier que la page Notes, sans quitter la partie (retour de l'auteur,
 * 27 novembre : l'entrée Notes du rail menait à la page Notes, qui reprend
 * l'ancien rail de l'app). Chargé à l'ouverture, une fois.
 */
export default function VoletNotes({ worldSlug }: { worldSlug: string }) {
  const [etat, setEtat] = useState<{ statut: "pret"; donnees: NotebookWorkspaceData } | { statut: "erreur" } | null>(null);

  useEffect(() => {
    let annule = false;
    fetch(`/api/worlds/${encodeURIComponent(worldSlug)}/joueur/notes`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Réponse ${res.status}`);
        const donnees = (await res.json()) as NotebookWorkspaceData;
        if (!annule) setEtat({ statut: "pret", donnees });
      })
      .catch((erreur: unknown) => {
        console.error("Cahier de notes non chargé dans le volet", erreur);
        if (!annule) setEtat({ statut: "erreur" });
      });
    return () => {
      annule = true;
    };
  }, [worldSlug]);

  if (!etat) return <p className="text-sm text-ink-muted">Chargement…</p>;
  if (etat.statut === "erreur") return <p className="text-sm text-ink-muted">Le cahier ne peut pas s&apos;afficher.</p>;
  return <NotebookWorkspace worldSlug={worldSlug} initial={etat.donnees} />;
}
