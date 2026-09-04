"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import WindowFrame from "./WindowFrame";
import Panel from "./Panel";
import { useDesktop } from "./DesktopContext";
import { useDesktopWindowsState } from "./DesktopWindowsProvider";
import { refId, type WindowRef } from "./windowRefs";

const MOBILE_BREAKPOINT = 768;

/**
 * Rendu de la fenetre PRIMAIRE (ADR-0011) : monte a la fois par Monde, par
 * Regles ET par MJ, chacun avec `children` = son propre contenu route
 * (rendu serveur pour la fenetre primaire) — reste par section, contrairement
 * aux fenetres SECONDAIRES (`avec`, `AvecWindowsLayer.tsx`, montees une
 * seule fois au-dessus des trois sections depuis V2, audit de performance :
 * `{children}` differe par route, la fenetre primaire ne peut pas etre
 * partagee de la meme facon).
 */
export default function WindowsDesktop({ children }: { children: React.ReactNode }) {
  const desktop = useDesktop();
  const state = useDesktopWindowsState();
  const desktopRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  // Sous-titre de fenetre (retour utilisateur : "certaines choses sont en
  // anglais") — `badge` vient directement de `entity_kind`/`entryType`
  // (identifiants techniques anglais, CLAUDE.md §11), jamais affiches tels
  // quels.
  const tShell = useTranslations("shell");
  const tRegles = useTranslations("regles");
  const entityKindLabels = tShell.raw("kindLabelsSingular") as Record<string, string>;
  const entryTypeLabels = tRegles.raw("entryTypes") as Record<string, string>;
  function translateBadge(kind: WindowRef["kind"], raw: string | null): string | null {
    if (!raw) return raw;
    return (kind === "entity" ? entityKindLabels[raw] : entryTypeLabels[raw]) ?? raw;
  }

  useEffect(() => {
    function checkWidth() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  if (!desktop || !state) return <>{children}</>;

  if (isMobile) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <Panel>{children}</Panel>
      </div>
    );
  }

  return (
    <div
      ref={desktopRef}
      className="relative flex-1 overflow-hidden"
      // `AvecWindowsLayer.tsx` vit desormais dans une AUTRE pile
      // d'empilement (son propre conteneur `position: fixed`) — le z-index
      // 20/30 de `WindowFrame` ne se compare plus qu'A L'INTERIEUR de
      // chaque pile, jamais entre les deux (retour utilisateur : la fenetre
      // primaire, meme "focus" (z-index 30 la-dedans), restait cachee sous
      // les secondaires). Ce conteneur porte donc lui-meme un z-index,
      // compare cette fois au niveau racine contre celui d'`AvecWindowsLayer` —
      // le plus haut des deux gagne selon qui a reellement le focus.
      style={{ zIndex: state.isPrimaryFocused ? 50 : 10 }}
    >
      {!state.primary && (
        <div className="h-full overflow-y-auto p-8">
          <Panel>{children}</Panel>
        </div>
      )}

      {state.primary && state.primaryGeometry && (
        state.isPrimaryMinimized ? (
          // La fiche primaire reste montee (masquee, pas retiree) : c'est
          // elle qui porte `RegisterPrimaryWindow` — la demonter perdrait
          // l'enregistrement et l'onglet reduit avec (V2-K4).
          <div className="hidden">{children}</div>
        ) : (
          <WindowFrame
            win={state.primaryGeometry}
            isFocused={state.isPrimaryFocused}
            containerRef={desktopRef}
            title={state.primary.name}
            subtitle={translateBadge(state.primary.ref.kind, state.primary.badge)}
            onFocus={() => state.focusWindow(refId(state.primary!.ref))}
            onClose={() => state.closeWindow(state.primary!.ref)}
            onMinimize={() => state.minimizeWindow(state.primary!.ref)}
            onUpdate={(updates) => state.updateGeometry(state.primary!.ref, updates)}
          >
            {children}
          </WindowFrame>
        )
      )}
    </div>
  );
}
