import type { ReactNode } from "react";
import type { AppLogoKey } from "@/src/core/brand/identity";
import { LogoApp } from "./LogoApp";

/**
 * Le cadre de l'écran-titre (V3.1-85), partagé par les portes d'entrée
 * (V3.1-86 : Rejoindre, sa porte à mot de passe, Réinitialiser) : au tiers
 * haut la tuile du logo et le nom, la phrase d'accueil dessous, puis le
 * contenu (menu ou panneau de verre). Le fond est celui de toute l'application
 * (`.app-backdrop`, posé par le layout racine). Sans état : utilisable par
 * une page serveur comme par l'écran-titre client.
 */

/** Le panneau de verre qui prend la place du menu (380 px, 340 px sur téléphone). */
export const PANNEAU_VERRE =
  "flex w-[340px] max-w-full flex-col gap-3.5 rounded-3xl border border-edge bg-panel p-[18px] backdrop-blur-lg md:w-[380px] md:px-[22px] md:py-5";

/** Le titre d'un panneau (« Bon retour », « Bienvenue »…). */
export const TITRE_PANNEAU = "font-display text-[22px] font-extrabold text-ink";

export interface IdentiteTitre {
  name: string;
  tagline: string;
  logoKey: AppLogoKey;
  logoUrl: string | null;
}

export function CadreTitre({ identite, message, children }: { identite: IdentiteTitre; message?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 pb-10 pt-[12vh] font-sans">
      <div className="flex flex-col items-center gap-3 text-center md:flex-row md:gap-4">
        <LogoApp logoKey={identite.logoKey} logoUrl={identite.logoUrl} taille={84} />
        <h1 className="font-display text-[46px] font-extrabold leading-none tracking-tight text-ink [text-shadow:0_10px_40px_rgba(0,0,0,.6)] md:text-[72px]">
          {identite.name}
        </h1>
      </div>
      {identite.tagline && <p className="mt-3 text-center text-base text-ink-soft">{identite.tagline}</p>}
      {message}
      <div className="mt-10 flex w-full flex-col items-center">{children}</div>
    </div>
  );
}
