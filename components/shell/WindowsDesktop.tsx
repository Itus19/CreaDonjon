"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import WindowFrame from "./WindowFrame";
import Panel from "./Panel";
import { useDesktop } from "./DesktopContext";
import { useDesktopWindowsState } from "./DesktopWindowsProvider";
import { refId, windowContentLabel, type WindowRef } from "./windowRefs";
import EditEntityForm from "@/app/m/[worldSlug]/(monde)/f/[entitySlug]/EditEntityForm";
import RuleEntryView from "@/components/rules/RuleEntryView";
import MjToolWindowContent from "./MjToolWindowContent";
import type { EntityWindowData } from "@/src/server/services/entityWindow";
import { isMjToolWindowData } from "./mjToolWindows";

const MOBILE_BREAKPOINT = 768;

function isEntityWindowData(data: unknown): data is EntityWindowData {
  return !!data && typeof data === "object" && "entity" in data;
}

/**
 * Rendu des fenetres flottantes (ADR-0011) : monte a la fois par Monde, par
 * Regles ET par MJ, chacun avec `children` = son propre contenu route
 * (rendu serveur pour la fenetre primaire). L'etat vient de
 * `DesktopWindowsProvider`, partage entre les trois sections — une fenetre
 * ouverte depuis l'une reste visible dans les autres.
 */
export default function WindowsDesktop({ worldSlug, children }: { worldSlug: string; children: React.ReactNode }) {
  const desktop = useDesktop();
  const state = useDesktopWindowsState();
  const desktopRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  // Sous-titre de fenetre (retour utilisateur : "certaines choses sont en
  // anglais") — `badge` vient directement de `entity_kind`/`entryType`
  // (identifiants techniques anglais, CLAUDE.md §11), jamais affiches tels
  // quels. Distinct de `kindLabels` (pluriel, en-tetes de categorie de la
  // barre laterale) : un sous-titre de fenetre porte sur UNE fiche.
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
    <div ref={desktopRef} className="relative flex-1 overflow-hidden">
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

      {state.avecWindows
        .filter((w) => !w.isMinimized)
        .map(({ ref, geometry, isFocused, data }) => {
          const { name, badge } = windowContentLabel(ref, data);
          return (
            <WindowFrame
              key={refId(ref)}
              win={geometry}
              isFocused={isFocused}
              containerRef={desktopRef}
              title={name}
              subtitle={translateBadge(ref.kind, badge)}
              onFocus={() => state.focusWindow(refId(ref))}
              onClose={() => state.closeWindow(ref)}
              onMinimize={() => state.minimizeWindow(ref)}
              onUpdate={(updates) => state.updateGeometry(ref, updates)}
            >
              {!data ? (
                <p className="text-sm text-ink-muted">Chargement...</p>
              ) : isEntityWindowData(data) ? (
                <EditEntityForm
                  entity={data.entity}
                  worldSlug={data.worldSlug}
                  initialBlocks={data.blocks}
                  initialRelations={data.relations}
                  otherEntities={data.otherEntities}
                  worldCustomKinds={data.worldCustomKinds}
                  campaignId={data.campaignId}
                  initialIsPc={data.isPc}
                  campaignCharacterUserId={data.campaignCharacterUserId}
                  initialPortraitLayout={data.portraitLayout}
                />
              ) : isMjToolWindowData(data) ? (
                <MjToolWindowContent worldSlug={worldSlug} data={data} />
              ) : (
                <RuleEntryView entry={data} worldSlug={worldSlug} />
              )}
            </WindowFrame>
          );
        })}

      {state.minimizedTabs.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-40 flex flex-wrap items-center gap-2 border-t border-edge bg-panel-sunken/95 p-2 backdrop-blur-[var(--blur)]">
          {state.minimizedTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => state.restoreWindow(tab.ref)}
              title="Restaurer"
              className="flex items-center gap-1.5 rounded-md border border-edge bg-panel-raised px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
            >
              <span className="max-w-[160px] truncate">{tab.name}</span>
              {tab.badge && (
                <span className="shrink-0 text-[10px] text-ink-muted">{translateBadge(tab.ref.kind, tab.badge)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
