import NotesEditor from "@/components/entities/player/NotesEditor";

export default async function JoueurNotesPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return (
    <div className="mx-auto max-w-[70ch]">
      <NotesEditor worldSlug={worldSlug} />
    </div>
  );
}
