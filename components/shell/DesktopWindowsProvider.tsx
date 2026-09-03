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
  windowContentLabel,
  windowHref,
  type WindowRef,
} from "./windowRefs";
import type { EntityWindowData } from "@/src/server/services/entityWindow";
import type { RuleEntryDetail } from "@/src/server/services/rules";
import type { MjToolWindowData } from "./mjToolWindows";

const DEFAULT_WIDTH = 860;
const DEFAULT_HEIGHT = 760;

function defaultGeometry(index: number): WindowGeometry {
  const offset = (index % 6) * 28;
  return { x: 40 + offset, y: 24 + offset, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, isMaximized: false };
}

function windowDataUrl(worldSlug: string, ref: WindowRef): string {
  if (ref.kind === "entity") return `/api/worlds/${worldSlug}/entities/${ref.key}/window`;
  if (ref.kind === "rule") return `/api/worlds/${worldSlug}/regles/${ref.key}/window`;
  return `/api/worlds/${worldSlug}/mj/${ref.key}/window`;
}

export interface AvecWindowEntry {
  ref: WindowRef;
  geometry: WindowGeometry;
  isFocused: boolean;
  isMinimized: boolean;
  data: EntityWindowData | RuleEntryDetail | MjToolWindowData | undefined;
}

/** Un onglet reduit en bas de l'espace de travail (V2-K4). */
export interface MinimizedTab {
  id: string;
  ref: WindowRef;
  name: string;
  badge: string | null;
}

export interface DesktopWindowsState {
  primary: PrimaryWindowInfo | null;
  primaryGeometry: WindowGeometry | undefined;
  isPrimaryFocused: boolean;
  isPrimaryMinimized: boolean;
  avecWindows: AvecWindowEntry[];
  minimizedTabs: MinimizedTab[];
  focusWindow: (id: string) => void;
  closeWindow: (ref: WindowRef) => void;
  updateGeometry: (ref: WindowRef, updates: Partial<WindowGeometry>) => void;
  minimizeWindow: (ref: WindowRef) => void;
  restoreWindow: (ref: WindowRef) => void;
}

/**
 * Etat des fenetres flottantes (ADR-0011), partage par Monde, Regles ET MJ
 * (retour utilisateur, V2-M7 suite : "les fenetres des outils MJ [...]
 * comme celles des regles ou du wiki") : monte une seule fois dans
 * `app/m/[worldSlug]/layout.tsx`, au-dessus des trois sections. Chaque
 * section ne monte que le RENDU (`WindowsDesktop`), jamais un second etat —
 * changer de section ne ferme donc jamais les fenetres ouvertes, quel que
 * soit leur type.
 *
 * `?avec=` melange desormais entites, entrees de regle et outils MJ (`windowRefs.ts`).
 * Position/taille/empilement restent un etat purement client — jamais dans
 * l'URL, pour ne pas polluer l'historique de navigation.
 *
 * Ouvrir/fermer une fenetre secondaire (`avec`) ne change JAMAIS le contenu
 * de la page courante : son contenu vient de `windowDataUrl` (fetch client
 * separe, ci-dessous), jamais du rendu serveur de la primaire. Faire passer
 * ce changement par `router.replace` forcerait donc un aller-retour serveur
 * (re-rendu RSC complet de la page courante) pour un parametre que ce rendu
 * n'utilise meme pas — mesure comme un cout reel a l'usage. `avecParam` est
 * donc synchronise directement via `history.replaceState` (URL/historique
 * a jour, aucune requete), avec un `popstate` pour suivre precedent/suivant
 * du navigateur. Une vraie navigation (fermer la primaire, changer de
 * section) reste un `router.push` normal : la page de destination a un
 * contenu different, un aller-retour serveur y est necessaire.
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
  const [avecData, setAvecData] = useState<Record<string, EntityWindowData | RuleEntryDetail | MjToolWindowData>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Etat d'affichage purement local (V2-K4) — jamais dans `?avec=` ni dans
  // l'URL, meme logique que l'ordre d'empilement (docs/adr/0006).
  const [minimizedIds, setMinimizedIds] = useState<Record<string, boolean>>({});
  const [avecParam, setAvecParam] = useState<string | null>(() => searchParams.get("avec"));

  useEffect(() => {
    function onPopState() {
      setAvecParam(new URLSearchParams(window.location.search).get("avec"));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Resynchronise `avecParam` sur une VRAIE navigation (`router.push`, ex.
  // `SectionToggle` repliant la primaire courante dans `avec` en changeant
  // de section) — bug reel trouve en testant le repli MJ<->Monde<->Regles :
  // `avecParam` ne suivait que son propre `history.replaceState` (ci-dessus
  // et `updateAvecParam`) et le `popstate` manuel, jamais une navigation
  // Next normale, qui ne declenche ni l'un ni l'autre. Sans cet effet, la
  // fenetre primaire repliee dans `avec` par `hrefWithWindows` disparaissait
  // purement et simplement au premier changement de section. `searchParams`
  // (le hook Next, pas l'URL brute) ne change JAMAIS suite a un
  // `history.replaceState` local — seulement sur une vraie navigation —
  // donc cet effet ne rentre jamais en conflit avec les mises a jour
  // locales d'`avecParam` ci-dessus.
  useEffect(() => {
    const fresh = searchParams.get("avec");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronise avec une source externe (l'URL via le routeur Next), exactement le cas documente comme legitime ; le garde `prev === fresh` empeche toute boucle
    setAvecParam((prev) => (prev === fresh ? prev : fresh));
  }, [searchParams]);

  const avecRefs = parseAvecParam(avecParam).filter((ref) => !primary || !refsEqual(ref, primary.ref));
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
      // Un formulaire de creation de regle (`rule-tool`) n'a rien a lire en
      // base — jamais de fetch pour ce type, `RuleToolWindowContent` se
      // suffit du seul `worldSlug` deja connu.
      if (ref.kind === "rule-tool") return;
      const id = refId(ref);
      if (fetchedRef.current.has(id)) return;
      fetchedRef.current.add(id);
      fetch(windowDataUrl(worldSlug, ref))
        .then((res) => (res.ok ? res.json() : null))
        .then((data: EntityWindowData | RuleEntryDetail | MjToolWindowData | null) => {
          if (data) setAvecData((prev) => ({ ...prev, [id]: data }));
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avecRefsKey, worldSlug]);

  function updateAvecParam(nextRefs: WindowRef[]) {
    const params = new URLSearchParams(searchParams);
    const next = nextRefs.length > 0 ? nextRefs.map(refId).join(",") : null;
    if (next) {
      params.set("avec", next);
    } else {
      params.delete("avec");
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    setAvecParam(next);
  }

  const openRef = useCallback(
    (ref: WindowRef) => {
      if (!primary) {
        // Aucune fenetre primaire, mais d'autres fenetres peuvent deja
        // etre ouvertes (`?avec=`, ex. depuis l'accueil d'une section) —
        // la nouvelle fenetre devient primaire SANS les fermer.
        const remaining = avecRefs.filter((r) => !refsEqual(r, ref));
        const query = remaining.length > 0 ? `?avec=${encodeURIComponent(serializeAvecParam(remaining))}` : "";
        setAvecParam(remaining.length > 0 ? remaining.map(refId).join(",") : null);
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

  function clearMinimized(id: string) {
    setMinimizedIds((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function closeWindow(ref: WindowRef) {
    clearMinimized(refId(ref));
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

  function minimizeWindow(ref: WindowRef) {
    setMinimizedIds((prev) => ({ ...prev, [refId(ref)]: true }));
  }

  function restoreWindow(ref: WindowRef) {
    const id = refId(ref);
    setMinimizedIds((prev) => (prev[id] ? { ...prev, [id]: false } : prev));
    setFocusedId(id);
  }

  const avecWindows: AvecWindowEntry[] = [];
  const minimizedTabs: MinimizedTab[] = [];
  for (const ref of avecRefs) {
    const id = refId(ref);
    const geometry = geometries[id];
    if (!geometry) continue;
    const isMinimized = Boolean(minimizedIds[id]);
    avecWindows.push({ ref, geometry, isFocused: focusedId === id, isMinimized, data: avecData[id] });
    if (isMinimized) {
      const { name, badge } = windowContentLabel(ref, avecData[id]);
      minimizedTabs.push({ id, ref, name, badge });
    }
  }
  if (primary && minimizedIds[refId(primary.ref)]) {
    minimizedTabs.unshift({ id: refId(primary.ref), ref: primary.ref, name: primary.name, badge: primary.badge });
  }

  const state: DesktopWindowsState = {
    primary,
    primaryGeometry: primary ? geometries[refId(primary.ref)] : undefined,
    isPrimaryFocused: primary ? focusedId === refId(primary.ref) : false,
    isPrimaryMinimized: primary ? Boolean(minimizedIds[refId(primary.ref)]) : false,
    avecWindows,
    minimizedTabs,
    focusWindow: setFocusedId,
    closeWindow,
    updateGeometry,
    minimizeWindow,
    restoreWindow,
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
