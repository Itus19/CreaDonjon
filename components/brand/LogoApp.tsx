import type { ReactNode } from "react";
import type { AppLogoKey } from "@/src/core/brand/identity";

/**
 * Logo de l'application (V3.1-85) : la tuile d'accent aux coins arrondis et,
 * dedans, soit le dessin au trait de `logoKey` (douze, dessins de la planche
 * Admin-Decide), soit l'image téléversée si `logoUrl` est donné. Des éléments
 * SVG JSX, jamais de HTML injecté.
 */

const TRAIT = { fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const DESSINS: Record<AppLogoKey, ReactNode> = {
  d20: (
    <>
      <path {...TRAIT} d="M24 4 L41 14 L41 34 L24 44 L7 34 L7 14 Z M24 15 L35 32 L13 32 Z M24 15 L7 14 M24 15 L41 14 M24 15 L24 4 M35 32 L41 14 M35 32 L41 34 M35 32 L24 44 M13 32 L7 14 M13 32 L7 34 M13 32 L24 44"/>
    </>
  ),
  dungeon_door: (
    <>
      <path {...TRAIT} d="M12 43 V22 A12 12 0 0 1 36 22 V43 Z M20 12 V43 M28 12 V43 M5 43 H43"/>
      <circle cx="32" cy="30" r="1.8" fill="currentColor"/>
    </>
  ),
  dragon_eye: (
    <>
      <path {...TRAIT} d="M4 24 Q24 6 44 24 Q24 42 4 24 Z"/>
      <path d="M24 12 Q30 24 24 36 Q18 24 24 12 Z" fill="currentColor"/>
    </>
  ),
  dice_cup: (
    <>
      <path {...TRAIT} d="M10 18 H38 L34 43 H14 Z M12 26 H36"/>
      <path {...TRAIT} d="M18 4 L29 2 L31 13 L20 15 Z"/>
      <circle cx="24.5" cy="8.5" r="1.6" fill="currentColor"/>
    </>
  ),
  quill_die: (
    <>
      <path {...TRAIT} d="M42 5 Q24 9 15 30 L10 43 M42 5 Q38 23 17 28 M30 12 L26 18 M36 16 L30 21"/>
      <path {...TRAIT} d="M33 27 L41 31.5 L41 40.5 L33 45 L25 40.5 L25 31.5 Z"/>
    </>
  ),
  key: (
    <>
      <circle cx="14" cy="14" r="9" {...TRAIT}/>
      <circle cx="14" cy="14" r="2" fill="currentColor"/>
      <path {...TRAIT} d="M20.5 20.5 L41 41 M33 33 L38 28 M37.5 37.5 L42 33"/>
    </>
  ),
  grimoire: (
    <>
      <path {...TRAIT} d="M6 15 Q15 10 24 15 Q33 10 42 15 V39 Q33 34 24 39 Q15 34 6 39 Z M24 15 V39 M11 21 Q15 19 19 21 M11 27 Q15 25 19 27 M29 21 Q33 19 37 21"/>
      <path d="M24 2 L27 7 L24 11 L21 7 Z" fill="currentColor"/>
    </>
  ),
  tower: (
    <>
      <path {...TRAIT} d="M13 44 V16 H35 V44 M13 16 V9 H18 V13 H22 V9 H26 V13 H30 V9 H35 V16 M24 22 V29 M20 44 V38 A4 4 0 0 1 28 38 V44 M8 44 H40"/>
    </>
  ),
  maze: (
    <>
      <path {...TRAIT} d="M6 13 V6 H42 V42 H6 V20 M13 13 H35 V35 H20 M13 13 V35 M20 20 H28 V28"/>
      <circle cx="24" cy="24" r="1.8" fill="currentColor"/>
    </>
  ),
  scale: (
    <>
      <path {...TRAIT} d="M24 4 L41 10 V24 Q41 38 24 45 Q7 38 7 24 V10 Z M7 18 Q11.5 25 16 18 Q20 25 24 18 Q28 25 32 18 Q36.5 25 41 18 M11 28 Q15.5 35 20 28 Q24 35 28 28 Q32.5 35 37 28"/>
    </>
  ),
  lair: (
    <>
      <path {...TRAIT} d="M4 42 L16 13 L23 21 L32 8 L44 42 Z M15 42 Q24 24 33 42"/>
      <circle cx="21" cy="36" r="1.7" fill="currentColor"/>
      <circle cx="27" cy="36" r="1.7" fill="currentColor"/>
    </>
  ),
  map: (
    <>
      <path {...TRAIT} d="M6 11 L18 6 L30 11 L42 6 V37 L30 42 L18 37 L6 42 Z M18 6 V37 M30 11 V42"/>
      <path {...TRAIT} d="M33 17 L39 23 M39 17 L33 23"/>
      <path d="M10 33 Q14 26 20 28 Q25 30 28 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2.5 3" strokeLinecap="round"/>
    </>
  ),
};

export interface LogoAppProps {
  logoKey: AppLogoKey;
  logoUrl?: string | null;
  /** Côté de la tuile, en pixels. */
  taille?: number;
  className?: string;
}

export function LogoApp({ logoKey, logoUrl = null, taille = 40, className = "" }: LogoAppProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-accent text-accent-ink ${className}`}
      style={{ width: taille, height: taille, borderRadius: Math.round(taille * 0.27) }}
      aria-hidden="true"
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- image téléversée servie par la route d'identité, taille déjà fixée
        <img src={logoUrl} alt="" width={taille} height={taille} className="h-full w-full object-cover" />
      ) : (
        <svg width={Math.round(taille * 0.7)} height={Math.round(taille * 0.7)} viewBox="0 0 48 48">
          {DESSINS[logoKey]}
        </svg>
      )}
    </span>
  );
}
