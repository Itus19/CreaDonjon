"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
 *
 * V3.1-93 : `sommaire` (Regles seulement) est une colonne de 250 px a gauche de
 * la zone, DANS la zone de travail. `refZone` reste sur la zone SANS le
 * sommaire : la couche des volets se cale donc a sa droite. Sous 48 rem de
 * large (requete de CONTENEUR : la fenetre, pas l'ecran), la colonne se reduit
 * a un bouton ☰ qui ouvre le sommaire en tiroir. Sur telephone, rien ne change.
 */
export default function WindowsDesktop({ children, sommaire }: { children: React.ReactNode; sommaire?: React.ReactNode }) {
  const desktop = useDesktop();
  const pathname = usePathname();
  const state = useDesktopWindowsState();
  const isMobile = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const enregistrerZone = state?.enregistrerZone;
  const refZone = useCallback((el: HTMLDivElement | null) => enregistrerZone?.(el), [enregistrerZone]);
  const t = useTranslations("regles");
  const [tiroirOuvert, setTiroirOuvert] = useState(false);

  // Echap referme le tiroir du sommaire (fenetre etroite).
  useEffect(() => {
    if (!tiroirOuvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTiroirOuvert(false);
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [tiroirOuvert]);

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

  const zone = (
    <div ref={refZone} className={`relative flex-1 overflow-hidden ${sommaire ? "min-w-0" : ""}`}>
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

  if (!sommaire) return zone;

  return (
    <div className="@container relative flex min-h-0 flex-1 overflow-hidden">
      {/* z-50 : au-dessus de la couche des volets (fixed, z-40), pour que le ☰
          et le tiroir restent atteignables quand une fiche couvre la zone. */}
      <div className="relative z-50 shrink-0 @max-[48rem]:w-11 w-[250px]">
        <button
          type="button"
          onClick={() => setTiroirOuvert((v) => !v)}
          aria-label={t("sommaireRegles")}
          aria-expanded={tiroirOuvert}
          className="mx-auto mt-3 flex h-8 w-8 items-center justify-center rounded-md border border-edge bg-panel-raised text-sm text-ink @[48rem]:hidden"
        >
          ☰
        </button>
        <div
          // Un clic sur un lien (regle, formulaire, bac a sable) referme le tiroir.
          onClick={(e) => {
            if (e.target instanceof Element && e.target.closest("a")) setTiroirOuvert(false);
          }}
          className={`${tiroirOuvert ? "flex" : "hidden @[48rem]:flex"} h-full w-[250px] @max-[48rem]:absolute @max-[48rem]:left-0 @max-[48rem]:top-0 @max-[48rem]:shadow-[20px_0_40px_-20px_rgba(0,0,0,.7)]`}
        >
          {sommaire}
        </div>
      </div>
      {zone}
    </div>
  );
}
