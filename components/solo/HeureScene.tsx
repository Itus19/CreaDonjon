"use client";

import { useSoloContexte } from "@/components/solo/SoloContexte";
import type { GameTime } from "@/src/core/rules/scene";

/**
 * V3.2-18 — L'heure du bandeau solo. La page serveur la donne à l'ouverture
 * (`initiale`) ; après chaque tour, la barre d'intention pose l'heure rendue
 * par le moteur dans le contexte, et elle s'affiche ici sans recharger la
 * page (docs/CABLAGE.md C5 : on met à jour son coin d'écran).
 */
export default function HeureScene({ initiale }: { initiale: GameTime }) {
  const { heure } = useSoloContexte();
  const t = heure ?? initiale;
  return <span className="text-sm text-ink">{`${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`}</span>;
}
