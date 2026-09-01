import RulesetSelector from "@/components/rules/RulesetSelector";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/** Ancien onglet "Règles" du menu de réglages (retour utilisateur, gomme le bouton ⚙) — `RulesetSelector` est deja autonome (fetch/patch son propre ruleset), rien d'autre a brancher ici. */
export default async function MjReglesActivesPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return (
    <div className="flex flex-col gap-4">
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "regles-actives" }} name="Règles actives" badge="" homeHref={`/m/${worldSlug}/mj/regles-actives`} />
      <h1 className="block-title text-lg">Règles actives</h1>
      <RulesetSelector worldSlug={worldSlug} />
    </div>
  );
}
