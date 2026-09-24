"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ScenePanel from "@/components/solo/ScenePanel";
import IntentBar from "@/components/solo/IntentBar";
import Fil from "@/components/solo/Fil";
import type { FilItem, IntentBarData, PendingRequest, SceneView } from "@/lib/solo/types";

/**
 * V3-B2 — Les deux moitiés de l'écran solo : la scène, puis le tour.
 *
 * **V3-D1** : la scène défile, la saisie reste ancrée en bas. Sous 768 px
 * c'est la seule façon de garder le champ atteignable quand le clavier
 * virtuel monte ; au-dessus, ça évite d'aller rechercher la barre en bas
 * d'un fil qui s'allonge à chaque tour.
 *
 * **V3-D4** : le fil (`Fil.tsx`) rejoint `ScenePanel` dans la MÊME zone
 * défilante — c'est ce composant-ci qui possède le défilement automatique
 * et l'annonce `aria-live`, puisqu'il possède déjà le conteneur.
 *
 * **V3-D4 Phase 2 — `pending` devient un état possédé ICI, pas par
 * `IntentBar`.** Une demande peut être honorée depuis la fiche (colonne
 * voisine, V3-B5 Phase 2) sans que `IntentBar` en soit jamais informé
 * autrement : le sonder au même endroit que le fil — un seul minuteur, un
 * seul aller-retour réseau par tick — plutôt que de dupliquer un second
 * sondage dans `IntentBar.tsx` pour la même donnée.
 */
const POLL_MS = 4000;

interface SheetPendingResponse {
  runtimeState: { state: { pending_request: PendingRequest | null } };
}

function summarizeForAnnounce(item: FilItem): string {
  switch (item.kind) {
    case "narration":
      return item.text;
    case "player_action":
      return item.text;
    case "roll":
      return item.facts.join(" ");
    case "rule_application":
      return item.changes[0] ?? item.hints[0] ?? "";
    case "world_update":
      return item.note;
    case "other":
      return "";
  }
}

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
  const [filItems, setFilItems] = useState<FilItem[] | null>(null);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [announce, setAnnounce] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const lastSeqRef = useRef<number | null>(null);

  /** Rafraîchit le fil ET la demande en cours — même tick, même raison : les deux peuvent changer sans passer par cette colonne (un jet résolu depuis la fiche écrit les deux à la fois). */
  async function reloadCenter() {
    const [filRes, sheetRes] = await Promise.all([
      fetch(`/api/campaigns/${campaignId}/fil`),
      fetch(`/api/entities/${entityId}/sheet?campaignId=${campaignId}`),
    ]);
    if (filRes.ok) {
      const body = (await filRes.json()) as { items: FilItem[] };
      const newest = body.items[body.items.length - 1];
      if (newest && newest.seq !== lastSeqRef.current) {
        lastSeqRef.current = newest.seq;
        setAnnounce(summarizeForAnnounce(newest));
      }
      setFilItems(body.items);
    }
    if (sheetRes.ok) {
      const body = (await sheetRes.json()) as SheetPendingResponse;
      setPending(body.runtimeState.state.pending_request);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (!cancelled) await reloadCenter();
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, entityId]);

  // Défile jusqu'en bas à chaque nouveau contenu, SAUF si le joueur a
  // remonté lire quelque chose plus haut — cas classique et
  // systématiquement raté (critère explicite du ticket).
  useEffect(() => {
    if (autoScrollRef.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [filItems, sceneView]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
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
        <div className="mt-4">
          <Fil items={filItems} />
        </div>
      </div>
      {/* Region discrete : annonce chaque nouveau tour sans deplacer le
          focus — seul ecran du produit ou du contenu arrive sans action de
          l'utilisateur (critere F-08 de l'audit). */}
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
      {/* `bg-bg` : le fil passe DERRIÈRE la barre en défilant, il ne doit
          pas se lire au travers. */}
      <div className="sticky bottom-0 shrink-0 bg-bg pb-1 pt-2">
        <IntentBar
          worldSlug={worldSlug}
          campaignId={campaignId}
          entityId={entityId}
          data={data}
          pending={pending}
          onPendingChange={setPending}
          onActed={reloadCenter}
        />
      </div>
    </div>
  );
}
