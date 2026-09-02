import CreateHomebrewBackgroundForm from "@/components/rules/CreateHomebrewBackgroundForm";

export default async function NouvelHistoriquePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return <CreateHomebrewBackgroundForm worldSlug={worldSlug} />;
}
