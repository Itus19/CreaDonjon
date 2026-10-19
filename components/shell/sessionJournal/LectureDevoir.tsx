"use client";

import Link from "next/link";
import type { EtatLigne } from "@/lib/ui/livreDeSessions";

export const LIBELLE_ETAT: Record<EtatLigne, string> = {
  redigee: "Rédigée",
  attente: "En attente",
  sans_devoir: "Pas de devoir",
};

const CLASSE_ETAT: Record<EtatLigne, string> = {
  redigee: "border-success text-success",
  attente: "border-accent text-accent",
  sans_devoir: "border-edge text-ink-muted",
};

/** Pastille d'état du registre. */
export function PastilleEtat({ etat }: { etat: EtatLigne }) {
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${CLASSE_ETAT[etat]}`}>{LIBELLE_ETAT[etat]}</span>;
}

export interface DonneesLecture {
  titre: string;
  dateEnJeu: string;
  autrice: string;
  seance: string;
  etat: EtatLigne;
  /** Page wiki de l'entrée rédigée, sinon `null`. */
  lien: string | null;
  /** Le MJ est l'autrice d'un devoir en attente : il peut commencer à écrire. */
  peutEcrire: boolean;
}

/** Une ligne du registre ouverte en lecture : métadonnées seulement, le texte vit sur la fiche. */
export default function LectureDevoir({
  donnees,
  onFermer,
  onEcrire,
  onAnnuler,
}: {
  donnees: DonneesLecture;
  onFermer?: () => void;
  onEcrire: () => void;
  onAnnuler: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {onFermer && (
        <div className="flex justify-end">
          <button type="button" onClick={onFermer} aria-label="Fermer la lecture" className="flex h-7 w-7 items-center justify-center rounded-full border border-edge text-ink-muted hover:bg-panel-raised">
            ×
          </button>
        </div>
      )}
      <span className="text-xs text-ink-muted">Livre de sessions ›</span>
      <h2 className="text-lg font-semibold text-ink">{donnees.titre}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-muted">Date en jeu</dt>
        <dd className="text-ink">{donnees.dateEnJeu}</dd>
        <dt className="text-ink-muted">Autrice</dt>
        <dd className="text-ink">{donnees.autrice}</dd>
        <dt className="text-ink-muted">Séance réelle</dt>
        <dd className="text-ink">{donnees.seance}</dd>
        <dt className="text-ink-muted">État</dt>
        <dd>
          <PastilleEtat etat={donnees.etat} />
        </dd>
      </dl>
      {donnees.lien && (
        <Link href={donnees.lien} className="self-start rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10">
          Ouvrir la fiche
        </Link>
      )}
      {donnees.etat === "attente" && (
        <>
          <p className="text-sm text-ink-muted">Pas encore écrite.</p>
          <div className="flex flex-wrap items-center gap-3">
            {donnees.peutEcrire && (
              <button type="button" onClick={onEcrire} className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover">
                Commencer à écrire
              </button>
            )}
            <button type="button" onClick={onAnnuler} className="rounded-full border border-danger px-3 py-1 text-xs text-danger transition-colors hover:bg-danger/10">
              Annuler le devoir
            </button>
          </div>
        </>
      )}
    </div>
  );
}
