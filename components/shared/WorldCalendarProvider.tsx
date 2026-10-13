"use client";

import { createContext, useContext } from "react";
import { DEFAULT_CALENDAR } from "@/src/core/calendar/defaultCalendar";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";

/**
 * Calendrier du monde (V3.1-48), lu par le layout du monde (docs/CABLAGE.md,
 * C1) et partage par contexte (C2) : aucune requete cote client. Donnees
 * serialisables. Sans fournisseur (ecran hors d'un monde), le calendrier
 * par defaut, sans date du jour.
 */
const WorldCalendarContext = createContext<CalendarConfigInput>(DEFAULT_CALENDAR);

export default function WorldCalendarProvider({
  calendar,
  children,
}: {
  calendar: CalendarConfigInput;
  children: React.ReactNode;
}) {
  return <WorldCalendarContext.Provider value={calendar}>{children}</WorldCalendarContext.Provider>;
}

export function useWorldCalendarContext(): CalendarConfigInput {
  return useContext(WorldCalendarContext);
}
