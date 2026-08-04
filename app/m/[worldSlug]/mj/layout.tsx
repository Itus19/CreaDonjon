import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import MjSidebar from "@/components/shell/MjSidebar";
import Panel from "@/components/shell/Panel";

export default async function MjLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  return (
    <>
      <MjSidebar worldSlug={worldSlug} />
      <div className="flex-1 overflow-y-auto p-8">
        <Panel>{children}</Panel>
      </div>
    </>
  );
}
