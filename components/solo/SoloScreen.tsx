"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import BandeFiche from "@/components/solo/BandeFiche";
import { useSoloContexte } from "@/components/solo/SoloContexte";
import ScenePanel from "@/components/solo/ScenePanel";
import IntentBar from "@/components/solo/IntentBar";
import Fil from "@/components/solo/Fil";
import ConsequencesDrawer, { type ConsequencesDrawerData } from "@/components/solo/ConsequencesDrawer";
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
 * et l'annonce `aria-live`, puisqu'il possède déjà le conteneur.
 *
 * **V3-D4 Phase 2 — `pending` n'est pas possédé par `IntentBar`.** Une
 * demande peut être honorée depuis la fiche (colonne voisine, V3-B5 Phase 2)
 * sans que `IntentBar` en soit jamais informé autrement. Elle vit dans
 * `SoloContexte` : la fiche, qui sonde déjà `/sheet`, la publie ; ce
 * composant ne sonde plus que le fil et les conséquences. Il sondait aussi
 * `/sheet` pour la seule demande, soit deux fois la même route toutes les
 * 4 s (docs/QUOTAS.md).
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
    case "note":
      return item.answer;
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
  const t = useTranslations("solo");
  const { jauges, demande: pending, definirDemande: setPending, rechargerFiche } = useSoloContexte();
  const [feuilleConsequences, setFeuilleConsequences] = useState(false);
  const [sceneView, setSceneView] = useState(scene);
  const [filItems, setFilItems] = useState<FilItem[] | null>(null);
  const [consequences, setConsequences] = useState<ConsequencesDrawerData | null>(null);
  const [announce, setAnnounce] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const lastSeqRef = useRef<number | null>(null);

  /**
   * Rafraîchit le fil et le tiroir de conséquences, chacun dès que SA
   * réponse arrive : attendre les deux ensemble retardait le fil sur la plus
   * lente. Tous deux changent sans passer par cette colonne (un jet résolu
   * depuis la fiche, une proposition acceptée depuis le tiroir lui-même).
   */
  async function reloadCenter() {
    await Promise.all([
      fetch(`/api/campaigns/${campaignId}/fil`).then(async (filRes) => {
        if (!filRes.ok) return;
        const body = (await filRes.json()) as { items: FilItem[] };
        const newest = body.items[body.items.length - 1];
        if (newest && newest.seq !== lastSeqRef.current) {
          lastSeqRef.current = newest.seq;
          setAnnounce(summarizeForAnnounce(newest));
        }
        setFilItems(body.items);
      }),
      fetch(`/api/campaigns/${campaignId}/consequences`).then(async (consequencesRes) => {
        if (consequencesRes.ok) setConsequences((await consequencesRes.json()) as ConsequencesDrawerData);
      }),
    ]);
  }

  /** Après un geste de cette colonne : le fil, les conséquences, ET la fiche (PV, demande) sans attendre son prochain tick. */
  function apresGeste() {
    rechargerFiche();
    return reloadCenter();
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

  const nombreConsequences = consequences ? consequences.pending.length + consequences.applied.length : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Téléphone (V3.1-36) : la bande de jauges en ligne, et ✦ qui ouvre les conséquences en feuille du bas. */}
      <div className="flex shrink-0 items-stretch gap-2 md:hidden">
        <BandeFiche jauges={jauges} variante="ligne" />
        {nombreConsequences > 0 && (
          <button
            type="button"
            onClick={() => setFeuilleConsequences(true)}
            aria-haspopup="dialog"
            aria-label={t("consequencesOuvrir", { nombre: nombreConsequences })}
            className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-edge bg-panel px-3 text-accent transition-colors hover:bg-panel-raised"
          >
            <span aria-hidden="true">✦</span>
            <span className="text-xs tabular-nums text-ink-soft">{nombreConsequences}</span>
          </button>
        )}
      </div>
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
        <div className="mt-2 max-md:hidden">
          <ConsequencesDrawer data={consequences} onChanged={apresGeste} />
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
          onActed={apresGeste}
        />
      </div>
      {feuilleConsequences && (
        <FeuilleDuBas titre={t("consequencesTitre")} titreVisible onFermer={() => setFeuilleConsequences(false)}>
          <div className="pb-2">
            <ConsequencesDrawer data={consequences} onChanged={apresGeste} ouvertParDefaut />
          </div>
        </FeuilleDuBas>
      )}
    </div>
  );
}
