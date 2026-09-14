"use client";

import { useEffect, useRef } from "react";
import { toEmbedUrl, youtubeVideoId } from "@/src/core/music/embedUrl";
import { FADE_STEP_MS, fadeVolumeAt } from "@/src/core/music/fade";
import { YT_ENDED, loadYouTubeApi, type YouTubePlayer } from "./youtubeApi";

/**
 * Une « voix » : UNE piste en train de sonner (V2.1-6 lot 2,
 * docs/adr/0022-lecteur-youtube-pilote.md).
 *
 * Le fondu croise choisi par l'auteur impose que l'ancienne source vive
 * pendant que la nouvelle monte : le fournisseur de contexte monte donc
 * jusqu'a deux voix, et la regle « une seule iframe » de V2-G3 devient « une
 * seule source ACTIVE ».
 *
 * Deux implementations derriere la meme interface, choisies par l'URL :
 * - `VoixYouTube` — pilotee par l'API : volume (donc fondu), fin de piste
 *   (donc enchainement), bornes debut/fin ;
 * - `VoixIframe` — l'iframe cachee d'origine, strictement inchangee, pour
 *   Spotify et SoundCloud. Aucun fondu, aucune fin detectable : elle ignore
 *   `fadeMs` et n'appelle jamais `onEnded`. C'est le prix, assume dans l'ADR,
 *   de n'avoir pris que l'API de YouTube.
 */

export interface MusicVoiceProps {
  url: string;
  startSeconds?: number;
  endSeconds?: number;
  /** Duree de la montee en volume au demarrage de cette piste. */
  fadeInMs: number;
  /**
   * Passe a `true` quand la voix doit s'eteindre : elle descend son volume sur
   * `fadeOutMs`, puis appelle `onFadedOut` pour que le contexte la demonte.
   * Jamais un demontage direct — ce serait une coupure nette.
   */
  fadingOut: boolean;
  fadeOutMs: number;
  onFadedOut: () => void;
  /** Fin naturelle de la piste : le contexte enchaine sur la suivante du bloc. */
  onEnded: () => void;
}

export default function MusicVoice(props: MusicVoiceProps) {
  return youtubeVideoId(props.url) ? <VoixYouTube {...props} /> : <VoixIframe {...props} />;
}

function VoixYouTube({ url, startSeconds, endSeconds, fadeInMs, fadingOut, fadeOutMs, onFadedOut, onEnded }: MusicVoiceProps) {
  const hote = useRef<HTMLDivElement | null>(null);
  const lecteur = useRef<YouTubePlayer | null>(null);
  const rampe = useRef<ReturnType<typeof setInterval> | null>(null);
  // Les rappels changent d'identite a chaque rendu du contexte ; les garder
  // dans une ref evite de reconstruire le lecteur (donc de couper le son) a
  // chaque fois qu'un parent se redessine.
  const rappels = useRef({ onFadedOut, onEnded });
  useEffect(() => {
    rappels.current = { onFadedOut, onEnded };
  });

  function arreterRampe() {
    if (rampe.current !== null) {
      clearInterval(rampe.current);
      rampe.current = null;
    }
  }

  /** Applique la rampe pure de `src/core/music/fade.ts` par paliers reguliers. */
  function fondre(de: number, vers: number, dureeMs: number, fini?: () => void) {
    arreterRampe();
    const lu = lecteur.current;
    if (!lu) return;
    lu.setVolume(fadeVolumeAt(0, dureeMs, de, vers));
    if (dureeMs <= 0) {
      fini?.();
      return;
    }
    const debut = Date.now();
    rampe.current = setInterval(() => {
      const ecoule = Date.now() - debut;
      lecteur.current?.setVolume(fadeVolumeAt(ecoule, dureeMs, de, vers));
      if (ecoule >= dureeMs) {
        arreterRampe();
        fini?.();
      }
    }, FADE_STEP_MS);
  }

  // Construction du lecteur : une fois par piste (cle/bornes), jamais a chaque
  // rendu. Un `destroy()` en nettoyage, sinon l'iframe survivrait au demontage
  // et continuerait de jouer.
  useEffect(() => {
    const videoId = youtubeVideoId(url);
    const conteneur = hote.current;
    if (!videoId || !conteneur) return;
    let annule = false;

    // `YT.Player` REMPLACE l'element qu'on lui donne par son iframe. Lui
    // confier un noeud rendu par React ferait planter le demontage
    // ("Failed to execute 'removeChild' on 'Node'") : React croit encore
    // gerer un noeud que YouTube a fait disparaitre — constate en direct, la
    // page entiere tombait a la fin du fondu sortant. On lui donne donc un
    // enfant cree a la main, que React ne suit pas : il ne connait que le
    // conteneur, et retirer un conteneur dont il ignore le contenu ne pose
    // aucun probleme.
    const cible = document.createElement("div");
    conteneur.appendChild(cible);

    loadYouTubeApi().then((YT) => {
      if (annule) return;
      lecteur.current = new YT.Player(cible, {
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          // `controls: 0` : le lecteur est hors champ, personne ne le voit ;
          // charger les commandes ne ferait que du poids inutile.
          controls: 0,
        },
        events: {
          onReady: (event) => {
            // Volume a zero AVANT de lancer : sinon la premiere fraction de
            // seconde sort a plein volume, et le fondu ne fonde plus rien.
            event.target.setVolume(0);
            event.target.loadVideoById({ videoId, startSeconds, endSeconds });
            event.target.playVideo();
            fondre(0, 100, fadeInMs);
          },
          onStateChange: (event) => {
            if (event.data === YT_ENDED) rappels.current.onEnded();
          },
        },
      });
    });

    return () => {
      annule = true;
      arreterRampe();
      lecteur.current?.destroy();
      lecteur.current = null;
      // `destroy()` retire deja l'iframe ; ce retrait ne couvre que le cas ou
      // le lecteur n'a jamais eu le temps d'etre construit (demontage pendant
      // le chargement du script).
      cible.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une voix = une piste : se reconstruire sur un changement de fondu couperait le son en plein morceau
  }, [url, startSeconds, endSeconds]);

  useEffect(() => {
    if (!fadingOut) return;
    fondre(100, 0, fadeOutMs, () => rappels.current.onFadedOut());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fondre` est recreee a chaque rendu mais lit toujours la meme ref de lecteur
  }, [fadingOut, fadeOutMs]);

  return <div ref={hote} className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0" aria-hidden="true" />;
}

/**
 * Repli pour Spotify et SoundCloud : exactement l'iframe cachee de V2-G3.
 * Rendue hors champ (1 px, opacite nulle) plutot qu'en `display:none`, pour ne
 * pas risquer que le moteur coupe l'audio d'un element qu'il considere non
 * affiche — meme raison qu'a l'origine.
 */
function VoixIframe({ url, startSeconds, endSeconds, fadingOut, onFadedOut }: MusicVoiceProps) {
  const embedUrl = toEmbedUrl(url, { autoplay: true, startSeconds, endSeconds });

  // Aucun volume accessible : l'extinction est immediate, jamais fondue. On
  // previent tout de suite le contexte plutot que de le laisser attendre un
  // fondu qui n'arrivera pas — sans quoi la voix resterait montee pour
  // toujours et continuerait de jouer.
  useEffect(() => {
    if (fadingOut) onFadedOut();
  }, [fadingOut, onFadedOut]);

  if (!embedUrl) return null;
  return (
    <iframe
      src={embedUrl}
      allow="autoplay; encrypted-media"
      aria-hidden="true"
      tabIndex={-1}
      className="fixed left-0 top-0 h-px w-px overflow-hidden opacity-0"
      style={{ pointerEvents: "none" }}
    />
  );
}
