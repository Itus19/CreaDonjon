import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCalendar, getWorldBySlug } from "@/src/server/services/worlds";
import CalendarSettingsPanel from "@/components/shell/CalendarSettingsPanel";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

export default async function MjCalendrierPage({
  params,
}: {
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const calendar = await getCalendar(supabase, world.id);

  return (
    <>
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "calendrier" }} name="Calendrier" badge="" homeHref={`/m/${worldSlug}/mj/calendrier`} />
      <CalendarSettingsPanel worldSlug={worldSlug} initialCalendar={calendar} />
    </>
  );
}
