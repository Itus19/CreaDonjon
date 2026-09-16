"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import WindowFrame from "./WindowFrame";
import Panel from "./Panel";
import { useDesktop } from "./DesktopContext";
import { MINIMIZED_BAR_HEIGHT_PX, useDesktopWindowsState } from "./DesktopWindowsProvider";
import { refId, type WindowRef } from "./windowRefs";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";

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
  const isMobile = useMatchMedia(WINDOWS_MOBILE_QUERY);
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

  if (!desktop || !state) return <>{children}</>;

  if (isMobile) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <Panel>{children}</Panel>
      </div>
    );
  }

  // V2.1-16 — la barre des fiches reduites (`AvecWindowsLayer.tsx`) est posee
  // en bas de l'ecran : la zone de travail se raccourcit d'autant tant qu'une
  // fiche y est rangee, pour qu'une fenetre maximisee s'arrete au-dessus
  // plutot que d'avoir son bas recouvert. Meme reserve des deux cotes — c'est
  // la meme barre qui surplombe les deux zones.
  const reserve = state.minimizedTabs.length > 0 ? MINIMIZED_BAR_HEIGHT_PX : 0;

  return (
    <div
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
      {/* Ce conteneur interne EST la zone de travail : c'est lui que la
          fenetre prend pour reference (`position: absolute`, donc bloc
          conteneur de ses enfants absolus), pour son `max-height` deduit
          comme pour les bornes du glisser. Un simple rembourrage sur le
          parent n'aurait rien borne du tout — une boite absolue se resout
          contre la boite de REMBOURRAGE de son ancetre, rembourrage inclus. */}
      <div ref={desktopRef} className="absolute inset-x-0 top-0" style={{ bottom: reserve }}>
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
    </div>
  );
}
