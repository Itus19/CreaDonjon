"use client";

import { useCallback } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Panel from "./Panel";
import { RESERVE_BARRE } from "./BarreFlottante";
import { useDesktop } from "./DesktopContext";
import { useDesktopWindowsState } from "./DesktopWindowsProvider";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";

/**
 * Zone de travail d'une section (ADR-0011, ADR-0066) : monte a la fois par
 * Monde, par Regles ET par MJ, chacun avec `children` = son propre contenu
 * route (rendu serveur). Elle ne dessine plus de fenetre : elle s'enregistre
 * aupres de l'etat (`enregistrerZone`) pour que la couche des volets
 * (`VoletsLayer.tsx`, montee une seule fois au-dessus des trois sections)
 * s'y cale, et, quand une fiche est routee, y envoie son contenu par un
 * portail React dans la boite de la fiche primaire.
 */
export default function WindowsDesktop({ children }: { children: React.ReactNode }) {
  const desktop = useDesktop();
  const pathname = usePathname();
  const state = useDesktopWindowsState();
  const isMobile = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const enregistrerZone = state?.enregistrerZone;
  const refZone = useCallback((el: HTMLDivElement | null) => enregistrerZone?.(el), [enregistrerZone]);

  if (!desktop || !state) return <>{children}</>;

  if (isMobile) {
    // V3.1-29 : la radio est passee dans la feuille « Outils » de la barre
    // flottante (`BarreTelephoneMj`, montee par `AppShell`) ; le bas du
    // contenu lui reserve sa place.
    return (
      // V3.1-30 : `pt-16` reserve la place du ☰ (fixe en haut a gauche), qui
      // mangeait le titre de la fiche. La section MJ n'a pas de ☰ (V3.1-29).
      <div className={`flex-1 overflow-y-auto px-4 pb-4 ${/^\/m\/[^/]+\/mj(\/|$)/.test(pathname) ? "pt-4" : "pt-16"} ${RESERVE_BARRE}`}>
        <Panel>{children}</Panel>
      </div>
    );
  }

  return (
    <div ref={refZone} className="relative flex-1 overflow-hidden">
      {/* Sans fiche primaire, la page routee est l'accueil de la section. S'il
          n'y a que des fiches `avec`, il reste rendu dessous : la couche des
          volets le recouvre. */}
      {!state.primary && (
        // Recouvert par les volets quand des fiches `avec` sont ouvertes :
        // masque, pour ne pas deborder dans l'ecart autour d'eux.
        <div className={`h-full overflow-y-auto p-8 ${state.disposition.volets.length > 0 ? "invisible" : ""}`}>
          <Panel>{children}</Panel>
        </div>
      )}

      {state.primary &&
        (state.emplacementPrimaire ? (
          // Le contenu de la fiche primaire entre dans sa boite de la couche :
          // elle change de volet sans que ce contenu soit remonte.
          createPortal(children, state.emplacementPrimaire)
        ) : (
          // Tant que la boite n'existe pas, la fiche reste montee (masquee) :
          // c'est elle qui porte `RegisterPrimaryWindow`.
          <div className="hidden">{children}</div>
        ))}
    </div>
  );
}
