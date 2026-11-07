"use client";

import { useState, type ComponentProps } from "react";
import PlayableCharacterSheet from "./PlayableCharacterSheet";
import CharacterCreatorWizard from "./CharacterCreatorWizard";

type Props = Omit<ComponentProps<typeof PlayableCharacterSheet>, "apercu" | "onMonterDeNiveau">;

/**
 * La fiche jouable et sa montée de niveau (V2-G1) : l'assistant remplace la
 * fiche le temps de la montée, puis la fiche revient — remontée, elle
 * recharge sa fiche calculée (PV maximum du nouveau niveau compris).
 *
 * V3.1-177 : sorti de `PlayableCharacterSheet`, parce que l'assistant affiche
 * désormais cette fiche en aperçu ; la fiche important l'assistant, les deux
 * formaient un cycle (`import/no-cycle`, docs/ARCHITECTURE.md). Ce composant
 * importe les deux, aucun n'importe l'autre.
 */
export default function FicheAvecMontee(props: Props) {
  const [monteeOuverte, setMonteeOuverte] = useState(false);
  const { worldSlug, entityId, campaignId, character, inventory, spellcasting, characterBlockId, characterBlockVersion, onBlockRefreshed, isWorldAdmin = false } = props;

  if (monteeOuverte) {
    return (
      <CharacterCreatorWizard
        worldSlug={worldSlug}
        montee={{
          entityId,
          campaignId,
          expectedVersion: characterBlockVersion,
          initial: {
            character,
            inventory: inventory ?? { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } },
            spellcasting,
          },
          isWorldAdmin,
          onCancel: () => setMonteeOuverte(false),
          onDone: (result) => {
            onBlockRefreshed({ id: characterBlockId, data: result.character.data, version: result.character.version });
            if (result.spellcasting) onBlockRefreshed(result.spellcasting);
            setMonteeOuverte(false);
          },
        }}
      />
    );
  }

  return <PlayableCharacterSheet {...props} onMonterDeNiveau={() => setMonteeOuverte(true)} />;
}
