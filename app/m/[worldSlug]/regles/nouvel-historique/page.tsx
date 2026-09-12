import CreateHomebrewBackgroundForm from "@/components/rules/CreateHomebrewBackgroundForm";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";
import { RULE_TOOL_LABELS } from "@/components/shell/windowRefs";

export default async function NouvelHistoriquePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return (
    <>
      <RegisterPrimaryWindow
        windowRef={{ kind: "rule-tool", key: "nouvel-historique" }}
        name={RULE_TOOL_LABELS["nouvel-historique"]}
        badge=""
        homeHref={`/m/${worldSlug}/regles`}
      />
      <CreateHomebrewBackgroundForm worldSlug={worldSlug} />
    </>
  );
}
