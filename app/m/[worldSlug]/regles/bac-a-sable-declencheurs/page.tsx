import TriggerSandbox from "@/components/rules/TriggerSandbox";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";
import { RULE_TOOL_LABELS } from "@/components/shell/windowRefs";

export default async function BacASableDeclencheursPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return (
    <>
      <RegisterPrimaryWindow
        windowRef={{ kind: "rule-tool", key: "bac-a-sable-declencheurs" }}
        name={RULE_TOOL_LABELS["bac-a-sable-declencheurs"]}
        badge=""
        homeHref={`/m/${worldSlug}/regles`}
      />
      <TriggerSandbox />
    </>
  );
}
