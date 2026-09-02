import CreateHomebrewFeatureForm from "@/components/rules/CreateHomebrewFeatureForm";

export default async function NouveauDonPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return <CreateHomebrewFeatureForm worldSlug={worldSlug} />;
}
