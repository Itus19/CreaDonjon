"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import WindowFrame from "./WindowFrame";
import { useDesktopWindowsState } from "./DesktopWindowsProvider";
import { refId, windowContentLabel, type WindowRef } from "./windowRefs";
import EditEntityForm from "@/app/m/[worldSlug]/(monde)/f/[entitySlug]/EditEntityForm";
import RuleEntryView from "@/components/rules/RuleEntryView";
import MjToolWindowContent from "./MjToolWindowContent";
import RuleToolWindowContent from "./RuleToolWindowContent";
import type { EntityWindowData } from "@/src/server/services/entityWindow";
import { isMjToolWindowData } from "./mjToolWindows";

const MOBILE_BREAKPOINT = 768;
/** Memes constantes que Sidebar.tsx/RulesSidebar.tsx/MjSidebar.tsx (`w-[280px]`) et AppShell.tsx (en-tete `h-14`). */
const SIDEBAR_WIDTH_PX = 280;

function isEntityWindowData(data: unknown): data is EntityWindowData {
  return !!data && typeof data === "object" && "entity" in data;
}

/**
 * Fenetres SECONDAIRES (`avec`) + barre d'onglets reduits — montees UNE
 * SEULE FOIS ici (`app/m/[worldSlug]/layout.tsx`), au-dessus des trois
 * sections. Contrairement a la fenetre PRIMAIRE (`WindowsDesktop.tsx`, qui
 * reste montee par section puisqu'elle affiche `{children}`, different par
 * route), une fenetre secondaire n'a aucune raison de dependre de la
 * section active — `DesktopWindowsProvider` le dit deja lui-meme ("une
 * fenetre ouverte depuis l'une reste visible dans les autres").
 *
 * Cause reelle du "rechargement inutile" (audit de performance, retour
 * utilisateur) : avant cette scission, `WindowsDesktop` (primaire ET
 * secondaires ensemble) etait instancie separement dans MondeShell.tsx/
 * regles/layout.tsx/mj/layout.tsx — changer de section demontait tout
 * l'arbre React des fenetres secondaires, meme si `avecData` restait en
 * cache cote `DesktopWindowsProvider` (state, jamais rendu) : chaque bloc
 * (`RelationsChips`, resolution de references, fiche de personnage,
 * portrait) repartait de zero au remontage. Mesure en direct : 8.3s et une
 * trentaine de requetes redondantes pour 6 fenetres ouvertes, certaines
 * refaites jusqu'a 8 fois pour la meme entite. Montees ici, une fois pour
 * toute la session Monde/Regles/MJ, elles ne se demontent plus au
 * changement de section — seul un vrai `closeWindow` les retire.
 *
 * Position fixe plutot qu'un flex-child (retour utilisateur : garder
 * EXACTEMENT le meme perimetre de glisser qu'avant, jamais par-dessus la
 * sidebar, plutot que la solution plus simple qui l'aurait autorise) : ce
 * composant ne peut plus vivre a cote de la barre laterale (qui, elle,
 * reste par section) dans le MEME conteneur flex — `left-[280px]`
 * reproduit la largeur qu'occupait la sidebar dans ce flex, `top-14`
 * l'en-tete. `pointer-events-none` sur le conteneur (rien a cliquer entre
 * les fenetres, l'espace vide doit laisser passer les clics vers la
 * fenetre primaire dessous) ; chaque fenetre repasse en `pointer-events-auto`.
 * Jamais rendu sur mobile (meme garde que `WindowsDesktop.tsx` — aucune
 * fenetre flottante n'y existe, la sidebar y devient un tiroir plein ecran).
 */
export default function AvecWindowsLayer({ worldSlug }: { worldSlug: string }) {
  const state = useDesktopWindowsState();
  const desktopRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
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

  if (!state || isMobile) return null;

  return (
    <div
      ref={desktopRef}
      className="pointer-events-none fixed top-14 right-0 bottom-0"
      // Meme raisonnement que le z-index dynamique de `WindowsDesktop.tsx`
      // (voir son commentaire) : ce conteneur et le sien sont deux piles
      // d'empilement distinctes (l'un `position: fixed`, l'autre non) —
      // sans ceci, une fenetre secondaire passait TOUJOURS devant la
      // primaire, meme quand celle-ci avait le focus.
      style={{ left: SIDEBAR_WIDTH_PX, zIndex: state.isPrimaryFocused ? 10 : 50 }}
    >
      {state.avecWindows
        .filter((w) => !w.isMinimized)
        .map(({ ref, geometry, isFocused, data }) => {
          const { name, badge } = windowContentLabel(ref, data);
          return (
            <div key={refId(ref)} className="pointer-events-auto">
              <WindowFrame
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
                {ref.kind === "rule-tool" ? (
                  <RuleToolWindowContent worldSlug={worldSlug} toolKey={ref.key} />
                ) : !data ? (
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
            </div>
          );
        })}

      {state.minimizedTabs.length > 0 && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 border-t border-edge bg-panel-sunken/95 p-2 backdrop-blur-[var(--blur)]">
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
