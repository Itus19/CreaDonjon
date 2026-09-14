"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { MusicTrack } from "@/src/core/schemas/blocks/music";
import { nextTrackIndex } from "@/src/core/music/nextTrack";
import MusicVoice from "./MusicVoice";

/** Ce qu'on demande a jouer : une liste ordonnee de pistes, et les fondus qui l'encadrent. */
export interface MusicSource {
  /** `radio:<id>` ou `block:<blockId>` — identifie la source pour l'affichage des boutons. */
  key: string;
  tracks: MusicTrack[];
  /** Absents pour la radio : elle garde le comportement sans fondu qu'elle a toujours eu. */
  fadeInMs?: number;
  fadeOutMs?: number;
  /** Arrive au bout de la liste, repartir de la premiere piste. Absent = s'arreter. */
  loop?: boolean;
}

interface MusicPlaybackContextValue {
  /** Cle de la source en cours, ou `null` si rien ne joue. */
  currentKey: string | null;
  play: (source: MusicSource) => void;
  stop: () => void;
}

const MusicPlaybackContext = createContext<MusicPlaybackContextValue | null>(null);

/** Une voix montee : la source, la piste qu'elle joue, et si elle est en train de s'eteindre. */
interface Voix {
  /** Distingue deux voix de la MEME source (on relance la meme station) — une cle React stable pendant toute la vie de la voix. */
  instanceId: number;
  source: MusicSource;
  trackIndex: number;
  /**
   * Numero de passage, incremente a chaque changement de piste. Il entre dans
   * la cle React de la voix : sans lui, un bloc d'UNE seule piste en boucle
   * reviendrait au meme index, la cle ne changerait pas, React ne remonterait
   * rien — et la piste ne repartirait jamais.
   */
  lap: number;
  fadingOut: boolean;
}

/**
 * Lecteur unique de toute l'application : radio d'arriere-plan (en haut a
 * droite) et blocs `music` d'une fiche.
 *
 * V2-G3 tenait la regle « une seule chose joue a la fois » par un moyen
 * detourne mais efficace : une seule iframe, demontee/remontee au changement
 * de source. Le fondu croise du lot 2 (docs/adr/0022-lecteur-youtube-pilote.md)
 * l'interdit — l'ancienne source doit vivre pendant que la nouvelle monte.
 * La regle devient donc « une seule source ACTIVE », tenue explicitement ici :
 * `active` est la seule voix qui compte pour `currentKey` et pour les boutons,
 * les autres sont des voix en extinction qui se demontent d'elles-memes.
 *
 * Monte une fois dans `app/layout.tsx`, donc jamais demonte par la navigation
 * entre pages — c'est ce qui permet a la musique de continuer en arriere-plan
 * en changeant de fiche ou de monde.
 */
export function MusicPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [voices, setVoices] = useState<Voix[]>([]);
  const prochainId = useRef(0);

  /**
   * Fait sortir la voix active : elle passe en extinction et se demontera
   * elle-meme (`onFadedOut`). Sans fondu sortant, on la retire tout de suite —
   * inutile de garder une voix muette montee.
   */
  const eteindreActive = useCallback((liste: Voix[]): Voix[] => {
    return liste.flatMap((v) => {
      if (v.fadingOut) return [v];
      const fadeOut = v.source.fadeOutMs ?? 0;
      return fadeOut > 0 ? [{ ...v, fadingOut: true }] : [];
    });
  }, []);

  const play = useCallback(
    (source: MusicSource) => {
      if (source.tracks.length === 0) return;
      const instanceId = prochainId.current++;
      setVoices((prev) => {
        // Demander ce qui joue deja ne relance rien. Sans ce garde, deux
        // appels rapproches sur la MEME source (le bouton public arme la
        // lecture sur le premier geste, et ce geste peut etre un clic sur ce
        // bouton, qui appelle `play` a son tour) creaient deux voix : la
        // premiere passait en extinction alors que son lecteur n'existait pas
        // encore, restait montee en fantome, et la lecture partait de travers.
        const active = prev.find((v) => !v.fadingOut);
        if (active && active.source.key === source.key) return prev;
        return [...eteindreActive(prev), { instanceId, source, trackIndex: 0, lap: 0, fadingOut: false }];
      });
    },
    [eteindreActive]
  );

  const stop = useCallback(() => setVoices((prev) => eteindreActive(prev)), [eteindreActive]);

  const retirer = useCallback((instanceId: number) => {
    setVoices((prev) => prev.filter((v) => v.instanceId !== instanceId));
  }, []);

  /**
   * Fin naturelle d'une piste : `nextTrackIndex` (noyau pur, teste) decide de
   * la suivante — l'ordre de la liste, puis retour au debut si le bloc boucle,
   * sinon silence. Une voix deja en extinction n'enchaine jamais : elle est en
   * train de laisser la place.
   */
  const pisteTerminee = useCallback((instanceId: number) => {
    setVoices((prev) =>
      prev.flatMap((v) => {
        if (v.instanceId !== instanceId || v.fadingOut) return [v];
        const suivant = nextTrackIndex(v.trackIndex, v.source.tracks.length, v.source.loop === true);
        return suivant === null ? [] : [{ ...v, trackIndex: suivant, lap: v.lap + 1 }];
      })
    );
  }, []);

  const active = voices.find((v) => !v.fadingOut) ?? null;

  return (
    <MusicPlaybackContext.Provider value={{ currentKey: active?.source.key ?? null, play, stop }}>
      {children}
      {voices.map((voix) => {
        const track = voix.source.tracks[voix.trackIndex];
        if (!track) return null;
        return (
          <MusicVoice
            // Le numero de passage fait partie de la cle : changer de piste
            // reconstruit la voix, ce qui lui redonne son fondu entrant — et
            // une piste unique en boucle repart, alors que son index seul
            // n'aurait pas bouge.
            key={`${voix.instanceId}:${voix.lap}:${track.id}`}
            url={track.url}
            startSeconds={track.startSeconds}
            endSeconds={track.endSeconds}
            fadeInMs={voix.source.fadeInMs ?? 0}
            fadingOut={voix.fadingOut}
            fadeOutMs={voix.source.fadeOutMs ?? 0}
            onFadedOut={() => retirer(voix.instanceId)}
            onEnded={() => pisteTerminee(voix.instanceId)}
          />
        );
      })}
    </MusicPlaybackContext.Provider>
  );
}

export function useMusicPlayback(): MusicPlaybackContextValue {
  const ctx = useContext(MusicPlaybackContext);
  if (!ctx) throw new Error("useMusicPlayback doit être utilisé sous MusicPlaybackProvider");
  return ctx;
}
