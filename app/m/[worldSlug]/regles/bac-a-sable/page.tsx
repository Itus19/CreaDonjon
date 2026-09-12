import FormulaSandbox from "@/components/rules/FormulaSandbox";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";
import { RULE_TOOL_LABELS } from "@/components/shell/windowRefs";

export default async function BacASablePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return (
    <>
      <RegisterPrimaryWindow
        windowRef={{ kind: "rule-tool", key: "bac-a-sable" }}
        name={RULE_TOOL_LABELS["bac-a-sable"]}
        badge=""
        homeHref={`/m/${worldSlug}/regles`}
      />
      <FormulaSandbox />
    </>
  );
}
