"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import WindowFrame from "./WindowFrame";
import { MINIMIZED_BAR_HEIGHT_PX, useDesktopWindowsState } from "./DesktopWindowsProvider";
import { refId, windowContentLabel, type WindowRef } from "./windowRefs";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";
import type { EntityWindowData } from "@/src/server/services/entityWindow";
import { isMjToolWindowData } from "./mjToolWindows";

/**
 * V3-R1 — les quatre contenus de fenetre sont charges a la demande, jamais
 * dans le paquet initial.
 *
 * Ce composant est monte sur CHAQUE page de monde (`app/m/[worldSlug]/
 * layout.tsx`), et il rend `null` sous 768 px. Importes statiquement, ces
 * quatre-la tiraient 332 fichiers / 55 498 lignes — Tiptap, `@dnd-kit`,
 * `d3-force`, les dix panneaux MJ, les quatre formulaires maison — sur
 * toutes les routes du monde, y compris celles qui n'ouvrent aucune
 * fenetre, et y compris sur telephone ou rien de tout cela ne s'affiche.
 *
 * `ssr: false` ne perd rien : `avecData` part vide dans
 * `DesktopWindowsProvider` et n'est remplie que par effet, donc AUCUN de
 * ces quatre composants n'a jamais ete rendu cote serveur — le premier
 * rendu affichait deja la branche `!data` ("Chargement...") ci-dessous.
 *
 * Rien ne change pour l'utilisateur : le morceau part au moment ou une
 * fenetre s'ouvre, pas au chargement de la page, et le meme texte de
 * chargement qu'auparavant occupe l'intervalle.
 */
const LOADING = () => <p className="text-sm text-ink-muted">Chargement...</p>;

const EditEntityForm = dynamic(() => import("@/app/m/[worldSlug]/(monde)/f/[entitySlug]/EditEntityForm"), {
  ssr: false,
  loading: LOADING,
});
const RuleEntryView = dynamic(() => import("@/components/rules/RuleEntryView"), { ssr: false, loading: LOADING });
const MjToolWindowContent = dynamic(() => import("./MjToolWindowContent"), { ssr: false, loading: LOADING });
const RuleToolWindowContent = dynamic(() => import("./RuleToolWindowContent"), { ssr: false, loading: LOADING });
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
  const isMobile = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const tShell = useTranslations("shell");
  const tRegles = useTranslations("regles");
  const entityKindLabels = tShell.raw("kindLabelsSingular") as Record<string, string>;
  const entryTypeLabels = tRegles.raw("entryTypes") as Record<string, string>;
  function translateBadge(kind: WindowRef["kind"], raw: string | null): string | null {
    if (!raw) return raw;
    return (kind === "entity" ? entityKindLabels[raw] : entryTypeLabels[raw]) ?? raw;
  }

  if (!state || isMobile) return null;

  // Meme reserve que la zone primaire (`WindowsDesktop.tsx`) : la barre des
  // fiches reduites ci-dessous raccourcit la zone de travail au lieu de se
  // poser par-dessus (V2.1-16).
  const reserve = state.minimizedTabs.length > 0 ? MINIMIZED_BAR_HEIGHT_PX : 0;

  return (
    <div
      className="pointer-events-none fixed top-14 right-0 bottom-0"
      // Meme raisonnement que le z-index dynamique de `WindowsDesktop.tsx`
      // (voir son commentaire) : ce conteneur et le sien sont deux piles
      // d'empilement distinctes (l'un `position: fixed`, l'autre non) —
      // sans ceci, une fenetre secondaire passait TOUJOURS devant la
      // primaire, meme quand celle-ci avait le focus.
      style={{ left: SIDEBAR_WIDTH_PX, zIndex: state.isPrimaryFocused ? 10 : 50 }}
    >
      {/* Conteneur interne = la zone de travail reellement disponible, celle
          que les fenetres prennent pour reference (bornes du glisser et
          `max-height` deduit). La barre des onglets reduits reste, elle,
          collee au bas de la couche. */}
      <div ref={desktopRef} className="absolute inset-x-0 top-0" style={{ bottom: reserve }}>
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
      </div>

      {state.minimizedTabs.length > 0 && (
        // Hauteur constante (`MINIMIZED_BAR_HEIGHT_PX`) et rangee unique qui
        // defile en largeur, au lieu du retour a la ligne d'avant : c'est ce
        // qui permet aux deux zones de travail de reserver sa place sans
        // avoir a la mesurer (V2.1-16).
        <div
          className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-center gap-2 overflow-x-auto border-t border-edge bg-panel-sunken/95 px-2 backdrop-blur-[var(--blur)]"
          style={{ height: MINIMIZED_BAR_HEIGHT_PX }}
        >
          {state.minimizedTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => state.restoreWindow(tab.ref)}
              title="Restaurer"
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-edge bg-panel-raised px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
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
