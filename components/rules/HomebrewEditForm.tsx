"use client";

import CreateHomebrewBackgroundForm from "@/components/rules/CreateHomebrewBackgroundForm";
import CreateHomebrewFeatureForm from "@/components/rules/CreateHomebrewFeatureForm";
import CreateHomebrewSpellForm from "@/components/rules/CreateHomebrewSpellForm";
import CreateHomebrewSubclassForm from "@/components/rules/CreateHomebrewSubclassForm";
import CreateHomebrewWeaponForm from "@/components/rules/CreateHomebrewWeaponForm";

/** Les cinq types qui ont un formulaire « Créer un/une… » — les seuls qu'on rouvre pour les modifier (V3.1-2). */
const EDITABLE_TYPES = ["spell", "subclass", "feature", "background", "weapon"] as const;

export function isEditableHomebrewType(entryType: string): boolean {
  return (EDITABLE_TYPES as readonly string[]).includes(entryType);
}

/**
 * Rouvre le formulaire de creation d'une fiche maison, pre-rempli, pour la
 * modifier en place (V3.1-2). Chaque formulaire relit lui-meme la fiche
 * (`GET /api/rulesets/[id]/entries/[cle]`) une fois la variante active
 * connue ; ce composant ne fait que choisir le bon.
 */
export default function HomebrewEditForm({
  worldSlug,
  entryType,
  entryKey,
  onDone,
  onCancel,
}: {
  worldSlug: string;
  entryType: string;
  entryKey: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const edit = { entryKey, onCancel };
  return (
    <section className="rounded-2xl border border-accent/40 bg-panel-sunken p-4">
      {entryType === "spell" && <CreateHomebrewSpellForm worldSlug={worldSlug} onDone={onDone} edit={edit} />}
      {entryType === "subclass" && <CreateHomebrewSubclassForm worldSlug={worldSlug} onDone={onDone} edit={edit} />}
      {entryType === "feature" && <CreateHomebrewFeatureForm worldSlug={worldSlug} onDone={onDone} edit={edit} />}
      {entryType === "background" && <CreateHomebrewBackgroundForm worldSlug={worldSlug} onDone={onDone} edit={edit} />}
      {entryType === "weapon" && <CreateHomebrewWeaponForm worldSlug={worldSlug} onDone={onDone} edit={edit} />}
    </section>
  );
}
