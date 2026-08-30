import NotesEditor from "@/components/entities/player/NotesEditor";

export default async function JoueurNotesPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return <NotesEditor worldSlug={worldSlug} />;
}
