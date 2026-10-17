"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DesktopContext, type PrimaryWindowInfo } from "./DesktopContext";
import {
  parseAvecParam,
  refId,
  refsEqual,
  requeteFenetres,
  sectionHomeHref,
  serializeAvecParam,
  windowHref,
  type WindowRef,
} from "./windowRefs";
import {
  activer,
  deplacer,
  ecrireDisposition,
  fixerPartage as fixerPartageDisposition,
  lireDisposition,
  placer,
  retirer,
  type Disposition,
} from "@/lib/ui/volets";
import type { EntityWindowData } from "@/src/server/services/entityWindow";
import type { RuleEntryDetail } from "@/src/server/services/rules";
import type { MjToolWindowData } from "./mjToolWindows";

function windowDataUrl(worldSlug: string, ref: WindowRef): string {
  if (ref.kind === "entity") return `/api/worlds/${worldSlug}/entities/${ref.key}/window`;
  if (ref.kind === "rule") return `/api/worlds/${worldSlug}/regles/${ref.key}/window`;
  return `/api/worlds/${worldSlug}/mj/${ref.key}/window`;
}

export interface AvecWindowEntry {
  ref: WindowRef;
  data: EntityWindowData | RuleEntryDetail | MjToolWindowData | undefined;
}

export interface DesktopWindowsState {
  primary: PrimaryWindowInfo | null;
  /** Les fiches `?avec=` (hors primaire), avec leur donnée une fois chargée. */
  avecWindows: AvecWindowEntry[];
  /** La place des fiches ouvertes dans les volets (V3.1-20), dérivée de `?volets=` à chaque rendu. */
  disposition: Disposition;
  /** Le volet agrandi le temps de lire (état local, jamais dans l'adresse), sinon `null`. */
  voletAgrandi: number | null;
  /** La zone de travail que `WindowsDesktop` enregistre : la couche des volets s'y cale. */
  zone: HTMLElement | null;
  enregistrerZone: (el: HTMLElement | null) => void;
  /** Où la couche attend le contenu de la fiche primaire (portail de `WindowsDesktop`). */
  emplacementPrimaire: HTMLElement | null;
  enregistrerEmplacementPrimaire: (el: HTMLElement | null) => void;
  closeWindow: (ref: WindowRef) => void;
  activerOnglet: (id: string) => void;
  deplacerOnglet: (id: string, vers: 0 | 1) => void;
  fixerPartage: (pourcent: number) => void;
  basculerAgrandi: (volet: number) => void;
}

/**
 * Etat des fenetres du MJ (ADR-0011, ADR-0066), partage par Monde, Regles ET
 * MJ : monte une seule fois dans `app/m/[worldSlug]/layout.tsx`, au-dessus
 * des trois sections. Chaque section ne monte que sa zone de travail
 * (`WindowsDesktop`), jamais un second etat — changer de section ne ferme donc
 * jamais les fiches ouvertes, quel que soit leur type.
 *
 * Deux parametres d'adresse : `?avec=` (les fiches, entites, entrees de regle
 * et outils MJ melanges, `windowRefs.ts`) et `?volets=` (leur place dans les
 * volets, `lib/ui/volets.ts`). La disposition n'est JAMAIS stockee : elle se
 * derive a chaque rendu de `volets` et des fiches ouvertes, ce qui garde un
 * rechargement, un ancien lien ou une navigation coherents.
 *
 * Ouvrir/fermer/ranger une fiche ne change JAMAIS le contenu de la page
 * courante : le contenu d'une fiche `avec` vient de `windowDataUrl` (fetch
 * client separe), jamais du rendu serveur de la primaire. Passer par
 * `router.replace` forcerait un aller-retour serveur pour des parametres que
 * ce rendu n'utilise meme pas. Les deux parametres sont donc ecrits ENSEMBLE,
 * dans une seule URL, par `history.replaceState` (aucune requete), avec un
 * `popstate` pour suivre precedent/suivant. Une vraie navigation (fermer la
 * primaire, changer de section) reste un `router.push` normal.
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
  const [avecData, setAvecData] = useState<Record<string, EntityWindowData | RuleEntryDetail | MjToolWindowData>>({});
  const [avecParam, setAvecParam] = useState<string | null>(() => searchParams.get("avec"));
  const [voletsParam, setVoletsParam] = useState<string | null>(() => searchParams.get("volets"));
  const [voletAgrandi, setVoletAgrandi] = useState<number | null>(null);
  const [zone, setZone] = useState<HTMLElement | null>(null);
  const [emplacementPrimaire, setEmplacementPrimaire] = useState<HTMLElement | null>(null);

  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      setAvecParam(params.get("avec"));
      setVoletsParam(params.get("volets"));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Resynchronise `avec` et `volets` sur une VRAIE navigation (`router.push`,
  // ex. `SectionToggle` repliant la primaire courante dans `avec` en changeant
  // de section) : l'etat local ne suivait que ses propres `replaceState` et le
  // `popstate`, jamais une navigation Next normale. Sans cet effet, la fiche
  // primaire repliee par `requeteFenetres` disparaissait au premier changement
  // de section. Les gardes `prev === fresh` empechent toute boucle.
  useEffect(() => {
    const freshAvec = searchParams.get("avec");
    const freshVolets = searchParams.get("volets");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronise avec une source externe (l'URL via le routeur Next), cas documente comme legitime
    setAvecParam((prev) => (prev === freshAvec ? prev : freshAvec));
    setVoletsParam((prev) => (prev === freshVolets ? prev : freshVolets));
  }, [searchParams]);

  const avecRefs = parseAvecParam(avecParam).filter((ref) => !primary || !refsEqual(ref, primary.ref));
  const avecRefsKey = avecRefs.map(refId).join(",");
  const ids = [...(primary ? [refId(primary.ref)] : []), ...avecRefs.map(refId)];
  const disposition = lireDisposition(voletsParam, ids);

  // Un volet agrandi n'a de sens qu'a deux volets : le rendre quand il n'en
  // reste qu'un (ajustement d'etat pendant le rendu, motif documente par React).
  if (voletAgrandi !== null && disposition.volets.length < 2) setVoletAgrandi(null);

  // Pre-alimente `avecData`/`fetchedRef` avec la donnee que la fiche
  // primaire a deja rendue cote serveur (audit de performance) : sans ceci,
  // une fiche repliee en `avec` par un changement de section se refetchait a
  // vide en affichant "Chargement..." pour une fiche pourtant deja affichee.
  const registerPrimary = useCallback((info: PrimaryWindowInfo | null) => {
    setPrimary(info);
    if (info && info.data !== undefined) {
      const id = refId(info.ref);
      fetchedRef.current.add(id);
      setAvecData((prev) => (prev[id] === info.data ? prev : { ...prev, [id]: info.data! }));
    }
  }, []);

  // Recupere les donnees de chaque fiche `?avec=` pas encore chargee.
  useEffect(() => {
    avecRefs.forEach((ref) => {
      // Un formulaire de creation de regle (`rule-tool`) n'a rien a lire en
      // base — jamais de fetch pour ce type.
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

  /** Ecrit `avec` ET `volets` dans une seule URL, sans aller-retour serveur. */
  function ecrireFenetres(nextAvec: WindowRef[], nextDispo: Disposition) {
    const params = new URLSearchParams(window.location.search);
    const avec = nextAvec.length > 0 ? serializeAvecParam(nextAvec) : null;
    const volets = ecrireDisposition(nextDispo);
    if (avec) params.set("avec", avec);
    else params.delete("avec");
    if (volets) params.set("volets", volets);
    else params.delete("volets");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    setAvecParam(avec);
    setVoletsParam(volets);
  }

  /** Une disposition qui ne change que la place des fiches : rien a ecrire si elle est deja celle de l'adresse. */
  function ecrireDispo(next: Disposition) {
    if (ecrireDisposition(next) === ecrireDisposition(disposition)) return;
    ecrireFenetres(avecRefs, next);
  }

  const openRef = useCallback(
    (ref: WindowRef) => {
      const id = refId(ref);
      if (!primary) {
        // Aucune fiche primaire, mais d'autres fiches peuvent deja etre
        // ouvertes (`?avec=`, ex. depuis l'accueil d'une section) — la
        // nouvelle devient primaire SANS les fermer, et prend sa place dans
        // les volets.
        const remaining = avecRefs.filter((r) => !refsEqual(r, ref));
        const next = placer(disposition, id);
        setAvecParam(remaining.length > 0 ? serializeAvecParam(remaining) : null);
        setVoletsParam(remaining.length > 0 ? ecrireDisposition(next) : null);
        router.push(`${windowHref(worldSlug, ref)}${requeteFenetres(remaining, next)}`);
        return;
      }
      if (refsEqual(ref, primary.ref) || avecRefs.some((r) => refsEqual(r, ref))) {
        // Deja ouverte : elle redevient l'onglet actif de son volet.
        const next = activer(disposition, id);
        if (ecrireDisposition(next) !== ecrireDisposition(disposition)) ecrireFenetres(avecRefs, next);
        return;
      }
      ecrireFenetres([...avecRefs, ref], placer(disposition, id));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primary, avecRefsKey, voletsParam, worldSlug]
  );

  function closeWindow(ref: WindowRef) {
    const next = retirer(disposition, refId(ref));
    if (primary && refsEqual(ref, primary.ref)) {
      // Fermer la primaire revient a l'accueil de sa section, sans perdre
      // les autres fiches deja ouvertes ni leur place.
      router.push(`${sectionHomeHref(worldSlug, ref.kind)}${requeteFenetres(avecRefs, next)}`);
      return;
    }
    ecrireFenetres(
      avecRefs.filter((r) => !refsEqual(r, ref)),
      next
    );
  }

  const avecWindows: AvecWindowEntry[] = avecRefs.map((ref) => ({ ref, data: avecData[refId(ref)] }));

  const state: DesktopWindowsState = {
    primary,
    avecWindows,
    disposition,
    voletAgrandi,
    zone,
    enregistrerZone: setZone,
    emplacementPrimaire,
    enregistrerEmplacementPrimaire: setEmplacementPrimaire,
    closeWindow,
    activerOnglet: (id) => ecrireDispo(activer(disposition, id)),
    deplacerOnglet: (id, vers) => ecrireDispo(deplacer(disposition, id, vers)),
    fixerPartage: (pourcent) => ecrireDispo(fixerPartageDisposition(disposition, pourcent)),
    basculerAgrandi: (volet) => setVoletAgrandi((prev) => (prev === volet ? null : volet)),
  };

  return (
    <DesktopContext.Provider value={{ openRef, registerPrimary }}>
      <DesktopWindowsStateContext.Provider value={state}>{children}</DesktopWindowsStateContext.Provider>
    </DesktopContext.Provider>
  );
}

// Contexte separe de `DesktopContext` (actions stables) : l'etat de rendu
// change a chaque action, seuls les composants qui affichent les fenetres
// (WindowsDesktop, la couche des volets) doivent re-rendre quand il change.
const DesktopWindowsStateContext = createContext<DesktopWindowsState | null>(null);

export function useDesktopWindowsState(): DesktopWindowsState | null {
  return useContext(DesktopWindowsStateContext);
}
