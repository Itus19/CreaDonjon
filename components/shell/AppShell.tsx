"use client";

import { usePathname } from "next/navigation";
import DiceRollProvider from "./DiceRollPanel";
import ChatUnreadProvider from "./useChatUnread";

/**
 * Coquille commune aux trois sections (Monde/Règles/MJ). Elle n'a plus
 * d'en-tete depuis V2.1-16 (retour utilisateur : "je n'utilise pas trop la
 * barre d'en-tete") : le nom du monde et la sortie vivent en tete de chaque
 * barre laterale (`WorldSidebarHeader`), comme sur le wiki public et dans
 * la coquille joueur, et la radio et l'heure dans une pastille posee DANS
 * la zone de travail (`ChromePill`, rendue par `WindowsDesktop` — voir son
 * commentaire pour la raison). Le bandeau Monde/Règles/MJ (`SectionToggle`)
 * etait parti dans les barres laterales des V2-K2.
 *
 * Ce qui reste ici : les deux contextes (des, messages non lus) et la borne
 * de hauteur de la coquille.
 */
export default function AppShell({
  worldSlug,
  campaignId,
  children,
  overlay,
}: {
  worldSlug: string;
  /** V2-M11 (volet de lancer de des) : "un monde = une campagne" — `null` avant la creation de la premiere campagne. */
  campaignId: string | null;
  children: React.ReactNode;
  /**
   * Emplacement pour un contenu monte une seule fois, HORS du flux flex de
   * `{children}` mais toujours a l'interieur de `DiceRollProvider`/
   * `ChatUnreadProvider` (audit de performance, retour utilisateur) —
   * `AvecWindowsLayer.tsx` (fenetres secondaires, partagees entre les trois
   * sections) en a besoin : montee comme simple sœur d'`AppShell` dans
   * `app/m/[worldSlug]/layout.tsx`, une fiche de personnage ouverte en
   * fenetre secondaire perdait `useDiceRoll`/`useChatUnread` ("doit etre
   * appele sous DiceRollProvider") faute d'etre sous ces contextes.
   */
  overlay?: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMj = pathname.startsWith(`/m/${worldSlug}/mj`);
  return (
    <DiceRollProvider campaignId={campaignId} isGm={isMj}>
      <ChatUnreadProvider campaignId={campaignId} isMj={isMj}>
        {/* `flex-1 min-h-0` plutot qu'une hauteur fixe (`h-dvh`) : ce conteneur
            n'est pas toujours le seul enfant de `<body>` — le bandeau "voir comme"
            (`ViewAsBanner`, app/layout.tsx) s'empile au-dessus quand il est
            present, sur TOUTE route (pas seulement la coquille joueur). Une
            hauteur fixe ignorait cet ajout et poussait la barre d'onglets
            mobile de la coquille joueur hors de l'ecran (retour utilisateur,
            constate en testant avec le compte Claude). Le bandeau est
            soustrait tout seul, sans constante a tenir a jour.

            V2.1-16 — `min-h-0` + `overflow-hidden` : c'est LA borne de la
            coquille de monde. `<body>` ayant desormais une hauteur definie
            (app/layout.tsx), `flex-1` donne ici exactement la place restante,
            et `overflow-hidden` interdit a quoi que ce soit d'en sortir. Le
            defilement appartient donc aux barres laterales et aux fenetres,
            jamais au document (ADR 0025). */}
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">{children}</div>
        </div>

        {overlay}
      </ChatUnreadProvider>
    </DiceRollProvider>
  );
}
