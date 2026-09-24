import CreateHomebrewSubclassForm from "@/components/rules/CreateHomebrewSubclassForm";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";
import { RULE_TOOL_LABELS } from "@/components/shell/windowRefs";

export default async function NouvelleSousClassePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return (
    <>
      <RegisterPrimaryWindow
        windowRef={{ kind: "rule-tool", key: "nouvelle-sous-classe" }}
        name={RULE_TOOL_LABELS["nouvelle-sous-classe"]}
        badge=""
        homeHref={`/m/${worldSlug}/regles`}
      />
      <CreateHomebrewSubclassForm worldSlug={worldSlug} />
    </>
  );
}
