"use client";

import Link from "next/link";
import type { EtatLigne } from "@/lib/ui/livreDeSessions";

export const LIBELLE_ETAT: Record<EtatLigne, string> = {
  en_cours: "En cours d'écriture",
  rendue: "Rendue · à valider",
  validee: "Validée",
  sans_devoir: "Pas de devoir",
};

const CLASSE_ETAT: Record<EtatLigne, string> = {
  en_cours: "border-accent text-accent",
  rendue: "border-success text-success",
  validee: "border-edge-strong text-ink-soft",
  sans_devoir: "border-edge text-ink-muted",
};

/** Pastille d'état du registre (V3.1-150 : trois états d'un devoir, plus la séance sans devoir). */
export function PastilleEtat({ etat }: { etat: EtatLigne }) {
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${CLASSE_ETAT[etat]}`}>{LIBELLE_ETAT[etat]}</span>;
}

export interface DonneesLecture {
  titre: string;
  dateEnJeu: string;
  autrice: string;
  seance: string;
  etat: EtatLigne;
  /** Page de l'entrée (elle existe dès l'assignation), sinon `null`. */
  lien: string | null;
  /** Le MJ est l'autrice d'un devoir en cours : il le rend d'ici. */
  peutRendre: boolean;
}

/**
 * Une ligne du registre ouverte en lecture : métadonnées seulement, le texte
 * vit sur la fiche. V3.1-150 : la page existe dès l'assignation ; un devoir
 * en cours s'annule, un devoir rendu se valide.
 */
export default function LectureDevoir({
  donnees,
  occupe,
  onFermer,
  onRendre,
  onValider,
  onAnnuler,
}: {
  donnees: DonneesLecture;
  /** Un geste est en cours : les boutons attendent. */
  occupe: boolean;
  onFermer?: () => void;
  onRendre: () => void;
  onValider: () => void;
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
      {donnees.etat === "en_cours" && (
        <>
          <p className="text-sm text-ink-muted">Pas encore rendue : seuls l&apos;autrice et le MJ voient la page.</p>
          <div className="flex flex-wrap items-center gap-3">
            {donnees.peutRendre && (
              <button
                type="button"
                onClick={onRendre}
                disabled={occupe}
                className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                Devoir fait
              </button>
            )}
            <button
              type="button"
              onClick={onAnnuler}
              disabled={occupe}
              className="rounded-full border border-danger px-3 py-1 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
            >
              Annuler le devoir
            </button>
          </div>
        </>
      )}
      {donnees.etat === "rendue" && (
        <>
          <p className="text-sm text-ink-muted">Rendue : la page est dans le Livre, publique. Valider retire le rappel de la barre de l&apos;autrice.</p>
          <button
            type="button"
            onClick={onValider}
            disabled={occupe}
            className="self-start rounded-full bg-success px-3 py-1 text-xs font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-50"
          >
            Valider le devoir
          </button>
        </>
      )}
    </div>
  );
}
