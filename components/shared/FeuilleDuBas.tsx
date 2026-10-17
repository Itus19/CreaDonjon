"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { decalageGlisse, doitFermerApresGlisse, indexFocusSuivant } from "@/lib/ui/feuilleDuBas";

/** Duree de l'entree et de la sortie, en ms (planche « Feuille du bas »). */
const DUREE_MS = 260;

/** Tout ce qui recoit le focus clavier, hors elements desactives ou retires de l'ordre de tabulation. */
const SELECTEUR_FOCALISABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Un geste commence sur un controle ne doit pas etre pris pour une glisse (sinon la capture du pointeur lui volerait son clic). */
const SELECTEUR_CONTROLE = "button, a, input, select, textarea, [role='button']";

/**
 * Feuille du bas (V3.1-29) : l'unique composant par lequel « tout ce qui
 * s'ouvre vient du bas » sur telephone. Remplace le tiroir de gauche.
 *
 * A rendre CONDITIONNELLEMENT par l'appelant (`{ouvert && <FeuilleDuBas .../>}`) :
 * elle monte, entre par le bas, et se retire d'elle-meme apres l'animation de
 * sortie en appelant `onFermer`. Cela garde le declencheur a memoriser (le
 * focus lui est rendu au demontage) et evite tout etat « ouvert mais cache ».
 *
 * Accessibilite : `role="dialog"` + `aria-modal`, nommee par son titre (visible
 * ou `sr-only`) ; Tab boucle dans la feuille ; Echap, le voile et une glisse
 * vers le bas depuis la poignee ou l'en-tete la ferment. Rendue en portail dans
 * `<body>` : aucun ancetre `overflow` ou `transform` ne peut la couper.
 */
export default function FeuilleDuBas({
  titre,
  titreVisible = false,
  onFermer,
  children,
}: {
  titre: string;
  /** Titre affiche dans l'en-tete ; sinon lu par les lecteurs d'ecran seulement. */
  titreVisible?: boolean;
  onFermer: () => void;
  children: React.ReactNode;
}) {
  const [entree, setEntree] = useState(false);
  const [sortie, setSortie] = useState(false);
  const [decalage, setDecalage] = useState(0);
  const [glisse, setGlisse] = useState(false);
  const feuilleRef = useRef<HTMLDivElement>(null);
  const declencheurRef = useRef<Element | null>(null);
  const minuteurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departRef = useRef<{ y: number; t: number; id: number } | null>(null);
  const identifiant = useId();
  const onFermerRef = useRef(onFermer);
  useEffect(() => {
    onFermerRef.current = onFermer;
  }, [onFermer]);

  // Entree par le bas : la feuille est d'abord peinte hors ecran, puis glisse.
  useEffect(() => {
    let second = 0;
    const premier = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntree(true));
    });
    return () => {
      cancelAnimationFrame(premier);
      cancelAnimationFrame(second);
    };
  }, []);

  // Focus : on memorise le declencheur, le premier element de la feuille le
  // prend, et le declencheur le retrouve au demontage.
  useEffect(() => {
    declencheurRef.current = document.activeElement;
    const feuille = feuilleRef.current;
    const premier = feuille?.querySelector<HTMLElement>(SELECTEUR_FOCALISABLE);
    (premier ?? feuille)?.focus({ preventScroll: true });
    return () => {
      if (minuteurRef.current) clearTimeout(minuteurRef.current);
      const declencheur = declencheurRef.current;
      if (declencheur instanceof HTMLElement && declencheur.isConnected) declencheur.focus({ preventScroll: true });
    };
  }, []);

  const demanderFermeture = useCallback(() => {
    if (minuteurRef.current) return;
    setSortie(true);
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    minuteurRef.current = setTimeout(() => onFermerRef.current(), reduit ? 0 : DUREE_MS);
  }, []);

  // Echap ferme, meme si le focus a quitte la feuille.
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      demanderFermeture();
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [demanderFermeture]);

  function surToucheFeuille(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const feuille = feuilleRef.current;
    if (!feuille) return;
    const focalisables = Array.from(feuille.querySelectorAll<HTMLElement>(SELECTEUR_FOCALISABLE));
    if (focalisables.length === 0) {
      e.preventDefault();
      feuille.focus();
      return;
    }
    const suivant = indexFocusSuivant(focalisables.indexOf(document.activeElement as HTMLElement), focalisables.length, e.shiftKey);
    e.preventDefault();
    focalisables[suivant]?.focus();
  }

  // Glisser vers le bas depuis la poignee ou l'en-tete.
  function surDebutGlisse(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(SELECTEUR_CONTROLE)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    departRef.current = { y: e.clientY, t: e.timeStamp, id: e.pointerId };
    setGlisse(true);
  }

  function surGlisse(e: React.PointerEvent<HTMLDivElement>) {
    const depart = departRef.current;
    if (!depart || depart.id !== e.pointerId) return;
    setDecalage(decalageGlisse(depart.y, e.clientY));
  }

  function surFinGlisse(e: React.PointerEvent<HTMLDivElement>) {
    const depart = departRef.current;
    if (!depart || depart.id !== e.pointerId) return;
    departRef.current = null;
    setGlisse(false);
    // `pointercancel` : le navigateur reprend le geste (defilement), on revient.
    const annule = e.type === "pointercancel";
    if (!annule && doitFermerApresGlisse(decalageGlisse(depart.y, e.clientY), e.timeStamp - depart.t)) {
      demanderFermeture();
    } else {
      setDecalage(0);
    }
  }

  const visible = entree && !sortie;
  const transform = visible ? `translateY(${decalage}px)` : "translateY(calc(100% + 24px))";

  return createPortal(
    <>
      <div
        onClick={demanderFermeture}
        aria-hidden="true"
        className={`fixed inset-0 z-[79] bg-scrim transition-opacity duration-[260ms] motion-reduce:transition-none print:hidden ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={feuilleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${identifiant}-titre`}
        tabIndex={-1}
        onKeyDown={surToucheFeuille}
        style={{ transform }}
        className={`fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-[80] flex max-h-[85dvh] flex-col rounded-[28px] border border-edge-strong bg-panel-raised px-4 pb-[18px] pt-[10px] shadow-[0_-12px_40px_rgb(0_0_0/0.35)] outline-none print:hidden ${
          glisse ? "" : "transition-transform duration-[260ms] ease-[cubic-bezier(.4,0,.2,1)] motion-reduce:transition-none"
        }`}
      >
        {/* En-tete = zone de glisse : poignee 40 x 5 px, puis le titre. `touch-none`
            pour que le navigateur ne prenne pas le geste pour un defilement. */}
        <div
          onPointerDown={surDebutGlisse}
          onPointerMove={surGlisse}
          onPointerUp={surFinGlisse}
          onPointerCancel={surFinGlisse}
          className="shrink-0 touch-none"
        >
          <div className="mx-auto h-[5px] w-10 rounded-full bg-edge-strong" aria-hidden="true" />
          <h2
            id={`${identifiant}-titre`}
            className={titreVisible ? "px-1 pb-2 pt-3 font-chrome text-sm font-semibold text-ink" : "sr-only"}
          >
            {titre}
          </h2>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain ${titreVisible ? "" : "pt-3"}`}>{children}</div>
      </div>
    </>,
    document.body
  );
}
