"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Précédent/Suivant façon navigateur (V2.1-1, retour utilisateur : "à
 * l'image des boutons de navigation d'internet") — un fil de navigation
 * propre à ce composant plutôt que `router.back()`/`forward()` (l'API
 * History native n'expose ni la position courante ni la longueur utile
 * pour désactiver un bouton en bout de pile). Chaque changement de page
 * (wiki OU règles, `TwoPaneReaderLayout` est partagé par les deux) pousse
 * une entrée ; cliquer Précédent/Suivant navigue dans CETTE pile sans en
 * créer de nouvelle (`navigatingRef` distingue les deux cas).
 */
export default function ReaderHistoryNav() {
  const pathname = usePathname();
  const router = useRouter();
  const stackRef = useRef<string[]>([pathname]);
  const indexRef = useRef(0);
  const navigatingRef = useRef(false);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);

  useEffect(() => {
    if (navigatingRef.current) {
      navigatingRef.current = false;
    } else if (stackRef.current[indexRef.current] !== pathname) {
      stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
      stackRef.current.push(pathname);
      indexRef.current = stackRef.current.length - 1;
    }
    setCanBack(indexRef.current > 0);
    setCanForward(indexRef.current < stackRef.current.length - 1);
  }, [pathname]);

  function goBack() {
    if (indexRef.current === 0) return;
    navigatingRef.current = true;
    indexRef.current -= 1;
    router.push(stackRef.current[indexRef.current]);
  }

  function goForward() {
    if (indexRef.current >= stackRef.current.length - 1) return;
    navigatingRef.current = true;
    indexRef.current += 1;
    router.push(stackRef.current[indexRef.current]);
  }

  return (
    <div className="mb-2 flex gap-1.5 print:hidden">
      <button
        type="button"
        onClick={goBack}
        disabled={!canBack}
        className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-40"
      >
        ← Précédent
      </button>
      <button
        type="button"
        onClick={goForward}
        disabled={!canForward}
        className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-40"
      >
        Suivant →
      </button>
    </div>
  );
}
