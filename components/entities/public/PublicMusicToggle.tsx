"use client";

import { useEffect, useRef } from "react";
import type { MusicTrack } from "@/src/core/schemas/blocks/music";
import { useMusicPlayback } from "@/components/shell/MusicPlaybackContext";

/**
 * Bloc `music` sur les pages de lecture (V2.1-6) — le bloc lui-meme n'affiche
 * plus rien (`PublicBlockView` renvoie `null` pour ce type) : tout ce qui en
 * reste a l'ecran est ce bouton, pose par `PublicEntityBody` a cote du nom de
 * la fiche.
 *
 * Meme lecteur partage que la radio d'arriere-plan et que l'editeur
 * (`MusicPlaybackContext`, une seule source active a la fois) : lancer une
 * piste d'ici met donc necessairement la radio en pause, et inversement —
 * jamais un second mecanisme de lecture.
 */
export default function PublicMusicToggle({
  blockId,
  tracks,
  label,
  autoplay,
  fadeInMs,
  fadeOutMs,
  loop,
}: {
  blockId: string;
  /** Toutes les pistes du bloc, dans l'ordre — le lecteur piloté les enchaîne (lot 2). */
  tracks: MusicTrack[];
  /** Nom de la station, c'est-a-dire le `display.label` du bloc — sert au nom accessible du bouton, qui n'a qu'un glyphe pour libelle. */
  label: string;
  autoplay: boolean;
  fadeInMs: number;
  fadeOutMs: number;
  loop: boolean;
}) {
  const { currentKey, play, stop } = useMusicPlayback();
  const bouton = useRef<HTMLButtonElement | null>(null);
  const key = `block:${blockId}`;
  const playing = currentKey === key;

  useEffect(() => {
    if (!autoplay) return;
    const lancer = () => play({ key, tracks, fadeInMs, fadeOutMs, loop });

    // Le navigateur refuse le son tant que la page n'a pas ete touchee, et il
    // le refuse SANS RIEN DIRE — l'iframe se monte, aucun son n'en sort.
    // Demander la lecture sans condition faisait donc mentir le bouton : il
    // passait en ⏸ alors que rien ne jouait, et il fallait deux clics (un pour
    // defaire cet etat, un pour lancer vraiment). `hasBeenActive` est la seule
    // facon de savoir a l'avance si la demande aboutira.
    if (!navigator.userActivation || navigator.userActivation.hasBeenActive) {
      lancer();
      return;
    }

    // Page pas encore touchee (lien de partage ouvert a froid, le cas
    // principal de `/partage`) : on arme la lecture sur le tout premier geste
    // du visiteur, quel qu'il soit — c'est ce geste qui lui donne le droit au
    // son. `capture` pour passer avant les gestionnaires de la page.
    //
    // MAIS jamais quand ce geste est un clic sur CE bouton : `pointerdown` et
    // `click` sont deux evenements distincts, et React a le temps de
    // rafraichir entre les deux. Lancer ici ferait donc voir au `onClick` une
    // lecture deja en cours, et il appellerait `stop()` — le premier clic
    // armait et mettait en pause dans la foulee, si bien que rien ne jouait
    // (constate en production). Dans ce cas on se contente de desarmer : le
    // bouton fait son travail tout seul, avec le bon etat.
    const start = (event: Event) => {
      document.removeEventListener("pointerdown", start, true);
      document.removeEventListener("keydown", start, true);
      const cible = event.target;
      if (bouton.current && cible instanceof Node && bouton.current.contains(cible)) return;
      lancer();
    };
    document.addEventListener("pointerdown", start, true);
    document.addEventListener("keydown", start, true);
    return () => {
      document.removeEventListener("pointerdown", start, true);
      document.removeEventListener("keydown", start, true);
    };
    // Une seule fois par bloc visite : ne pas reagir a `playing`, sinon une
    // mise en pause manuelle relancerait aussitot la piste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, key]);

  return (
    <button
      ref={bouton}
      type="button"
      onClick={() => (playing ? stop() : play({ key, tracks, fadeInMs, fadeOutMs, loop }))}
      aria-label={playing ? `Mettre en pause « ${label} »` : `Lancer « ${label} »`}
      className="shrink-0 rounded-full border border-accent px-2.5 py-1 text-xs leading-none text-accent transition-colors hover:bg-accent/10"
    >
      {playing ? "⏸" : "▶"}
    </button>
  );
}
