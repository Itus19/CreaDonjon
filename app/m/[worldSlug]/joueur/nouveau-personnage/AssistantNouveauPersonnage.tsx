"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import CharacterCreatorWizard from "@/components/blocks/CharacterCreatorWizard";
import { createAndClaimCharacterAction, reclamerEtCreerFicheAction } from "./actions";

/**
 * L'assistant de la coquille joueuse (V3.1-83). Deux trajets, un seul retour
 * en cas d'annulation : le carrousel, sans rien avoir écrit.
 * - `pj` absent : une entité nouvelle, créée et réclamée à la validation.
 * - `pj` : un PJ ouvert sans fiche, réclamé puis écrit à la validation.
 */
export default function AssistantNouveauPersonnage({
  worldSlug,
  worldId,
  pj,
}: {
  worldSlug: string;
  worldId: string;
  pj: { entityId: string; name: string; version: number } | null;
}) {
  const t = useTranslations("choixPersonnage");
  const router = useRouter();
  const retourAuChoix = () => router.push(`/m/${worldSlug}/joueur`);

  if (!pj) {
    return (
      <CharacterCreatorWizard
        worldSlug={worldSlug}
        worldId={worldId}
        playerRestricted
        onCreate={createAndClaimCharacterAction}
        onCancel={retourAuChoix}
      />
    );
  }

  return (
    <CharacterCreatorWizard
      worldSlug={worldSlug}
      playerRestricted
      entityMode={{
        entityId: pj.entityId,
        expectedVersion: pj.version,
        initialName: pj.name,
        note: t("assistantNote", { prenom: pj.name.split(" ")[0] }),
        onSubmit: reclamerEtCreerFicheAction,
        onCancel: retourAuChoix,
        // L'action redirige vers l'onglet Personnage : jamais appelé.
        onDone: retourAuChoix,
      }}
    />
  );
}
