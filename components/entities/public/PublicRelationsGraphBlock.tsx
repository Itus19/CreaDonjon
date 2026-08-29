"use client";

import RelationsGraphCanvas from "@/components/entities/psyche/RelationsGraphCanvas";
import type { RelationsGraph } from "@/src/core/relationsGraph/buildRelationsGraph";

/**
 * Rendu public du bloc `relations_graph` (V2-H2, "juste la partie des
 * schemas") — `RelationsGraphCanvas` deja desktop-agnostique (`useDesktop`
 * s'efface silencieusement hors du systeme de fenetres, la navigation
 * retombe sur le lien natif) : reutilise tel quel, sans `onToggleEdgeVisibility`
 * (lecture seule). Pas de coloration par attitude (demanderait de
 * resoudre une campagne pour un embellissement visuel, non demande
 * au-dela de "voir le schema") — tous les liens neutres.
 */
export default function PublicRelationsGraphBlock({ graph, hrefBase }: { graph: RelationsGraph; hrefBase: string }) {
  if (graph.nodes.length <= 1) {
    return <p className="text-sm italic text-ink-muted">Aucune relation visible pour l&apos;instant.</p>;
  }
  return <RelationsGraphCanvas graph={graph} hrefBase={hrefBase} edgeColor={() => "var(--edge)"} />;
}
