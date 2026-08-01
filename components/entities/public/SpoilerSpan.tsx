"use client";

import { useState } from "react";

/**
 * Meme convention que l'editeur (components/entities/richtext, [data-
 * spoiler]/[data-revealed] dans globals.css) : caviarde par defaut, un
 * clic revele, un second reclique cache. Etat local au composant, jamais
 * persiste — chaque chargement de page repart caviarde.
 */
export default function SpoilerSpan({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      data-spoiler=""
      data-revealed={revealed}
      onClick={() => setRevealed((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setRevealed((v) => !v);
        }
      }}
    >
      {children}
    </span>
  );
}
