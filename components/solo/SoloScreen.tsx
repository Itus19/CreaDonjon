"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ScenePanel from "@/components/solo/ScenePanel";
import IntentBar from "@/components/solo/IntentBar";
import type { IntentBarData, SceneView } from "@/lib/solo/types";

/**
 * V3-B2 — Les deux moitiés de l'écran solo : la scène, puis le tour.
 *
 * **V3-D1** : la scène défile, la saisie reste ancrée en bas. Sous 768 px
 * c'est la seule façon de garder le champ atteignable quand le clavier
 * virtuel monte ; au-dessus, ça évite d'aller rechercher la barre en bas
 * d'un fil qui s'allonge à chaque tour.
 *
 * Ce composant n'existe que pour tenir la scène courante entre les deux.
 * Quand elle change, il demande aussi un `router.refresh()` : le catalogue
 * de la barre (les présents qu'on peut viser) est construit **côté
 * serveur**, et lui laisser une liste périmée ferait proposer des cibles
 * qui ne sont plus là — exactement le défaut d'ADR 0009, à une échelle
 * plus petite.
 */
export default function SoloScreen({
  worldSlug,
  campaignId,
  entityId,
  data,
  scene,
  locations,
  candidates,
}: {
  worldSlug: string;
  campaignId: string;
  entityId: string;
  data: IntentBarData;
  scene: SceneView | null;
  locations: { id: string; name: string }[];
  candidates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [sceneView, setSceneView] = useState(scene);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ScenePanel
          campaignId={campaignId}
          scene={sceneView}
          locations={locations}
          candidates={candidates}
          onChanged={(next) => {
            setSceneView(next);
            router.refresh();
          }}
        />
      </div>
      {/* `bg-bg` : le fil passe DERRIÈRE la barre en défilant, il ne doit
          pas se lire au travers. */}
      <div className="sticky bottom-0 shrink-0 bg-bg pb-1 pt-2">
        <IntentBar worldSlug={worldSlug} campaignId={campaignId} entityId={entityId} data={data} />
      </div>
    </div>
  );
}
