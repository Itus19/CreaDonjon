"use client";

import { useEffect, useState } from "react";

/**
 * Horloge temps reel en haut a droite (V1-C4, specs/arbitrage-modifications.md
 * §3.1) : temps reel local au navigateur, pas un chrono de partie partage —
 * celui-ci attend le module joueur (V3, specs/module-joueur-et-solo.md).
 */
export default function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Premier affichage au prochain tick (pas d'appel synchrone ici) :
    // meme regle que le reste de la coquille, jamais de setState synchrone
    // dans le corps d'un effet.
    const id = setInterval(() => setNow(new Date()), 1000);
    const timeout = setTimeout(() => setNow(new Date()), 0);
    return () => {
      clearInterval(id);
      clearTimeout(timeout);
    };
  }, []);

  // Rien cote serveur (pas d'horloge fixe qui figerait un instant du build) —
  // seulement une fois montee cote client, pour eviter tout ecart d'hydratation.
  if (!now) return null;

  return (
    <span className="font-mech text-xs tabular-nums text-ink-muted" suppressHydrationWarning>
      {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}
