"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CALENDAR } from "@/src/core/calendar/defaultCalendar";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";

/**
 * Cache memoire par monde (retour utilisateur : "l'affichage tarde") —
 * quatre composants independants (Personality/Worldview/RelationshipEventTable,
 * TimelineBlockEditor) demandaient chacun `/api/worlds/[slug]/calendar` des
 * qu'ils montaient, jusqu'a 3-4 requetes identiques au chargement d'une
 * seule fiche qui porte plusieurs de ces blocs. Le calendrier ne change
 * jamais pendant une session d'edition (seul `CalendarSettingsPanel.tsx`,
 * hors de ce cache, l'ecrit) — un cache jamais invalide, valable pour la
 * duree du chargement de la page, suffit.
 */
const cache = new Map<string, Promise<CalendarConfigInput>>();

function fetchCalendar(worldSlug: string): Promise<CalendarConfigInput> {
  let promise = cache.get(worldSlug);
  if (!promise) {
    promise = fetch(`/api/worlds/${worldSlug}/calendar`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { calendar: CalendarConfigInput } | null) => body?.calendar ?? DEFAULT_CALENDAR)
      .catch(() => DEFAULT_CALENDAR);
    cache.set(worldSlug, promise);
  }
  return promise;
}

export function useWorldCalendar(worldSlug: string): CalendarConfigInput {
  const [calendar, setCalendar] = useState<CalendarConfigInput>(DEFAULT_CALENDAR);
  useEffect(() => {
    let cancelled = false;
    fetchCalendar(worldSlug).then((c) => {
      if (!cancelled) setCalendar(c);
    });
    return () => {
      cancelled = true;
    };
  }, [worldSlug]);
  return calendar;
}
