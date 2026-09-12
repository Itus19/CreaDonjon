import CreateHomebrewWeaponForm from "@/components/rules/CreateHomebrewWeaponForm";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";
import { RULE_TOOL_LABELS } from "@/components/shell/windowRefs";

export default async function NouvelleArmePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return (
    <>
      <RegisterPrimaryWindow
        windowRef={{ kind: "rule-tool", key: "nouvelle-arme" }}
        name={RULE_TOOL_LABELS["nouvelle-arme"]}
        badge=""
        homeHref={`/m/${worldSlug}/regles`}
      />
      <CreateHomebrewWeaponForm worldSlug={worldSlug} />
    </>
  );
}
