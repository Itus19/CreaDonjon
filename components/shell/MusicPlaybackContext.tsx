"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { toEmbedUrl } from "@/src/core/music/embedUrl";

interface MusicPlaybackContextValue {
  /** Cle de la source en cours (`radio:<id>` ou `block:<blockId>:<trackId>`), ou `null` si rien ne joue. */
  currentKey: string | null;
  play: (key: string, url: string) => void;
  stop: () => void;
}

const MusicPlaybackContext = createContext<MusicPlaybackContextValue | null>(null);

/**
 * Un seul lecteur cache pour toute l'application (radio d'arriere-plan en
 * haut a droite, blocs `music` d'une fiche) : une iframe a la fois,
 * demontee/remontee au changement de `nowPlaying` plutot que pilotee par
 * l'API JS propre a chaque fournisseur — le moyen le plus simple d'obtenir
 * "une seule chose joue a la fois" (demarrer une source arrete
 * necessairement l'autre) sans dependre d'un SDK par plateforme.
 *
 * Monte une fois dans `app/layout.tsx`, donc jamais demonte par la
 * navigation entre pages — c'est ce qui permet a la musique de continuer
 * en arriere-plan en changeant de fiche ou de monde.
 */
export function MusicPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [nowPlaying, setNowPlaying] = useState<{ key: string; url: string } | null>(null);

  const play = useCallback((key: string, url: string) => setNowPlaying({ key, url }), []);
  const stop = useCallback(() => setNowPlaying(null), []);

  const embedUrl = nowPlaying ? toEmbedUrl(nowPlaying.url, { autoplay: true }) : null;

  return (
    <MusicPlaybackContext.Provider value={{ currentKey: nowPlaying?.key ?? null, play, stop }}>
      {children}
      {embedUrl && (
        <iframe
          key={nowPlaying!.key}
          src={embedUrl}
          allow="autoplay; encrypted-media"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed left-0 top-0 h-px w-px overflow-hidden opacity-0"
          style={{ pointerEvents: "none" }}
        />
      )}
    </MusicPlaybackContext.Provider>
  );
}

export function useMusicPlayback(): MusicPlaybackContextValue {
  const ctx = useContext(MusicPlaybackContext);
  if (!ctx) throw new Error("useMusicPlayback doit être utilisé sous MusicPlaybackProvider");
  return ctx;
}
