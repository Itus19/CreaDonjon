"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { RemoteTableView } from "@/src/server/services/remotePlay";
import { useTableADistance } from "./useTableADistance";
import { useSignalOnglet } from "./useSignalOnglet";

type Valeur = ReturnType<typeof useTableADistance>;

const Contexte = createContext<Valeur | null>(null);

/**
 * Le jeu à distance (ADR 0103) : une seule lecture et un seul canal temps
 * réel pour tout l'écran (C2, QUOTAS Q3). Le fil, la colonne Table du MJ et
 * la pastille de l'onglet lisent la même vue.
 */
export function TableADistanceProvider({ initial, children }: { initial: RemoteTableView; children: ReactNode }) {
  const valeur = useTableADistance(initial);
  useSignalOnglet(valeur.view.unread);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useTableADistanceContexte(): Valeur {
  const v = useContext(Contexte);
  if (!v) throw new Error("useTableADistanceContexte hors de TableADistanceProvider");
  return v;
}
