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

type PlayerCompanionData =
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
 * Fiche compagne cote joueur (V2.1-2) — pas de fenetre flottante (la
 * coquille joueur n'en a pas, `PlayerShell.tsx`), un panneau simple a cote
 * du cahier. Une cible remplace la precedente (etat local du parent,
 * `NotebookWorkspace.tsx`) : jamais plus d'un compagnon a la fois, meme
 * garantie que la piste "un seul compagnon" cote MJ, juste sans le systeme
 * de fenetres.
 */
export default function PlayerFicheCompanion({ worldSlug, target }: { worldSlug: string; target: CompanionTarget }) {
  const [data, setData] = useState<PlayerCompanionData | RuleEntryDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const url =
      target.kind === "entity"
        ? `/api/worlds/${worldSlug}/joueur/fiche-compagnon/${target.slug}`
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

  if (error) return <p className="p-4 text-sm text-danger">Fiche introuvable ou plus visible.</p>;
  if (!data) return <p className="p-4 text-sm text-ink-muted">Chargement...</p>;

  if (target.kind === "rule") {
    return (
      <div className="h-full overflow-y-auto p-4">
        <RuleEntryView entry={data as RuleEntryDetail} worldSlug={worldSlug} playerRestricted />
      </div>
    );
  }

  const entityData = data as PlayerCompanionData;
  if (entityData.mode === "edit") {
    return (
      <div className="h-full overflow-y-auto p-4">
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
          playerRestricted
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <PublicEntityBody
        entity={entityData.entity}
        blocks={entityData.blocks}
        relations={entityData.relations}
        portraitLayout={entityData.portraitLayout}
        hrefBase={`/m/${worldSlug}/joueur/wiki`}
        ruleHrefBase={`/m/${worldSlug}/joueur/regles`}
      />
    </div>
  );
}
