"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import WindowFrame, { type WindowGeometry } from "./WindowFrame";
import Panel from "./Panel";
import { DesktopContext } from "./DesktopContext";
import EditEntityForm from "@/app/m/[worldSlug]/(monde)/f/[entitySlug]/EditEntityForm";
import type { EntityWindowData } from "@/src/server/services/entityWindow";

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 600;
const MOBILE_BREAKPOINT = 768;

function defaultGeometry(index: number): WindowGeometry {
  const offset = (index % 6) * 28;
  return { x: 40 + offset, y: 24 + offset, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, isMaximized: false };
}

function parseAvecParam(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").filter((s) => s.length > 0);
}

/**
 * Fenetres flottantes avec URL (ADR-0006). La fiche primaire (routee sur
 * `/m/[monde]/f/[fiche]`) s'enregistre elle-meme via `registerPrimary` —
 * son contenu est deja `children`, rendu serveur. Les fiches ouvertes en
 * plus vivent dans `?avec=slug1,slug2`, recuperees ici cote client.
 * Position/taille/empilement restent un etat local : jamais dans l'URL.
 */
export default function DesktopWindows({
  worldSlug,
  sidebar,
  children,
}: {
  worldSlug: string;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const desktopRef = useRef<HTMLDivElement>(null);
  const fetchedSlugsRef = useRef<Set<string>>(new Set());

  const [isMobile, setIsMobile] = useState(false);
  const [primary, setPrimary] = useState<{ slug: string; name: string; kind: string } | null>(null);
  const [geometries, setGeometries] = useState<Record<string, WindowGeometry>>({});
  const [avecData, setAvecData] = useState<Record<string, EntityWindowData>>({});
  const [focusedSlug, setFocusedSlug] = useState<string | null>(null);

  const avecSlugs = parseAvecParam(searchParams.get("avec")).filter((s) => s !== primary?.slug);
  const avecSlugsKey = avecSlugs.join(",");
  const activeSlugs = primary ? [primary.slug, ...avecSlugs] : avecSlugs;
  const activeSlugsKey = activeSlugs.join(",");

  useEffect(() => {
    function checkWidth() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  const registerPrimary = useCallback((info: { slug: string; name: string; kind: string } | null) => {
    setPrimary(info);
    if (info) setFocusedSlug(info.slug);
  }, []);

  // Assigne une position par defaut a toute fenetre nouvellement visible,
  // sans jamais reinitialiser une fenetre deja ouverte. Ajustement d'etat
  // pendant le rendu (motif documente par React pour reagir a un calcul
  // qui change), pas dans un effet : setGeometries n'est jamais appele au
  // sommet d'un useEffect.
  const [lastSlugsKey, setLastSlugsKey] = useState<string | null>(null);
  if (lastSlugsKey !== activeSlugsKey) {
    setLastSlugsKey(activeSlugsKey);
    const missing = activeSlugs.filter((slug) => !geometries[slug]);
    if (missing.length > 0) {
      setGeometries((prev) => {
        const next = { ...prev };
        missing.forEach((slug, index) => {
          next[slug] = defaultGeometry(Object.keys(prev).length + index);
        });
        return next;
      });
    }
  }

  // Recupere les donnees de chaque fenetre `?avec=` pas encore chargee.
  // `fetchedSlugsRef` evite de relancer une requete deja en cours/faite ;
  // le seul appel a setState du corps de l'effet est dans le .then(),
  // jamais synchrone en tete d'effet.
  useEffect(() => {
    avecSlugs.forEach((slug) => {
      if (fetchedSlugsRef.current.has(slug)) return;
      fetchedSlugsRef.current.add(slug);
      fetch(`/api/worlds/${worldSlug}/entities/${slug}/window`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: EntityWindowData | null) => {
          if (data) setAvecData((prev) => ({ ...prev, [slug]: data }));
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avecSlugsKey, worldSlug]);

  function updateAvecParam(nextSlugs: string[]) {
    const params = new URLSearchParams(searchParams);
    if (nextSlugs.length > 0) {
      params.set("avec", nextSlugs.join(","));
    } else {
      params.delete("avec");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const openEntity = useCallback(
    (slug: string) => {
      if (!primary) {
        router.push(`/m/${worldSlug}/f/${slug}`);
        return;
      }
      if (slug === primary.slug || avecSlugs.includes(slug)) {
        setFocusedSlug(slug);
        return;
      }
      updateAvecParam([...avecSlugs, slug]);
      setFocusedSlug(slug);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primary?.slug, avecSlugsKey, worldSlug]
  );

  function closeWindow(slug: string) {
    if (slug === primary?.slug) {
      router.push(`/m/${worldSlug}`);
      return;
    }
    updateAvecParam(avecSlugs.filter((s) => s !== slug));
  }

  function updateGeometry(slug: string, updates: Partial<WindowGeometry>) {
    setGeometries((prev) => ({ ...prev, [slug]: { ...prev[slug], ...updates } }));
  }

  const contextValue = { openEntity, registerPrimary };

  if (isMobile) {
    return (
      <DesktopContext.Provider value={contextValue}>
        {sidebar}
        <div className="flex-1 overflow-y-auto p-4">
          <Panel>{children}</Panel>
        </div>
      </DesktopContext.Provider>
    );
  }

  return (
    <DesktopContext.Provider value={contextValue}>
      {sidebar}
      <div ref={desktopRef} className="relative flex-1 overflow-hidden">
        {!primary && (
          <div className="h-full overflow-y-auto p-8">
            <Panel>{children}</Panel>
          </div>
        )}

        {primary && geometries[primary.slug] && (
          <WindowFrame
            win={geometries[primary.slug]}
            isFocused={focusedSlug === primary.slug}
            containerRef={desktopRef}
            title={primary.name}
            subtitle={primary.kind}
            onFocus={() => setFocusedSlug(primary.slug)}
            onClose={() => closeWindow(primary.slug)}
            onUpdate={(updates) => updateGeometry(primary.slug, updates)}
          >
            {children}
          </WindowFrame>
        )}

        {avecSlugs.map((slug) => {
          const data = avecData[slug];
          const geometry = geometries[slug];
          if (!geometry) return null;
          return (
            <WindowFrame
              key={slug}
              win={geometry}
              isFocused={focusedSlug === slug}
              containerRef={desktopRef}
              title={data ? data.entity.name : slug}
              subtitle={data ? data.entity.entity_kind : null}
              onFocus={() => setFocusedSlug(slug)}
              onClose={() => closeWindow(slug)}
              onUpdate={(updates) => updateGeometry(slug, updates)}
            >
              {!data ? (
                <p className="text-sm text-ink-muted">Chargement...</p>
              ) : (
                <EditEntityForm
                  entity={data.entity}
                  worldSlug={data.worldSlug}
                  initialBlocks={data.blocks}
                  initialRelations={data.relations}
                  otherEntities={data.otherEntities}
                />
              )}
            </WindowFrame>
          );
        })}
      </div>
    </DesktopContext.Provider>
  );
}
