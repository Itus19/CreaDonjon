"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CLE_RAIL_REPLIE, ecrireRailReplie, lireRailReplie } from "@/lib/ui/rail";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import { useDiceRoll } from "./DiceRollPanel";
import RadioWidget from "./RadioWidget";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";

/**
 * Rail flottant repliable (V3.1-27) : remplace, a partir de 768 px (`md`), les
 * barres laterales du MJ (Monde, Regles, MJ) et la colonne du joueur. Le meme
 * rail sert aux quatre ; chacune garde son propre contenu et son propre
 * comportement sous 768 px (feuille du bas ouverte par ☰, barre flottante) —
 * ce fichier ne fournit que la coquille, les lignes, le menu flottant et la
 * dalle « Outils ».
 *
 * Un seul arbre DOM par barre : les classes `md:` transforment le tiroir en
 * rail, et les morceaux propres a un seul des deux modes se masquent en CSS
 * (`md:hidden` / `hidden md:flex`), ce qui evite aussi tout scintillement a
 * l'hydratation. Seul l'etat REPLIE passe par JavaScript, parce qu'il change
 * ce qu'on rend (une ligne par groupe au lieu de l'arborescence).
 */

/** Largeurs du rail : 204 px deplie, 64 px replie. */
const LARGEUR_DEPLIE = "md:w-[204px]";
const LARGEUR_REPLIE = "md:w-16";

// ---- etat replie -----------------------------------------------------------

/**
 * Etat replie du rail, memorise dans le navigateur. Au premier chargement,
 * deplie, pour que le serveur et le navigateur produisent le meme HTML.
 *
 * `replie` est l'etat EFFECTIF : sous 768 px le rail n'existe pas, donc la
 * preference memorisee ne doit jamais appauvrir le tiroir (il resterait sans
 * arborescence). L'etat brut, lui, est conserve pour le retour en grand ecran.
 *
 * L'etat est un « magasin externe » (`useSyncExternalStore`) plutot qu'un
 * `useState` relu au montage : Monde, Regles et MJ ont chacune leur layout, et
 * le rail se remonte a chaque changement de section. Relu dans un effet, il
 * repartait deplie puis s'animait jusqu'a replie a CHAQUE navigation. Ici,
 * une navigation cote client lit la valeur avant le premier rendu ; seul le
 * tout premier chargement (hydratation) part de l'instantane serveur.
 */
const abonnesRail = new Set<() => void>();
let avertiStockage = false;

function abonnerRail(rappel: () => void): () => void {
  abonnesRail.add(rappel);
  // Un autre onglet qui replie le rail : celui-ci suit.
  window.addEventListener("storage", rappel);
  return () => {
    abonnesRail.delete(rappel);
    window.removeEventListener("storage", rappel);
  };
}

function lireInstantaneRail(): boolean {
  try {
    return lireRailReplie(window.localStorage.getItem(CLE_RAIL_REPLIE));
  } catch (erreur) {
    // Stockage indisponible (navigation privee stricte) : le rail reste deplie.
    // Un seul avertissement : cette lecture a lieu a chaque rendu.
    if (!avertiStockage) console.warn("Lecture de l'état replié du rail impossible", erreur);
    avertiStockage = true;
    return false;
  }
}

/** Le serveur ne connait pas la preference : deplie, comme le premier rendu du navigateur. */
function instantaneServeurRail(): boolean {
  return false;
}

export function useRailReplie(): { replie: boolean; basculer: () => void } {
  const brut = useSyncExternalStore(abonnerRail, lireInstantaneRail, instantaneServeurRail);
  const estOrdinateur = !useMatchMedia(WINDOWS_MOBILE_QUERY);

  const basculer = useCallback(() => {
    try {
      window.localStorage.setItem(CLE_RAIL_REPLIE, ecrireRailReplie(!lireInstantaneRail()));
    } catch (erreur) {
      console.warn("Enregistrement de l'état replié du rail impossible", erreur);
    }
    abonnesRail.forEach((rappel) => rappel());
  }, []);

  return { replie: brut && estOrdinateur, basculer };
}

const RailContext = createContext<{ replie: boolean }>({ replie: false });

/** Etat replie effectif, pour les lignes et la dalle. */
export function useRail(): { replie: boolean } {
  return useContext(RailContext);
}

// ---- icones ----------------------------------------------------------------

/** Enveloppe SVG au trait (charte §10) : prend la taille de son conteneur et la couleur du texte. */
export function TraitSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Icones communes aux lignes de section et aux actions ; celles propres a un ecran restent dans cet ecran. */
export function IconeRail({ nom }: { nom: "maison" | "livres" | "bouclier" | "loupe" | "plus" | "frise" | "outils" | "generique" }) {
  switch (nom) {
    case "maison":
      return (
        <TraitSvg>
          <path d="M4 21V9l8-6 8 6v12" />
          <path d="M9 21v-6h6v6" />
        </TraitSvg>
      );
    case "livres":
      return (
        <TraitSvg>
          <path d="M5 4h4a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5V4Z" />
          <path d="M13 4h4v16h-4a2 2 0 0 0-2 2V6a2 2 0 0 1 2-2Z" />
        </TraitSvg>
      );
    case "bouclier":
      return (
        <TraitSvg>
          <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z" />
        </TraitSvg>
      );
    case "loupe":
      return (
        <TraitSvg>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </TraitSvg>
      );
    case "plus":
      return (
        <TraitSvg>
          <path d="M12 5v14M5 12h14" />
        </TraitSvg>
      );
    case "frise":
      return (
        <TraitSvg>
          <path d="M3 12h18" />
          <circle cx="7" cy="12" r="2" />
          <circle cx="16" cy="12" r="2" />
          <path d="M7 6v4M16 14v4" />
        </TraitSvg>
      );
    case "outils":
      return (
        <TraitSvg>
          <path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2-.5-.5-2 2.5-2.5Z" />
        </TraitSvg>
      );
    case "generique":
      return (
        <TraitSvg>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M9 9h6M9 13h4" />
        </TraitSvg>
      );
  }
}

// ---- coquille --------------------------------------------------------------

/**
 * Le rail lui-meme (l'`aside`). Sous 768 px (V3.1-29) : plus de tiroir de
 * gauche, le MEME contenu s'ouvre dans une feuille du bas (`FeuilleDuBas`) tant
 * que `ouvert` est vrai, et rien n'est rendu sinon. A partir de 768 px : un conteneur transparent, flottant (marge de
 * 20 px en haut, en bas et a gauche), dont la largeur s'anime entre 204 et 64 px
 * et qui porte des « parties » arrondies (`RailPart`) et la poignee.
 *
 * `md:z-[60]` : la poignee deborde de 16 px sur la zone des fenetres, qui est
 * une pile d'empilement de z-index 10 ou 50 ; sans cela elle serait recouverte
 * et ne recevrait pas les clics.
 */
export function Rail({
  ouvert,
  replie,
  onBasculer,
  onFermer,
  titreFeuille,
  barreBasse = false,
  children,
}: {
  /** Feuille ouverte (sous 768 px seulement). Sans objet pour la coquille joueur. */
  ouvert: boolean;
  replie: boolean;
  onBasculer: () => void;
  /** Ferme la feuille du bas (sous 768 px). Absent : la coquille n'a pas de feuille (MJ, ses outils sont dans la feuille « Outils »). */
  onFermer?: () => void;
  /** Nom de la feuille du bas pour les lecteurs d'ecran. */
  titreFeuille?: string;
  /** Coquille joueur : sous 768 px le rail est remplace par la barre flottante (`BarreFlottante`), il disparait donc. */
  barreBasse?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("shell");
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);
  if (estTelephone && !barreBasse) {
    if (!ouvert || !onFermer) return null;
    return (
      <FeuilleDuBas titre={titreFeuille ?? t("outils")} onFermer={onFermer}>
        <RailContext.Provider value={{ replie: false }}>
          {/* L'espacement du tiroir d'avant (`gap-3`) : les parties sont `contents`, leurs blocs s'empilent ici. */}
          <div className="flex flex-col gap-3">{children}</div>
        </RailContext.Provider>
      </FeuilleDuBas>
    );
  }
  const baseMobile = barreBasse ? "max-md:hidden" : "hidden";
  const Balise = barreBasse ? "nav" : "aside";
  return (
    <RailContext.Provider value={{ replie }}>
      <Balise
        className={`${baseMobile} shrink-0 transition-[width] md:relative md:z-[60] md:my-5 md:ml-5 md:flex md:flex-col md:justify-start md:gap-3 md:p-0 md:duration-[380ms] md:ease-[cubic-bezier(.4,0,.2,1)] motion-reduce:transition-none print:hidden ${
          replie ? LARGEUR_REPLIE : LARGEUR_DEPLIE
        }`}
      >
        {children}
        <button
          type="button"
          onClick={onBasculer}
          aria-expanded={!replie}
          aria-label={replie ? t("deplierMenu") : t("replierMenu")}
          className="absolute left-full top-[34px] z-[90] hidden h-11 w-4 items-center justify-center rounded-r-xl border border-l-0 border-edge-strong bg-panel-raised text-ink-soft shadow-lg transition-colors hover:bg-panel hover:text-ink md:flex"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-2.5 w-2.5 transition-transform duration-[380ms] motion-reduce:transition-none ${replie ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </Balise>
    </RailContext.Provider>
  );
}

/**
 * Une des deux « parties » du rail. Sous 768 px elle est transparente
 * (`contents` : ses enfants se comportent comme s'ils etaient poses
 * directement dans le tiroir, donc la mise en page d'avant est intacte) ;
 * `visibleMobile={false}` la retire entierement du tiroir (la dalle Outils).
 */
export function RailPart({
  children,
  visibleMobile = true,
  className = "",
}: {
  children: React.ReactNode;
  visibleMobile?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${
        visibleMobile ? "contents" : "hidden"
      } md:relative md:flex md:flex-col md:rounded-3xl md:border md:border-edge md:bg-panel md:shadow-2xl md:backdrop-blur-[var(--blur)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Filet entre les lignes de section et le contenu propre a la section (rail seulement). */
export function RailFilet() {
  return <div className="mx-0.5 my-1.5 hidden h-px shrink-0 bg-edge md:block" aria-hidden="true" />;
}

// ---- lignes ----------------------------------------------------------------

const CLASSE_LIGNE =
  "relative flex w-full items-center rounded-xl px-2.5 py-[9px] text-left text-ink-soft transition-colors hover:bg-panel-raised hover:text-ink";

/** Contenu d'une ligne : icone de 18 px, libelle qui s'efface, pastille, point actif. */
function ContenuLigne({
  icone,
  libelle,
  actif,
  badge,
  replie,
}: {
  icone: React.ReactNode;
  libelle: string;
  actif?: boolean;
  badge?: number;
  replie: boolean;
}) {
  return (
    <>
      <span className={`relative block h-[18px] w-[18px] shrink-0 ${actif ? "text-accent" : ""}`}>
        {icone}
        {/* Replie, le libelle a disparu : la pastille se pose sur l'icone. */}
        {replie && !!badge && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-accent px-1 text-xs font-semibold leading-tight text-accent-ink">
            {badge}
          </span>
        )}
      </span>
      {/* Opacite en 200 ms, largeur en 320 ms, marge avec la largeur : sans
          elle, l'ecart de 13 px entre l'icone et le libelle resterait
          visible rail replie et decentrerait l'icone. */}
      <span
        className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap text-[12.5px] [transition:opacity_200ms_ease,max-width_320ms_ease,margin-left_320ms_ease] motion-reduce:transition-none ${
          replie ? "ml-0 max-w-0 opacity-0" : "ml-[13px] max-w-[160px] opacity-100"
        } ${actif ? "font-semibold text-ink" : ""}`}
      >
        {libelle}
      </span>
      {!replie && !!badge && (
        <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold leading-none text-accent-ink">{badge}</span>
      )}
      {!replie && actif && <span className="ml-2 h-[5px] w-[5px] shrink-0 rounded-full bg-accent" aria-hidden="true" />}
    </>
  );
}

export interface RailRowProps {
  icone: React.ReactNode;
  libelle: string;
  actif?: boolean;
  badge?: number;
  /** Bordure en pointillés (action de creation). */
  pointille?: boolean;
  /** Lien : la ligne est un `<Link>`. Sans `href`, c'est un bouton. */
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  prefetch?: boolean;
  /** Bouton qui envoie son formulaire. */
  soumettre?: boolean;
  /** Contenu du menu flottant (rail replie) ; recoit de quoi le fermer. La ligne devient alors un declencheur de menu. */
  menu?: (fermer: () => void) => React.ReactNode;
}

/**
 * Une ligne du rail : icone de 18 px + libelle qui s'efface + pastille + point
 * actif. Lien, bouton ou declencheur de menu flottant selon les props.
 */
export function RailRow(props: RailRowProps) {
  const { replie } = useRail();
  if (props.menu) return <LigneAvecMenu {...props} menu={props.menu} replie={replie} />;

  const classe = `${CLASSE_LIGNE} ${props.actif ? "bg-panel-raised" : ""} ${
    props.pointille ? "border border-dashed border-edge-strong" : ""
  }`;
  const contenu = (
    <ContenuLigne icone={props.icone} libelle={props.libelle} actif={props.actif} badge={props.badge} replie={replie} />
  );
  const titre = replie ? props.libelle : undefined;

  if (props.href !== undefined) {
    return (
      <Link
        href={props.href}
        onClick={props.onClick}
        prefetch={props.prefetch}
        title={titre}
        aria-current={props.actif ? "page" : undefined}
        className={classe}
      >
        {contenu}
      </Link>
    );
  }
  return (
    <button type={props.soumettre ? "submit" : "button"} onClick={props.onClick} title={titre} className={classe}>
      {contenu}
    </button>
  );
}

// ---- menu flottant ---------------------------------------------------------

interface PositionMenu {
  left: number;
  top?: number;
  bottom?: number;
}

/** Delai avant fermeture quand la souris quitte la ligne : laisse le temps de traverser l'ecart de 10 px jusqu'au menu. */
const DELAI_FERMETURE_MS = 150;

/**
 * Ligne qui ouvre un menu flottant (rail replie). S'ouvre au survol ET au
 * clavier (Entree, fleche droite) ; Echap le ferme et rend le focus a la ligne.
 */
function LigneAvecMenu(props: RailRowProps & { menu: (fermer: () => void) => React.ReactNode; replie: boolean }) {
  const [position, setPosition] = useState<PositionMenu | null>(null);
  const [focusPremier, setFocusPremier] = useState(false);
  const ligneRef = useRef<HTMLButtonElement>(null);
  const minuteurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ouvert au clavier : la souris qui passe ne doit pas le refermer sous le focus. */
  const auClavierRef = useRef(false);
  const ouvert = position !== null;

  const annulerFermeture = useCallback(() => {
    if (minuteurRef.current) clearTimeout(minuteurRef.current);
    minuteurRef.current = null;
  }, []);

  const fermer = useCallback(() => {
    annulerFermeture();
    auClavierRef.current = false;
    setPosition(null);
    setFocusPremier(false);
  }, [annulerFermeture]);

  const planifierFermeture = useCallback(() => {
    if (auClavierRef.current) return;
    annulerFermeture();
    minuteurRef.current = setTimeout(fermer, DELAI_FERMETURE_MS);
  }, [annulerFermeture, fermer]);

  useEffect(() => annulerFermeture, [annulerFermeture]);

  function ouvrir(auClavier: boolean) {
    annulerFermeture();
    const ligne = ligneRef.current;
    if (!ligne) return;
    const r = ligne.getBoundingClientRect();
    // Ancrage du cote qui laisse le plus de place : un groupe long, ouvert depuis
    // une ligne du bas, partirait sinon sous le bord de l'ecran.
    const enHaut = r.top < window.innerHeight / 2;
    setPosition({
      left: r.right + 10,
      ...(enHaut ? { top: Math.max(8, r.top - 6) } : { bottom: Math.max(8, window.innerHeight - r.bottom - 6) }),
    });
    if (auClavier) {
      auClavierRef.current = true;
      setFocusPremier(true);
    }
  }

  function fermerEtRendreFocus() {
    fermer();
    ligneRef.current?.focus();
  }

  return (
    <>
      <button
        ref={ligneRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        title={props.replie ? props.libelle : undefined}
        // Un clic (souris comme Entree) ouvre toujours, il ne bascule jamais :
        // le survol l'a deja ouvert, un second geste ne doit pas le refermer.
        onClick={(e) => ouvrir(e.detail === 0)}
        onMouseEnter={() => ouvrir(false)}
        onMouseLeave={planifierFermeture}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            ouvrir(true);
          } else if (e.key === "Escape" && ouvert) {
            fermer();
          }
        }}
        className={`${CLASSE_LIGNE} ${props.actif ? "bg-panel-raised" : ""}`}
      >
        <ContenuLigne icone={props.icone} libelle={props.libelle} actif={props.actif} badge={props.badge} replie={props.replie} />
      </button>
      {position && (
        <RailFlyout
          position={position}
          titre={props.libelle}
          focusPremier={focusPremier}
          onFermer={fermer}
          onFermerEtRendreFocus={fermerEtRendreFocus}
          onSurvolEntree={annulerFermeture}
          onSurvolSortie={planifierFermeture}
        >
          <ContenuMenu menu={props.menu} fermer={fermer} />
        </RailFlyout>
      )}
    </>
  );
}

/**
 * Appelle le rendu du menu dans son propre composant : `fermer` s'appuie sur des
 * refs (minuteur), et la regle `react-hooks/refs` interdit de la passer a une
 * fonction appelee pendant le rendu du composant qui les possede.
 */
function ContenuMenu({ menu, fermer }: { menu: (fermer: () => void) => React.ReactNode; fermer: () => void }) {
  return <>{menu(fermer)}</>;
}

/** Classes d'un element de menu flottant (lien) ; `actif` marque la page courante. */
export function classeItemFlyout(actif: boolean): string {
  return `block truncate rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-panel ${
    actif ? "bg-panel font-medium text-ink" : "text-ink-soft"
  }`;
}

/**
 * Menu flottant du rail replie. `position: fixed` calculee depuis la ligne et
 * rendu dans un portail : la liste du rail porte `overflow-y: auto`, qui
 * couperait un menu pose a l'interieur (un `overflow-y` autre que `visible`
 * force `overflow-x` a ne plus l'etre).
 */
export function RailFlyout({
  position,
  titre,
  focusPremier,
  onFermer,
  onFermerEtRendreFocus,
  onSurvolEntree,
  onSurvolSortie,
  children,
}: {
  position: PositionMenu;
  titre: string;
  focusPremier: boolean;
  onFermer: () => void;
  onFermerEtRendreFocus: () => void;
  onSurvolEntree: () => void;
  onSurvolSortie: () => void;
  children: React.ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusPremier) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [focusPremier]);

  function onKeyDown(e: React.KeyboardEvent) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const courant = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape" || e.key === "ArrowLeft") {
      e.preventDefault();
      onFermerEtRendreFocus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[Math.min(courant + 1, items.length - 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[Math.max(courant - 1, 0)]?.focus();
    } else if (e.key === "Tab") {
      // Pas de preventDefault : le focus rejoint la ligne, puis Tab continue de la.
      onFermerEtRendreFocus();
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={titre}
      onMouseEnter={onSurvolEntree}
      onMouseLeave={onSurvolSortie}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Le focus quitte le menu sans retourner a la ligne (clic ailleurs) : on le ferme.
        if (focusPremier && !menuRef.current?.contains(e.relatedTarget as Node | null)) onFermer();
      }}
      className="fixed z-[100] flex max-h-[calc(100vh-16px)] min-w-[190px] max-w-[280px] flex-col gap-0.5 overflow-y-auto overflow-x-hidden rounded-[14px] border border-edge-strong bg-panel-raised p-2 shadow-2xl backdrop-blur-[var(--blur)]"
      style={{ left: position.left, top: position.top, bottom: position.bottom }}
    >
      {children}
    </div>,
    document.body
  );
}

// ---- de de l'accent --------------------------------------------------------

/** Dessin du de encoche (rail et barre flottante) : meme degrade d'accent, meme ombre. */
export const CLASSE_FOND_DE = "bg-[radial-gradient(circle_at_32%_28%,var(--accent-hover),var(--accent)_75%)] text-accent-ink shadow-lg";

/** Icone du de, au trait. */
export function IconeDe({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </svg>
  );
}

// ---- dalle Outils ----------------------------------------------------------

/**
 * Seconde partie du rail (grand ecran seulement) : le de, encoche dans le bord
 * haut, puis la radio. Le de ouvre le volet de lancer existant
 * (`ouvrirVolet`) ; il n'a pas de volet propre. Visible rail replie : c'est
 * tout l'interet de la dalle.
 */
export function OutilsDalle({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("shell");
  const { replie } = useRail();
  const { ouvrirVolet, enregistrerDalle } = useDiceRoll();
  // Le de est l'ancre du panneau de l'outil de des (V3.1-33).
  const deRef = useRef<HTMLButtonElement>(null);
  // Le bouton de des flottant se retire tant qu'une dalle est montee (et
  // seulement alors) : une page de monde sans rail garde son de.
  useEffect(() => enregistrerDalle("ordinateur", deRef), [enregistrerDalle]);
  return (
    <RailPart visibleMobile={false} className="shrink-0 items-center px-2 pb-2.5 pt-8">
      {/* Anneau de 6 px couleur du panneau : le de parait decoupe dans le bord. */}
      <button
        ref={deRef}
        type="button"
        onClick={ouvrirVolet}
        aria-label={t("ouvrirVoletDes")}
        className={`absolute left-1/2 top-0 z-[5] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[6px] border-panel ${CLASSE_FOND_DE} transition-transform hover:scale-105 motion-reduce:transition-none`}
      >
        <IconeDe />
      </button>
      <RadioWidget worldSlug={worldSlug} variante="rail" replie={replie} />
    </RailPart>
  );
}

/**
 * Dalle Outils de l'accueil (V3.1-35) : le de SEUL, sans la radio — la radio
 * appartient a une campagne, et l'accueil n'en a pas. Meme de, meme ancrage
 * du panneau (`enregistrerDalle("ordinateur", ref)`) que `OutilsDalle`.
 */
export function DeSeulDalle() {
  const t = useTranslations("shell");
  const ta = useTranslations("accueil");
  const { replie } = useRail();
  const { ouvrirVolet, enregistrerDalle } = useDiceRoll();
  const deRef = useRef<HTMLButtonElement>(null);
  useEffect(() => enregistrerDalle("ordinateur", deRef), [enregistrerDalle]);
  return (
    <RailPart visibleMobile={false} className="shrink-0 items-center px-2 pb-3 pt-8">
      <button
        ref={deRef}
        type="button"
        onClick={ouvrirVolet}
        aria-label={t("ouvrirVoletDes")}
        className={`absolute left-1/2 top-0 z-[5] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[6px] border-panel ${CLASSE_FOND_DE} transition-transform hover:scale-105 motion-reduce:transition-none`}
      >
        <IconeDe />
      </button>
      {!replie && <span className="text-xs text-ink-muted">{ta("lancerDes")}</span>}
    </RailPart>
  );
}

/**
 * V3.1-35 — le dé de la barre du bas de l'accueil, sur téléphone : il
 * remplace le bouton flottant, qui recouvrait la barre. Même geste que le dé
 * de la barre flottante d'un monde (`BarreFlottante`, `enregistrerDalle("telephone")`).
 */
export function DeBarreBas() {
  const t = useTranslations("shell");
  const { ouvrirVolet, enregistrerDalle } = useDiceRoll();
  useEffect(() => enregistrerDalle("telephone"), [enregistrerDalle]);
  return (
    <button
      type="button"
      onClick={ouvrirVolet}
      aria-label={t("ouvrirVoletDes")}
      className={`-mt-5 flex h-12 w-12 shrink-0 items-center justify-center self-start rounded-full border-[6px] border-panel ${CLASSE_FOND_DE} transition-transform hover:scale-105 motion-reduce:transition-none`}
    >
      <IconeDe />
    </button>
  );
}
