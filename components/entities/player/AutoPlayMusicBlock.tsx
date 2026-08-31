"use client";

import { useEffect } from "react";
import { useMusicPlayback } from "@/components/shell/MusicPlaybackContext";

/**
 * Bloc `music` en lecture seule joueur (retour utilisateur : "si une fiche
 * a une musique associée, lors de la visite de cette fiche le son
 * s'active et prend le dessus sur la radio mise") — la premiere piste
 * demarre des le montage, via le meme lecteur cache partage que la radio
 * (`MusicPlaybackContext`, un seul `nowPlaying` a la fois) : demarrer ici
 * remplace donc necessairement la radio en cours, jamais un second
 * mecanisme. Rien d'autre a construire cote lecture — l'edition
 * (`MusicBlockEditor.tsx`, MJ/proprietaire de la fiche) garde son
 * declenchement manuel, une fiche qu'on modifie n'est pas une fiche qu'on
 * visite pour son ambiance.
 */
export default function AutoPlayMusicBlock({ blockId, trackId, trackUrl }: { blockId: string; trackId: string; trackUrl: string }) {
  const { play } = useMusicPlayback();

  useEffect(() => {
    play(`block:${blockId}:${trackId}`, trackUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- demarre une fois par bloc visite (cle/URL), jamais a chaque rendu de `play` (identite stable de toute facon, useCallback dans le provider)
  }, [blockId, trackId, trackUrl]);

  return null;
}
