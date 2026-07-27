import Link from "next/link";
import EntityDetail from "@/components/desktop/EntityDetail";

export default async function EntityPage({
  params,
}: {
  params: Promise<{ id: string; entityId: string }>;
}) {
  const { id: worldId, entityId } = await params;

  return (
    <div className="flex flex-col flex-1 items-center font-sans">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-16 px-8">
        <Link
          href={`/worlds/${worldId}`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← Retour au monde
        </Link>
        <div className="card">
          <EntityDetail worldId={worldId} entityId={entityId} />
        </div>
      </main>
    </div>
  );
}
