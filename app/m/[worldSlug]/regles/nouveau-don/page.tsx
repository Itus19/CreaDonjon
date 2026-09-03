import CreateHomebrewFeatureForm from "@/components/rules/CreateHomebrewFeatureForm";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";
import { RULE_TOOL_LABELS } from "@/components/shell/windowRefs";

export default async function NouveauDonPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return (
    <>
      <RegisterPrimaryWindow
        windowRef={{ kind: "rule-tool", key: "nouveau-don" }}
        name={RULE_TOOL_LABELS["nouveau-don"]}
        badge=""
        homeHref={`/m/${worldSlug}/regles`}
      />
      <CreateHomebrewFeatureForm worldSlug={worldSlug} />
    </>
  );
}
