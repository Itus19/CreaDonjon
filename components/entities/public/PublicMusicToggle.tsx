"use client";

import { useEffect } from "react";
import { useMusicPlayback } from "@/components/shell/MusicPlaybackContext";

/**
 * Bloc `music` sur les pages de lecture (V2.1-6) — le bloc lui-meme n'affiche
 * plus rien (`PublicBlockView` renvoie `null` pour ce type) : tout ce qui en
 * reste a l'ecran est ce bouton, pose par `PublicEntityBody` a cote du titre
 * du bloc qui precede, ou a cote du nom de la fiche s'il n'y en a pas.
 *
 * Meme lecteur cache partage que la radio d'arriere-plan et que l'editeur
 * (`MusicPlaybackContext`, une seule source a la fois) : lancer une piste
 * d'ici met donc necessairement la radio en pause, et inversement — jamais un
 * second mecanisme de lecture.
 *
 * `autoplay` porte le choix de l'autrice (`autoplayOnVisit` du bloc), pas une
 * decision du composant. Le navigateur, lui, garde le dernier mot : Chrome
 * refuse la lecture automatique avec son tant qu'aucun clic n'a eu lieu dans
 * le document, donc l'arrivee sur la fiche par un lien interne du wiki
 * demarre bien la musique, alors qu'une URL ouverte dans un onglet neuf sera
 * vraisemblablement refusee. C'est aussi ce qui fait de ce bouton le filet de
 * securite de l'option, et pas un simple confort.
 */
export default function PublicMusicToggle({
  blockId,
  trackId,
  trackUrl,
  label,
  autoplay,
}: {
  blockId: string;
  trackId: string;
  trackUrl: string;
  /** Nom de la station, c'est-a-dire le `display.label` du bloc — sert au nom accessible du bouton, qui n'a qu'un glyphe pour libelle. */
  label: string;
  autoplay: boolean;
}) {
  const { currentKey, play, stop } = useMusicPlayback();
  const key = `block:${blockId}:${trackId}`;
  const playing = currentKey === key;

  useEffect(() => {
    if (autoplay) play(key, trackUrl);
    // Une seule fois par bloc visite : ne pas reagir a `playing`, sinon une
    // mise en pause manuelle relancerait aussitot la piste.
  }, [autoplay, key, trackUrl, play]);

  return (
    <button
      type="button"
      onClick={() => (playing ? stop() : play(key, trackUrl))}
      aria-label={playing ? `Mettre en pause « ${label} »` : `Lancer « ${label} »`}
      className="shrink-0 rounded-full border border-accent px-2.5 py-1 text-xs leading-none text-accent transition-colors hover:bg-accent/10"
    >
      {playing ? "⏸" : "▶"}
    </button>
  );
}
