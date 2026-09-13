"use client";

import { useEffect } from "react";

const CHUNK_ERROR_RELOAD_KEY = "creadonjon:chunk-error-reloaded";

function isChunkLoadError(error: Error): boolean {
  return error.name === "ChunkLoadError" || /Loading (chunk|CSS chunk) [\w-]+ failed/.test(error.message);
}

/**
 * Aucune page d'erreur n'existait dans le projet — toute exception non
 * rattrapee (rendu d'un composant serveur, erreur cote client) retombait
 * sur l'ecran generique de Next.js ("This page couldn't load"), qui ne
 * montre qu'un identifiant opaque (`digest`), jamais le message reel.
 * Retour utilisateur : une erreur revenue identique a plusieurs reprises,
 * impossible a diagnostiquer sans voir ce qu'elle dit vraiment — outil
 * personnel, pas un service public a des inconnus : montrer le message et
 * la pile complets ici est un choix delibere, pas un defaut par megarde.
 *
 * `global-error.tsx` (et non `error.tsx`) : remplace le layout RACINE, la
 * seule frontiere qui rattrape une erreur survenue dans `app/layout.tsx`
 * lui-meme (ex. la resolution de session/locale) — porte donc son propre
 * `<html>/<body>`.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!isChunkLoadError(error)) return;
    if (sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY)) return;
    sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, "1");
    window.location.reload();
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#14181B", color: "#EFEAE0", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <div style={{ maxWidth: 720 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Une erreur est survenue</h1>
          <p style={{ fontSize: 14, color: "#A9A290", marginBottom: 16 }}>
            {error.digest && <>Identifiant : {error.digest}<br /></>}
            Message : {error.message || "(aucun message)"}
          </p>
          {error.stack && (
            <pre style={{ fontSize: 11, color: "#8B8677", whiteSpace: "pre-wrap", overflowX: "auto", background: "#211D16", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              {error.stack}
            </pre>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{ borderRadius: 999, padding: "8px 16px", background: "#D6A857", color: "#3A2E17", border: "none", fontWeight: 500, cursor: "pointer" }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
