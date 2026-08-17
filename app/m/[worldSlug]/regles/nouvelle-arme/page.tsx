import CreateHomebrewWeaponForm from "@/components/rules/CreateHomebrewWeaponForm";

export default async function NouvelleArmePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return <CreateHomebrewWeaponForm worldSlug={worldSlug} />;
}
