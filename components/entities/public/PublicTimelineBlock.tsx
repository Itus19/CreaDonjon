"use client";

import { useRouter } from "next/navigation";
import TimelineAxis from "@/components/entities/timeline/TimelineAxis";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { TimelineBlockData } from "@/src/core/schemas/blocks/timeline";

/**
 * Rendu public du bloc `timeline` (V2-H2, "juste la partie des schemas")
 * — l'axe seul, en lecture seule (`TimelineAxis` sans `onCreateEntry` :
 * pan/zoom restent actifs, plus d'ajout par clic/glisse). Cliquer une
 * entree promue navigue vers sa fiche ; une entree non promue n'a nulle
 * part ou naviguer, son titre/sa date restent deja lisibles sur l'axe.
 */
export default function PublicTimelineBlock({
  data,
  calendar,
  refs,
  hrefBase,
}: {
  data: TimelineBlockData;
  calendar: CalendarConfigInput;
  refs: Record<string, { name: string; slug: string }>;
  hrefBase: string;
}) {
  const router = useRouter();

  function handleSelect(id: string) {
    const entry = data.entries.find((e) => e.id === id);
    if (entry?.ref?.kind === "entity" && refs[entry.ref.id]) {
      router.push(`${hrefBase}/${refs[entry.ref.id].slug}`);
    }
  }

  if (data.entries.length === 0 && !calendar.currentDate) {
    return <p className="text-sm italic text-ink-muted">Aucun événement visible pour l&apos;instant.</p>;
  }

  return (
    <TimelineAxis
      entries={data.entries}
      calendar={calendar}
      selectedEntryId={null}
      onSelectEntry={handleSelect}
      todayDate={calendar.currentDate}
    />
  );
}
