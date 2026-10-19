"use client";

/** Le ↻ de tout l'ecran : relance un emplacement, une section ou toute la fiche. `…` pendant la requete. */
export default function BoutonRelance({
  onClick,
  desactive,
  enCours,
  titre,
}: {
  onClick: () => void;
  desactive?: boolean;
  enCours?: boolean;
  /** Dit ce qui sera relance — aussi le nom accessible. */
  titre: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive || enCours}
      title={titre}
      aria-label={titre}
      className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
    >
      {enCours ? "…" : "↻"}
    </button>
  );
}
