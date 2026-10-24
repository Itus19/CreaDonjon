import type { FractionsAnneau, TonAnneau } from "@/lib/ui/initiative";

/**
 * Bleu des PV temporaires, celui de la planche « Décidé · initiative ». Aucun
 * jeton de la charte ne le porte encore : à promouvoir en jeton quand la
 * seconde jauge bleue de la fiche (V3.1-26) arrivera au même endroit.
 */
const BLEU_PV_TEMPORAIRES = "oklch(0.72 0.13 235)";

const TRAIT_PAR_TON: Record<TonAnneau, string> = {
  plein: "stroke-accent",
  moyen: "stroke-gm",
  bas: "stroke-danger",
  hors: "stroke-ink-muted",
};

/**
 * L'anneau de PV d'un participant : l'arc des PV (couleur selon l'état), et
 * autour, l'arc bleu des PV temporaires. Décoratif : la valeur est écrite à côté
 * (« 20/15 »), l'anneau n'est jamais la seule information.
 */
export default function AnneauPv({ fractions }: { fractions: FractionsAnneau }) {
  return (
    <svg viewBox="0 0 44 44" className="h-8 w-8 -rotate-90" fill="none" aria-hidden="true">
      <circle cx="22" cy="22" r="16" strokeWidth="5" className="stroke-panel-sunken" />
      {fractions.pv > 0 && (
        <circle cx="22" cy="22" r="16" strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray={`${fractions.pv} 100`} className={TRAIT_PAR_TON[fractions.ton]} />
      )}
      {fractions.temp > 0 && (
        <circle cx="22" cy="22" r="20" strokeWidth="2.5" strokeLinecap="round" pathLength="100" strokeDasharray={`${fractions.temp} 100`} style={{ stroke: BLEU_PV_TEMPORAIRES }} />
      )}
    </svg>
  );
}
