/**
 * Chargement de l'IFrame Player API de YouTube (V2.1-6 lot 2,
 * docs/adr/0022-lecteur-youtube-pilote.md).
 *
 * **A la demande, jamais au chargement de la page** : le script n'est
 * telecharge qu'a la premiere piste YouTube reellement jouee. Une fiche sans
 * bloc musique YouTube ne le voit jamais passer — c'est ce qui rend
 * acceptable qu'un script tiers entre sur le wiki public, y compris pour un
 * visiteur anonyme de `/partage` (consequence assumee dans l'ADR).
 *
 * Une seule promesse pour toute l'application : deux voix qui demarrent en
 * meme temps (un fondu croise en cours) partagent le meme chargement au lieu
 * d'injecter deux fois le script.
 *
 * Types ecrits a la main plutot qu'une dependance `@types/youtube` : on
 * n'utilise que cinq methodes, et `any` est interdit (CLAUDE.md, regle 23).
 */

export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  setVolume(volume: number): void;
  loadVideoById(options: { videoId: string; startSeconds?: number; endSeconds?: number }): void;
  destroy(): void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data: number;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: YouTubePlayerEvent) => void;
        onStateChange?: (event: YouTubePlayerEvent) => void;
      };
    }
  ) => YouTubePlayer;
  PlayerState: { ENDED: number };
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SCRIPT_SRC = "https://www.youtube.com/iframe_api";

let chargement: Promise<YouTubeNamespace> | null = null;

export function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (chargement) return chargement;
  chargement = new Promise<YouTubeNamespace>((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    // `onYouTubeIframeAPIReady` est un rendez-vous global impose par YouTube :
    // on chaine l'eventuel gestionnaire deja pose plutot que de l'ecraser.
    const precedent = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      precedent?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    document.head.appendChild(script);
  });
  return chargement;
}

/** Etat « la piste est finie » — l'evenement qui declenche l'enchainement. */
export const YT_ENDED = 0;
