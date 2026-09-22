"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ScenePanel from "@/components/solo/ScenePanel";
import IntentBar from "@/components/solo/IntentBar";
import type { IntentBarData, SceneView } from "@/lib/solo/types";

/**
 * V3-B2 — Les deux moitiés de l'écran solo : la scène, puis le tour.
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
    <div className="flex flex-col gap-4">
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
      <IntentBar worldSlug={worldSlug} campaignId={campaignId} entityId={entityId} data={data} />
    </div>
  );
}
