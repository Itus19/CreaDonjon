"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import type { EntityRefPreview, RuleRefPreview } from "@/src/server/services/refPreview";

/** Delai d'intention. Assez long pour qu'un curseur qui traverse un paragraphe n'ouvre rien, assez court pour qu'un survol volontaire ne se remarque pas. */
const INTENT_MS = 250;
/** Fermeture : laisse le temps de rejoindre la carte a la souris sans la voir disparaitre sous le curseur. */
const CLOSE_MS = 180;
const CARD_WIDTH = 300;
const GAP = 8;

interface Target {
  name: string;
  /** Libelle deja traduit — categorie de la fiche ou type d'entree de regle. */
  category: string;
  excerpt: string | null;
  /** Entite seulement : sert la vignette. Absent pour une regle, qui n'a jamais d'illustration. */
  entityId?: string;
  href?: string;
}

/** Le lien survole, fige a l'ouverture : bords en coordonnees de fenetre, plus le defilement qu'il faudra rajouter pour repasser en coordonnees de document. */
interface Anchor {
  left: number;
  top: number;
  bottom: number;
  scrollX: number;
  scrollY: number;
}

/**
 * Cartes d'apercu au survol d'un lien (V2.1-18 lot 3).
 *
 * UNE seule instance pour toute la page, jamais une par lien : le Prologue
 * porte plus de vingt mentions, et vingt composants avec chacun leur
 * minuteur et leurs ecouteurs seraient du gaspillage pur. D'ou la
 * delegation d'evenements sur le document et la table de refs passee en
 * props — les liens eux-memes ne portent qu'un `data-ref-id`/`data-ref-key`.
 *
 * Aucun acces reseau au survol : tout ce que la carte montre est deja
 * arrive avec le HTML de la page (`refPreview.ts`, lot 2). C'est ce qui
 * permet de la peindre en une image.
 *
 * PAS de `router.prefetch` sur le minuteur d'intention, et c'est une
 * decision mesuree, pas un oubli. L'idee etait seduisante — ces 250 ms sont
 * le meilleur signal disponible qu'un lecteur va cliquer — et elle ne paie
 * rien ici : `/partage/[token]/[entitySlug]` est une route entierement
 * dynamique, et le cache client de Next lui applique `staleTimes.dynamic`,
 * qui vaut 0 par defaut. Mesure en construction de production : le survol
 * declenchait bien deux requetes de prechargement, puis le clic en faisait
 * une TROISIEME — la charge prechargee n'etait jamais reutilisee. Navigation
 * chronometree a 448 ms a froid contre 428 ms apres un survol appuye, soit
 * l'ecart de mesure. Deux rendus serveur par lien survole, pour rien.
 * A rouvrir seulement si `staleTimes` change, ce qui est une decision de
 * portee applicative, pas de composant.
 */
export default function RefPreviewLayer({
  entityRefs,
  ruleRefs,
  hrefBase,
}: {
  entityRefs: Record<string, EntityRefPreview>;
  ruleRefs: Record<string, RuleRefPreview>;
  hrefBase: string;
}) {
  // Memes tables que partout ailleurs, jamais un libelle reecrit pour
  // l'occasion : `ENTITY_KIND_LABELS` pour les fiches, `regles.entryTypes`
  // pour les regles — la meme lecture que `RuleEntryView`.
  const t = useTranslations("regles");
  const ruleEntryTypeLabels = t.raw("entryTypes") as Record<string, string>;
  const [target, setTarget] = useState<Target | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  /** Position du lien au moment de l'ouverture, en coordonnees de FENETRE — le calcul de placement raisonne sur ce qui est visible, pas sur le document. */
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  /**
   * V2.1-18 lot 4 — presentation seulement : feuille basse sur un ecran
   * etroit, carte flottante ailleurs.
   *
   * Question de LARGEUR, jamais de type de pointeur, et ce n'est pas le
   * premier choix (deux corrections sur le meme point, toutes deux venues
   * d'un appareil reel) :
   *
   * - `pointer: coarse` d'abord. Faux : il decrit le pointeur PRINCIPAL, et
   *   vaut vrai sur toute machine a ecran tactile, souris branchee ou non.
   * - `any-hover: hover` ensuite. Faux aussi, constate sur la Surface Pro de
   *   l'auteur : avec un ecran tactile present, Chrome/Edge sous Windows
   *   n'enumerent pas toujours la souris, et la requete repond `false` alors
   *   qu'une souris est bien la. Plus aucune carte ne s'ouvrait au survol.
   *
   * La lecon est generale : **une requete media decrit ce qu'un appareil
   * declare, pas ce que la personne est en train de faire.** Le survol ne se
   * predit donc plus du tout — il se constate, par le `pointerType` de
   * l'evenement (voir `onPointerOver`). Ici on ne decide plus que d'une mise
   * en page.
   *
   * Lu dans un effet et non au rendu : `matchMedia` n'existe pas au rendu
   * serveur, et la valeur doit etre la meme des deux cotes a l'hydratation.
   */
  const [narrow, setNarrow] = useState(false);
  const [portraitOk, setPortraitOk] = useState(true);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const close = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => setTarget(null), CLOSE_MS);
  }, [clearTimers]);

  const open = useCallback(
    (el: HTMLElement) => {
      const kind = el.dataset.refKind;
      let next: Target | null = null;

      if (kind === "entity" && el.dataset.refId) {
        const found = entityRefs[el.dataset.refId];
        if (found) {
          next = {
            name: found.name,
            category: ENTITY_KIND_LABELS[found.kind as keyof typeof ENTITY_KIND_LABELS] ?? found.kind,
            excerpt: found.excerpt,
            entityId: el.dataset.refId,
            href: `${hrefBase}/${found.slug}`,
          };
        }
      } else if (kind === "rule" && el.dataset.refKey) {
        const found = ruleRefs[el.dataset.refKey];
        if (found) {
          next = {
            name: found.name,
            category: ruleEntryTypeLabels[found.entryType] ?? found.entryType,
            excerpt: found.excerpt,
            // Une fiche de regle n'a jamais d'illustration, et sur `/partage`
            // elle n'a pas non plus de page : ni vignette, ni pied. Quand une
            // page existe (wiki joueur), le lien est celui que porte le
            // `<a>` — lu par `getAttribute` et non par `.href`, qui rendrait
            // l'URL absolue et ferait perdre la navigation client a `Link`.
            href: el.getAttribute("href") ?? undefined,
          };
        }
      }
      if (!next) return;

      // Mesure UNE fois, a l'ouverture. Le placement vertical, lui, ne peut
      // pas se decider ici : il depend de la HAUTEUR de la carte, qui n'existe
      // pas avant qu'elle soit rendue. D'ou l'ancre gardee telle quelle et le
      // calcul reporte dans un `useLayoutEffect` — voir plus bas.
      const rect = el.getBoundingClientRect();
      setAnchor({ left: rect.left, top: rect.top, bottom: rect.bottom, scrollX: window.scrollX, scrollY: window.scrollY });
      setPos(null);
      setPortraitOk(true);
      setTarget(next);
    },
    [entityRefs, ruleRefs, hrefBase, ruleEntryTypeLabels]
  );

  /**
   * Placement, une fois la carte rendue donc mesurable (retour utilisateur,
   * capture a l'appui : une carte ouverte sur un lien proche du bas de
   * l'ecran etait coupee par le bord, illisible).
   *
   * `useLayoutEffect` et non `useEffect` : il s'execute apres le rendu mais
   * AVANT que le navigateur peigne. La carte ne se voit donc jamais a sa
   * position provisoire — avec `useEffect` elle sauterait d'un endroit a
   * l'autre sous les yeux du lecteur.
   *
   * Trois cas, dans l'ordre : sous le lien si elle y tient, au-dessus
   * sinon, et en dernier recours calee dans la fenetre — ce dernier cas ne
   * sert que si le lien occupe une fenetre trop courte pour la carte des
   * deux cotes.
   */
  useLayoutEffect(() => {
    if (!target || !anchor || narrow) return;
    const card = cardRef.current;
    if (!card) return;

    const hauteur = card.offsetHeight;
    const largeurFenetre = document.documentElement.clientWidth;
    const hauteurFenetre = window.innerHeight;

    const x = Math.max(GAP, Math.min(anchor.left, largeurFenetre - CARD_WIDTH - GAP)) + anchor.scrollX;

    const tientDessous = anchor.bottom + GAP + hauteur <= hauteurFenetre - GAP;
    const tientDessus = anchor.top - GAP - hauteur >= GAP;
    const yFenetre = tientDessous
      ? anchor.bottom + GAP
      : tientDessus
        ? anchor.top - GAP - hauteur
        : Math.max(GAP, hauteurFenetre - hauteur - GAP);

    setPos({ x, y: yFenetre + anchor.scrollY });
  }, [target, anchor, narrow]);

  useEffect(() => {
    // 768 px : le seuil « telephone » du reste de la coquille.
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    function refFrom(e: Event): HTMLElement | null {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-ref-kind]");
      return el instanceof HTMLElement ? el : null;
    }

    /**
     * `pointerover` et non `mouseover`, et surtout `pointerType` plutot
     * qu'une requete media : l'evenement dit lui-meme s'il vient d'une
     * souris, d'un stylet ou d'un doigt. Un survol se CONSTATE, il ne se
     * predit pas — c'est la seule facon d'etre juste sur une machine qui a
     * les deux, quoi qu'elle declare par ailleurs (Surface Pro, retour de
     * l'auteur).
     *
     * Le doigt est ignore ici : un navigateur tactile emet un `pointerover`
     * synthetique juste avant le clic, qui ouvrirait la carte au moment ou
     * la navigation part. Le tap est servi par `onClick`, a sa place.
     */
    function onPointerOver(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      const el = refFrom(e);
      if (!el) return;
      clearTimers();
      openTimer.current = setTimeout(() => open(el), INTENT_MS);
    }

    function onPointerOut(e: PointerEvent) {
      if (e.pointerType === "touch" || !refFrom(e)) return;
      close();
    }

    /**
     * Le clic sur une REGLE ouvre la carte, partout et pas seulement au
     * tactile : elle n'a pas d'autre destination, et un lecteur qui clique
     * un mot souligne attend qu'il se passe quelque chose. Le clic sur une
     * ENTITE n'est jamais intercepte — un lecteur qui touche un nom de
     * personnage veut sa fiche, pas un resume.
     */
    function onClick(e: MouseEvent) {
      const el = refFrom(e);
      if (!el || el.dataset.refKind !== "rule") return;
      e.preventDefault();
      clearTimers();
      open(el);
    }

    function onFocus(e: FocusEvent) {
      const el = refFrom(e);
      if (el) open(el);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        clearTimers();
        setTarget(null);
      }
    }

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("click", onClick);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("click", onClick);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", close);
      document.removeEventListener("keydown", onKey);
      clearTimers();
    };
  }, [open, close, clearTimers]);

  if (!target) return null;

  return (
    <div
      ref={cardRef}
      role="tooltip"
      // Hors du flux du paragraphe : ouvrir une carte ne doit RIEN deplacer
      // dans le texte qu'on est en train de lire.
      className={
        narrow
          ? "fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-edge-strong bg-panel-raised p-4 shadow-2xl backdrop-blur-md"
          : "absolute z-40 rounded-xl border border-edge-strong bg-panel-raised p-3 shadow-2xl backdrop-blur-md"
      }
      style={
        narrow
          ? undefined
          : {
              left: 0,
              top: 0,
              width: CARD_WIDTH,
              transform: `translate3d(${pos?.x ?? 0}px, ${pos?.y ?? 0}px, 0)`,
              // La carte doit EXISTER pour etre mesuree, et ne jamais se voir
              // avant d'etre placee. `useLayoutEffect` pose `pos` avant la
              // premiere peinture, donc cet etat n'atteint pas l'ecran — il
              // couvre le cas ou la mesure echouerait.
              visibility: pos ? "visible" : "hidden",
            }
      }
      onMouseEnter={narrow ? undefined : clearTimers}
      onMouseLeave={narrow ? undefined : close}
    >
      {narrow && (
        <button
          type="button"
          onClick={() => setTarget(null)}
          className="float-right -mt-1 px-2 py-1 text-xs text-ink-muted"
          aria-label="Fermer l'aperçu"
        >
          ✕
        </button>
      )}
      <div className="flex items-start gap-3">
        {/* Boite reservee en dur : `/api/entities/[id]/portrait` repond par
            une redirection vers une URL signee — deux allers-retours. Sans
            reservation, la carte grandirait sous le curseur a l'arrivee de
            l'image. Meme repli que `PublicPortrait` sur un 404. */}
        {target.entityId && portraitOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/entities/${target.entityId}/portrait`}
            alt=""
            onError={() => setPortraitOk(false)}
            className="aspect-[3/4] w-12 shrink-0 rounded-md border border-edge object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{target.name}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-muted">{target.category}</p>
        </div>
      </div>
      {target.excerpt && <p className="mt-2 text-xs leading-relaxed text-ink">{target.excerpt}</p>}
      {/* Un vrai lien, corrige sur retour de l'auteur : ce pied etait un
          `<span>` inerte portant la couleur `--link-entity`. C'est trait pour
          trait le defaut que le lot 1 de ce meme ticket corrigeait dans le
          texte — un mot qui a l'air cliquable et ne l'est pas — reintroduit
          ici par la carte censee le reparer. `onClick` ferme avant de
          naviguer : sans cela, la carte resterait montee pendant la
          transition et se retrouverait posee sur la fiche d'arrivee. */}
      {target.href && (
        <Link
          href={target.href}
          onClick={() => {
            clearTimers();
            setTarget(null);
          }}
          className="mt-2 block text-xs text-link-entity hover:underline"
        >
          Ouvrir la fiche →
        </Link>
      )}
    </div>
  );
}
