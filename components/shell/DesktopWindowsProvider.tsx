"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { WindowGeometry } from "./WindowFrame";
import { DesktopContext, type PrimaryWindowInfo } from "./DesktopContext";
import {
  parseAvecParam,
  refId,
  refsEqual,
  sectionHomeHref,
  serializeAvecParam,
  windowHref,
  type WindowRef,
} from "./windowRefs";
import type { EntityWindowData } from "@/src/server/services/entityWindow";
import type { RuleEntryDetail } from "@/src/server/services/rules";

const DEFAULT_WIDTH = 860;
const DEFAULT_HEIGHT = 760;

function defaultGeometry(index: number): WindowGeometry {
  const offset = (index % 6) * 28;
  return { x: 40 + offset, y: 24 + offset, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, isMaximized: false };
}

function windowDataUrl(worldSlug: string, ref: WindowRef): string {
  return ref.kind === "entity"
    ? `/api/worlds/${worldSlug}/entities/${ref.key}/window`
    : `/api/worlds/${worldSlug}/regles/${ref.key}/window`;
}

export interface AvecWindowEntry {
  ref: WindowRef;
  geometry: WindowGeometry;
  isFocused: boolean;
  data: EntityWindowData | RuleEntryDetail | undefined;
}

export interface DesktopWindowsState {
  primary: PrimaryWindowInfo | null;
  primaryGeometry: WindowGeometry | undefined;
  isPrimaryFocused: boolean;
  avecWindows: AvecWindowEntry[];
  focusWindow: (id: string) => void;
  closeWindow: (ref: WindowRef) => void;
  updateGeometry: (ref: WindowRef, updates: Partial<WindowGeometry>) => void;
}

/**
 * Etat des fenetres flottantes (ADR-0011), partage par Monde et Regles :
 * monte une seule fois dans `app/m/[worldSlug]/layout.tsx`, au-dessus des
 * trois sections. Chaque section ne monte que le RENDU (`WindowsDesktop`),
 * jamais un second etat — changer de section ne ferme donc plus les
 * fenetres ouvertes. MJ ne consomme pas ce contexte : ses ecrans restent
 * plein cadre, sans fenetre.
 *
 * `?avec=` melange desormais entites et entrees de regle (`windowRefs.ts`).
 * Position/taille/empilement restent un etat purement client — jamais dans
 * l'URL, pour ne pas polluer l'historique de navigation.
 */
export default function DesktopWindowsProvider({
  worldSlug,
  children,
}: {
  worldSlug: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fetchedRef = useRef<Set<string>>(new Set());

  const [primary, setPrimary] = useState<PrimaryWindowInfo | null>(null);
  const [geometries, setGeometries] = useState<Record<string, WindowGeometry>>({});
  const [avecData, setAvecData] = useState<Record<string, EntityWindowData | RuleEntryDetail>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const avecRefs = parseAvecParam(searchParams.get("avec")).filter(
    (ref) => !primary || !refsEqual(ref, primary.ref)
  );
  const avecRefsKey = avecRefs.map(refId).join(",");
  const activeRefs = primary ? [primary.ref, ...avecRefs] : avecRefs;
  const activeIdsKey = activeRefs.map(refId).join(",");

  const registerPrimary = useCallback((info: PrimaryWindowInfo | null) => {
    setPrimary(info);
    if (info) setFocusedId(refId(info.ref));
  }, []);

  // Assigne une position par defaut a toute fenetre nouvellement visible,
  // sans jamais reinitialiser une fenetre deja ouverte. Ajustement d'etat
  // pendant le rendu (motif documente par React), pas dans un effet.
  const [lastIdsKey, setLastIdsKey] = useState<string | null>(null);
  if (lastIdsKey !== activeIdsKey) {
    setLastIdsKey(activeIdsKey);
    const missing = activeRefs.filter((ref) => !geometries[refId(ref)]);
    if (missing.length > 0) {
      setGeometries((prev) => {
        const next = { ...prev };
        missing.forEach((ref, index) => {
          next[refId(ref)] = defaultGeometry(Object.keys(prev).length + index);
        });
        return next;
      });
    }
  }

  // Recupere les donnees de chaque fenetre `?avec=` pas encore chargee.
  useEffect(() => {
    avecRefs.forEach((ref) => {
      const id = refId(ref);
      if (fetchedRef.current.has(id)) return;
      fetchedRef.current.add(id);
      fetch(windowDataUrl(worldSlug, ref))
        .then((res) => (res.ok ? res.json() : null))
        .then((data: EntityWindowData | RuleEntryDetail | null) => {
          if (data) setAvecData((prev) => ({ ...prev, [id]: data }));
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avecRefsKey, worldSlug]);

  function updateAvecParam(nextRefs: WindowRef[]) {
    const params = new URLSearchParams(searchParams);
    if (nextRefs.length > 0) {
      params.set("avec", nextRefs.map(refId).join(","));
    } else {
      params.delete("avec");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const openRef = useCallback(
    (ref: WindowRef) => {
      if (!primary) {
        // Aucune fenetre primaire, mais d'autres fenetres peuvent deja
        // etre ouvertes (`?avec=`, ex. depuis l'accueil d'une section) —
        // la nouvelle fenetre devient primaire SANS les fermer.
        const remaining = avecRefs.filter((r) => !refsEqual(r, ref));
        const query = remaining.length > 0 ? `?avec=${encodeURIComponent(serializeAvecParam(remaining))}` : "";
        router.push(`${windowHref(worldSlug, ref)}${query}`);
        return;
      }
      if (refsEqual(ref, primary.ref) || avecRefs.some((r) => refsEqual(r, ref))) {
        setFocusedId(refId(ref));
        return;
      }
      updateAvecParam([...avecRefs, ref]);
      setFocusedId(refId(ref));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primary, avecRefsKey, worldSlug]
  );

  function closeWindow(ref: WindowRef) {
    if (primary && refsEqual(ref, primary.ref)) {
      // Fermer la primaire revient a l'accueil de sa section, sans perdre
      // les autres fenetres deja ouvertes.
      const query = avecRefs.length > 0 ? `?avec=${encodeURIComponent(serializeAvecParam(avecRefs))}` : "";
      router.push(`${sectionHomeHref(worldSlug, ref.kind)}${query}`);
      return;
    }
    updateAvecParam(avecRefs.filter((r) => !refsEqual(r, ref)));
  }

  function updateGeometry(ref: WindowRef, updates: Partial<WindowGeometry>) {
    const id = refId(ref);
    setGeometries((prev) => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  }

  const avecWindows: AvecWindowEntry[] = [];
  for (const ref of avecRefs) {
    const id = refId(ref);
    const geometry = geometries[id];
    if (!geometry) continue;
    avecWindows.push({ ref, geometry, isFocused: focusedId === id, data: avecData[id] });
  }

  const state: DesktopWindowsState = {
    primary,
    primaryGeometry: primary ? geometries[refId(primary.ref)] : undefined,
    isPrimaryFocused: primary ? focusedId === refId(primary.ref) : false,
    avecWindows,
    focusWindow: setFocusedId,
    closeWindow,
    updateGeometry,
  };

  return (
    <DesktopContext.Provider value={{ openRef, registerPrimary }}>
      <DesktopWindowsStateContext.Provider value={state}>{children}</DesktopWindowsStateContext.Provider>
    </DesktopContext.Provider>
  );
}

// Contexte separe de `DesktopContext` (actions stables) : l'etat de rendu
// change a chaque frappe/glissement, seuls les composants qui affichent
// les fenetres (WindowsDesktop) doivent re-rendre quand il change.
const DesktopWindowsStateContext = createContext<DesktopWindowsState | null>(null);

export function useDesktopWindowsState(): DesktopWindowsState | null {
  return useContext(DesktopWindowsStateContext);
}
