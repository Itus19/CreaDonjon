import NewEntityForm from "./NewEntityForm";

export default async function NewEntityPage({
  params,
}: {
  params: Promise<{ worldId: string }>;
}) {
  const { worldId } = await params;
  return <NewEntityForm worldId={worldId} />;
}
