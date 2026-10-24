"use client";

import { usePathname } from "next/navigation";
import DiceRollProvider from "./DiceRollPanel";
import ChatUnreadProvider from "./useChatUnread";
import SauvegardesProvider from "./SauvegardesProvider";
import type { DemandeSauvegarde } from "@/lib/ui/sauvegardes";
import BarreTelephoneMj from "./BarreTelephoneMj";

/** Une seule référence : le fournisseur repart de la liste quand elle change. */
const AUCUNE_SAUVEGARDE: DemandeSauvegarde[] = [];

/**
 * Coquille commune aux trois sections (Monde/Règles/MJ). Elle n'a plus
 * d'en-tete depuis V2.1-16 (retour utilisateur : "je n'utilise pas trop la
 * barre d'en-tete") : le nom du monde et la sortie vivent en tete de chaque
 * barre laterale (`WorldSidebarHeader`), comme sur le wiki public et dans
 * la coquille joueur, et la radio dans la dalle « Outils » du rail (grand
 * ecran) ou la feuille « Outils » de la barre flottante (telephone,
 * `BarreTelephoneMj`, montee ici). Le bandeau Monde/Règles/MJ (`SectionToggle`)
 * etait parti dans les barres laterales des V2-K2.
 *
 * Ce qui reste ici : les deux contextes (des, messages non lus) et la borne
 * de hauteur de la coquille.
 */
export default function AppShell({
  worldSlug,
  campaignId,
  initialUnreadCount = null,
  userId = null,
  initialSaveRequests = AUCUNE_SAUVEGARDE,
  children,
  overlay,
}: {
  worldSlug: string;
  /** V2-M11 (volet de lancer de des) : "un monde = une campagne" — `null` avant la creation de la premiere campagne. */
  campaignId: string | null;
  /** Messages non lus, comptes par le layout avec la page (V3.1-62) ; `null` : la pastille les demande elle-meme. */
  initialUnreadCount?: number | null;
  /** V3.1-112 : l'utilisateur, pour savoir quelles sauvegardes lui reviennent. */
  userId?: string | null;
  /** V3.1-112 : les sauvegardes en attente, lues par le layout avec la page. */
  initialSaveRequests?: DemandeSauvegarde[];
  children: React.ReactNode;
  /**
   * Emplacement pour un contenu monte une seule fois, HORS du flux flex de
   * `{children}` mais toujours a l'interieur de `DiceRollProvider`/
   * `ChatUnreadProvider` (audit de performance, retour utilisateur) —
   * `VoletsLayer.tsx` (volets des fiches ouvertes, partages entre les trois
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
      <ChatUnreadProvider
        campaignId={campaignId}
        isMj={isMj}
        initialUnreadCount={initialUnreadCount}
      >
        <SauvegardesProvider
          campaignId={campaignId}
          userId={userId}
          isMj={isMj}
          initiales={initialSaveRequests}
        >
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

          {/* V3.1-29 : barre flottante du telephone, cote MJ. Montee ICI, une seule
            fois pour Monde, Regles et MJ (elle se tait d'elle-meme sous `/joueur`
            et `/apercu`, dont la coquille joueur porte sa propre barre). */}
          <BarreTelephoneMj worldSlug={worldSlug} />

          {overlay}
        </SauvegardesProvider>
      </ChatUnreadProvider>
    </DiceRollProvider>
  );
}
