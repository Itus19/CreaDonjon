import CreateHomebrewSpellForm from "@/components/rules/CreateHomebrewSpellForm";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";
import { RULE_TOOL_LABELS } from "@/components/shell/windowRefs";

export default async function NouveauSortPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return (
    <>
      <RegisterPrimaryWindow
        windowRef={{ kind: "rule-tool", key: "nouveau-sort" }}
        name={RULE_TOOL_LABELS["nouveau-sort"]}
        badge=""
        homeHref={`/m/${worldSlug}/regles`}
      />
      <CreateHomebrewSpellForm worldSlug={worldSlug} />
    </>
  );
}
