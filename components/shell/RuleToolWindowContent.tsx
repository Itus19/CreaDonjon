"use client";

import CreateHomebrewBackgroundForm from "@/components/rules/CreateHomebrewBackgroundForm";
import CreateHomebrewFeatureForm from "@/components/rules/CreateHomebrewFeatureForm";
import CreateHomebrewWeaponForm from "@/components/rules/CreateHomebrewWeaponForm";
import FormulaSandbox from "@/components/rules/FormulaSandbox";
import { useDesktopWindowsState } from "@/components/shell/DesktopWindowsProvider";
import type { RuleToolKey } from "./windowRefs";

/**
 * Contenu d'une fenetre `rule-tool` (retour utilisateur, V2 : formulaires
 * de creation de regle maison "comme les autres fiches"). `onDone` ferme la
 * fenetre a la place de naviguer (voir `onDone` sur chaque formulaire) —
 * c'est ce qui permet de revenir a une fenetre parente (ex. "creer un
 * historique") deja ouverte, brouillon intact, une fois le don qui
 * manquait cree dans cette fenetre-ci.
 */
export default function RuleToolWindowContent({ worldSlug, toolKey }: { worldSlug: string; toolKey: RuleToolKey }) {
  const state = useDesktopWindowsState();
  const onDone = state ? () => state.closeWindow({ kind: "rule-tool", key: toolKey }) : undefined;

  if (toolKey === "nouvel-historique") return <CreateHomebrewBackgroundForm worldSlug={worldSlug} onDone={onDone} />;
  if (toolKey === "nouveau-don") return <CreateHomebrewFeatureForm worldSlug={worldSlug} onDone={onDone} />;
  if (toolKey === "nouvelle-arme") return <CreateHomebrewWeaponForm worldSlug={worldSlug} onDone={onDone} />;
  return <FormulaSandbox />;
}
