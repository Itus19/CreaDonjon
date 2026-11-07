"use client";

import type { ReactNode } from "react";

/**
 * Une tuile de caractéristique à deux boutons : en haut le test (modificateur
 * en grand), en bas la sauvegarde (point plein = jet maîtrisé). Extraite de
 * `PlayableCharacterSheet` par V3.1-79 pour que la fiche de créature montre la
 * même tuile. `milieu` est ce qui s'intercale entre les deux : le champ de
 * valeur du personnage, la valeur plate de la créature. Les gestes (le jet
 * lui-même) restent ceux de la fiche qui l'emploie.
 */
export default function TuileCaracteristique({
  abreviation,
  modificateur,
  titreTest,
  libelleTest,
  onTest,
  milieu,
  sauvegarde,
  titreSauvegarde,
  libelleSauvegarde,
  maitrise,
  onSauvegarde,
  desTest,
  sauvegardeEtroite,
}: {
  abreviation: string;
  /** « +4 », déjà formaté. */
  modificateur: string;
  titreTest: string;
  libelleTest: string;
  onTest: () => void;
  milieu?: ReactNode;
  /** « Sauv. +4 », « JS +6 » : le texte du bouton du bas. */
  sauvegarde: string;
  titreSauvegarde: string;
  libelleSauvegarde: string;
  maitrise: boolean;
  onSauvegarde: () => void;
  /** V3.1-157 : les dés de bonus du test (« +1d4 »), sous le modificateur. Absent sans dé. */
  desTest?: string;
  /**
   * V3.1-157 : le texte du bouton du bas SOUS 40rem de fiche, quand des dés s'y ajoutent (« +3 + 1d4 ») : sans le mot « Sauv. », pour tenir
   * dans une tuile de téléphone (trois par ligne). Au-delà, `sauvegarde` complet.
   */
  sauvegardeEtroite?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-edge/60 bg-panel-raised px-2 py-2.5 text-center">
      <span className="text-xs font-bold uppercase tracking-widest text-accent">{abreviation}</span>
      <button
        type="button"
        title={titreTest}
        aria-label={libelleTest}
        onClick={onTest}
        className="min-h-9 min-w-12 text-xl font-bold text-ink hover:text-accent @min-[40rem]:min-h-0 @min-[40rem]:min-w-0"
      >
        {modificateur}
        {desTest && <span className="block text-xs font-semibold leading-tight text-accent">{desTest}</span>}
      </button>
      {milieu}
      <button
        type="button"
        title={titreSauvegarde}
        aria-label={libelleSauvegarde}
        onClick={onSauvegarde}
        className={`flex min-h-9 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs @min-[40rem]:min-h-0 font-semibold hover:border-accent ${
          maitrise ? "border-accent bg-accent/20 text-accent" : "border-edge text-ink-muted"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${maitrise ? "bg-accent" : "bg-edge"}`} aria-hidden="true" />
        {sauvegardeEtroite ? (
          <>
            <span className="@min-[40rem]:hidden">{sauvegardeEtroite}</span>
            <span className="hidden @min-[40rem]:inline">{sauvegarde}</span>
          </>
        ) : (
          sauvegarde
        )}
      </button>
    </div>
  );
}
