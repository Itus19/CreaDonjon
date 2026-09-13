"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import RuleEntryView from "@/components/rules/RuleEntryView";
import PublicEntityBody from "@/components/entities/public/PublicEntityBody";
import type { EntityWindowData } from "@/src/server/services/entityWindow";
import type { RuleEntryDetail } from "@/src/server/services/rules";
import type { EntitySummary } from "@/src/server/repos/entities";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import type { PublicBlock, PublicRelation } from "@/src/server/services/publicShare";

const EditEntityForm = dynamic(() => import("@/app/m/[worldSlug]/(monde)/f/[entitySlug]/EditEntityForm"), {
  ssr: false,
  loading: () => <p className="text-sm text-ink-muted">Chargement...</p>,
});

export type CompanionTarget = { kind: "entity"; slug: string } | { kind: "rule"; key: string };

type CompanionData =
  | ({ mode: "edit" } & EntityWindowData)
  | {
      mode: "read";
      worldSlug: string;
      entity: EntitySummary;
      blocks: PublicBlock[];
      relations: PublicRelation[];
      portraitLayout: EntityPortraitLayout;
    };

/**
 * Fiche compagne du cahier de notes (V2.1-2, piste "un seul compagnon") —
 * un panneau fixe à côté du cahier, MJ comme joueuse, plutôt qu'une
 * fenêtre flottante séparée : la coquille joueur n'en a pas
 * (`PlayerShell.tsx`), et copier cette disposition côté MJ plutôt que
 * d'utiliser le système de fenêtres évite d'avoir deux comportements
 * différents à maintenir pour le même outil (retour utilisateur). Une
 * cible remplace la précédente (état local du parent,
 * `NotebookWorkspace.tsx`) — jamais plus d'un compagnon à la fois.
 */
export default function FicheCompanion({
  worldSlug,
  target,
  isGm,
  onClose,
}: {
  worldSlug: string;
  target: CompanionTarget;
  /** Pure préférence d'affichage (assistance IA, bouton "Demande de modif au MJ"...) — jamais une question de sécurité, déjà tranchée côté serveur par `canUserEditEntity`. */
  isGm?: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<CompanionData | RuleEntryDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const url =
      target.kind === "entity"
        ? `/api/worlds/${worldSlug}/fiche-compagnon/${target.slug}`
        : `/api/worlds/${worldSlug}/regles/${target.key}/window`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(setData)
      .catch(() => setError(true));
    // Composant remonte a chaque changement de cible (`key` pose par
    // `NotebookWorkspace.tsx`) — cet effet ne s'execute donc qu'une fois
    // par cible, jamais besoin de reinitialiser `data`/`error` a la main
    // (react-hooks/set-state-in-effect l'interdit de toute facon en debut
    // d'effet).
  }, [worldSlug, target]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-end border-b border-edge/60 px-2 py-1">
        <button type="button" onClick={onClose} title="Fermer" aria-label="Fermer" className="rounded px-1.5 py-0.5 text-sm text-ink-muted hover:bg-panel-raised hover:text-ink">
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <p className="text-sm text-danger">Fiche introuvable ou plus visible.</p>
        ) : !data ? (
          <p className="text-sm text-ink-muted">Chargement...</p>
        ) : target.kind === "rule" ? (
          <RuleEntryView entry={data as RuleEntryDetail} worldSlug={worldSlug} playerRestricted={!isGm} />
        ) : (data as CompanionData).mode === "edit" ? (
          (() => {
            const entityData = data as Extract<CompanionData, { mode: "edit" }>;
            return (
              <EditEntityForm
                entity={entityData.entity}
                worldSlug={entityData.worldSlug}
                initialBlocks={entityData.blocks}
                initialRelations={entityData.relations}
                otherEntities={entityData.otherEntities}
                worldCustomKinds={entityData.worldCustomKinds}
                campaignId={entityData.campaignId}
                initialIsPc={entityData.isPc}
                campaignCharacterUserId={entityData.campaignCharacterUserId}
                initialPortraitLayout={entityData.portraitLayout}
                playerRestricted={!isGm}
              />
            );
          })()
        ) : (
          (() => {
            const entityData = data as Extract<CompanionData, { mode: "read" }>;
            return (
              <PublicEntityBody
                entity={entityData.entity}
                blocks={entityData.blocks}
                relations={entityData.relations}
                portraitLayout={entityData.portraitLayout}
                hrefBase={`/m/${worldSlug}/joueur/wiki`}
                ruleHrefBase={`/m/${worldSlug}/joueur/regles`}
              />
            );
          })()
        )}
      </div>
    </div>
  );
}
