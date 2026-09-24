"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ScenePanel from "@/components/solo/ScenePanel";
import IntentBar from "@/components/solo/IntentBar";
import Fil from "@/components/solo/Fil";
import type { FilItem, IntentBarData, SceneView } from "@/lib/solo/types";

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
 * et l'annonce `aria-live`, puisqu'il possède déjà le conteneur. Sondé
 * toutes les 4 secondes (même raison que `FicheJouableSolo.tsx`, Phase 2
 * de V3-B5 : un jet résolu depuis la fiche, colonne voisine, n'a aucun
 * canal direct vers ce composant-ci) et rafraîchi tout de suite après un
 * tour joué DEPUIS cette colonne (`onTurnPlayed`), pour que la réponse à
 * son propre geste n'attende jamais le sondage.
 */
const POLL_MS = 4000;

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
  const [announce, setAnnounce] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const lastSeqRef = useRef<number | null>(null);

  async function reloadFil() {
    const res = await fetch(`/api/campaigns/${campaignId}/fil`);
    if (!res.ok) return;
    const body = (await res.json()) as { items: FilItem[] };
    const newest = body.items[body.items.length - 1];
    if (newest && newest.seq !== lastSeqRef.current) {
      lastSeqRef.current = newest.seq;
      setAnnounce(summarizeForAnnounce(newest));
    }
    setFilItems(body.items);
  }

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (!cancelled) await reloadFil();
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

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
        <IntentBar worldSlug={worldSlug} campaignId={campaignId} entityId={entityId} data={data} onTurnPlayed={reloadFil} />
      </div>
    </div>
  );
}
